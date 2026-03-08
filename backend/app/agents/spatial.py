"""Spatial Agent — clusters scouting points into flood zones.

Algorithm
---------
1.  Classify each scouting point into a flood zone using its severity as a
    proxy for elevation relative to the environmental ponding contour:

        high     severity -> contour - 0.50 m  -> "submerged"
        moderate severity -> contour + 0.10 m  -> "waterlogged"
        low      severity -> contour + 1.00 m  -> "dry"

2.  Derive a per-point stand-survival estimate from the zone assignment,
    calibrated against the pipeline's avg_survival_pct if available.

3.  Compute average survival per zone.

4.  Run a contiguous-area check on the flooded footprint (submerged +
    waterlogged points):
    - Build clusters via Haversine-distance graph (connectivity threshold
      CONTIGUITY_THRESHOLD_M, default 500 m).
    - Estimate each cluster's area from its lat/lng bounding box.
    - Flag whether any single cluster meets or exceeds ACRE_THRESHOLD (20).

No third-party geo libraries are required — only stdlib math.
"""

from __future__ import annotations

import math
from collections import defaultdict, deque
from typing import Any

from app.agents.state import FloodAssessmentState, SpatialAnalysis

# ── Constants ─────────────────────────────────────────────────────────────────

# Elevation offset (m) relative to the ponding contour per severity level
_SEVERITY_OFFSET: dict[str, float] = {
    "high":     -0.50,
    "moderate":  0.10,
    "low":       1.00,
}

# Contour-relative offset bands that determine flood zone label
_ZONE_THRESHOLDS: list[tuple[float, float, str]] = [
    (-math.inf,  0.0,       "submerged"),
    ( 0.0,       0.5,       "waterlogged"),
    ( 0.5,       math.inf,  "dry"),
]

# Baseline stand-survival (%) by flood zone — agronomic literature defaults.
# These are modulated by avg_survival_pct when the pipeline has computed it.
_ZONE_BASE_SURVIVAL: dict[str, float] = {
    "submerged":    5.0,    # continuous inundation kills most row crops
    "waterlogged":  35.0,   # anaerobic stress; some tolerance crop-dependent
    "dry":          82.0,   # minimal flood impact
}

# Two flooded points <= this distance apart are considered contiguous
CONTIGUITY_THRESHOLD_M: float = 500.0

# FCIC minimum contiguous flooded area to qualify for prevented-planting / replant
ACRE_THRESHOLD: float = 20.0

# Unit conversion
_M2_PER_ACRE: float = 4_046.856

# Fraction of bounding-box area assumed to be actual crop area (irregular fields)
_BBOX_COVERAGE: float = 0.70


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in metres between two WGS-84 points."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi       = math.radians(lat2 - lat1)
    dlambda    = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2.0 * R * math.asin(math.sqrt(a))


def _bounding_box_acres(lats: list[float], lngs: list[float]) -> float:
    """Estimate the area enclosed by a set of lat/lng points in acres.

    Uses the bounding box of the point cloud, scaled by _BBOX_COVERAGE to
    account for field irregularity.  Accurate enough for >2-point clusters;
    returns 0 for single-point clusters (area indeterminate).
    """
    if len(lats) < 2:
        return 0.0
    mid_lat  = (min(lats) + max(lats)) / 2.0
    width_m  = _haversine_m(mid_lat, min(lngs), mid_lat, max(lngs))
    height_m = _haversine_m(min(lats), min(lngs), max(lats), min(lngs))
    return (width_m * height_m * _BBOX_COVERAGE) / _M2_PER_ACRE


def _build_clusters(
    points: list[dict[str, Any]], threshold_m: float
) -> list[list[int]]:
    """BFS graph clustering on Euclidean proximity.

    Returns a list of clusters, each cluster being a list of indices into
    `points`.  Two points share a cluster edge when their Haversine distance
    is <= threshold_m.
    """
    n = len(points)
    if n == 0:
        return []

    # Build adjacency list
    adj: dict[int, list[int]] = defaultdict(list)
    for i in range(n):
        for j in range(i + 1, n):
            d = _haversine_m(
                points[i]["lat"], points[i]["lng"],
                points[j]["lat"], points[j]["lng"],
            )
            if d <= threshold_m:
                adj[i].append(j)
                adj[j].append(i)

    visited: set[int] = set()
    clusters: list[list[int]] = []

    for start in range(n):
        if start in visited:
            continue
        cluster: list[int] = []
        queue   = deque([start])
        visited.add(start)
        while queue:
            node = queue.popleft()
            cluster.append(node)
            for nb in adj[node]:
                if nb not in visited:
                    visited.add(nb)
                    queue.append(nb)
        clusters.append(cluster)

    return clusters


# ── Zone classification ───────────────────────────────────────────────────────

def _classify_offset(offset: float) -> str:
    for lo, hi, label in _ZONE_THRESHOLDS:
        if lo <= offset < hi:
            return label
    return "dry"


def _survival_for_zone(zone: str, calibration_factor: float) -> float:
    """Return estimated stand-survival (%) for a zone, optionally calibrated."""
    base = _ZONE_BASE_SURVIVAL[zone]
    # If the pipeline has a field-level avg_survival_pct, use it as an upper
    # bound for dry zones and scale the flooded zones proportionally.
    return round(min(base * calibration_factor, 100.0), 1)


# ── Main node ─────────────────────────────────────────────────────────────────

def run_flood_spatial(state: FloodAssessmentState) -> dict[str, Any]:
    """
    Enrich scouting points with flood-zone labels, compute per-zone average
    survival rates, and test the 20-acre contiguous flooded-area threshold.
    """
    env    = state.get("environmental_data") or {}
    points = list(state.get("scouting_points") or [])
    errors: list[str] = []

    # ── Ponding contour reference ─────────────────────────────────────────────
    if not env:
        errors.append("spatial_agent: environmental_data missing — contour defaulted to 0 m")
    contour_m: float = float(env.get("elevation_m", 0.0))

    # ── Calibration factor from pipeline avg_survival_pct ────────────────────
    # avg_survival_pct is the field-level mean; dry-zone base = 82 %.
    # Scale factor = (avg_survival / 82) so dry zones hit the field mean.
    avg_surv: float = float(state.get("avg_survival_pct") or 82.0)
    calibration: float = max(avg_surv / _ZONE_BASE_SURVIVAL["dry"], 0.01)

    # ── Per-point enrichment ──────────────────────────────────────────────────
    enriched: list[dict[str, Any]] = []
    zone_buckets: dict[str, list[dict[str, Any]]] = {
        "submerged": [], "waterlogged": [], "dry": []
    }

    for pt in points:
        severity  = str(pt.get("severity", "low")).lower()
        offset    = _SEVERITY_OFFSET.get(severity, _SEVERITY_OFFSET["low"])
        synth_elv = contour_m + offset
        zone      = _classify_offset(offset)
        survival  = _survival_for_zone(zone, calibration)

        enriched_pt = {
            **pt,
            "synthetic_elevation_m": round(synth_elv, 2),
            "elevation_offset_m":    round(offset, 2),
            "flood_zone":            zone,
            "est_stand_survival_pct": survival,
        }
        enriched.append(enriched_pt)
        zone_buckets[zone].append(enriched_pt)

    # ── Per-zone average survival ─────────────────────────────────────────────
    def _zone_avg_survival(bucket: list[dict[str, Any]]) -> float | None:
        if not bucket:
            return None
        return round(
            sum(p["est_stand_survival_pct"] for p in bucket) / len(bucket), 1
        )

    zone_avg_survival: dict[str, float | None] = {
        z: _zone_avg_survival(zone_buckets[z]) for z in ("submerged", "waterlogged", "dry")
    }

    # ── 20-acre contiguous flooded-area check ─────────────────────────────────
    flooded_pts = zone_buckets["submerged"] + zone_buckets["waterlogged"]
    threshold_met     = False
    largest_acres     = 0.0
    n_flooded_clusters = 0

    if len(flooded_pts) >= 1:
        clusters = _build_clusters(flooded_pts, CONTIGUITY_THRESHOLD_M)
        n_flooded_clusters = len(clusters)

        cluster_acres: list[float] = []
        for cluster_indices in clusters:
            cluster_pts = [flooded_pts[i] for i in cluster_indices]
            lats = [p["lat"] for p in cluster_pts]
            lngs = [p["lng"] for p in cluster_pts]
            acres = _bounding_box_acres(lats, lngs)
            cluster_acres.append(acres)

        if cluster_acres:
            largest_acres = max(cluster_acres)
            threshold_met = largest_acres >= ACRE_THRESHOLD

    # ── Zone summary string (consumed by synthesis agent) ─────────────────────
    counts = {z: len(b) for z, b in zone_buckets.items()}

    def _surv_str(v: float | None) -> str:
        return f"{v:.1f}%" if v is not None else "n/a"

    summary_lines = [
        f"Ponding contour reference: {contour_m:.1f} m ASL",
        f"Field-level avg survival used for calibration: {avg_surv:.1f}%",
        "",
        "Zone breakdown:",
        f"  submerged    ({counts['submerged']:>3} pts)  avg survival: {_surv_str(zone_avg_survival['submerged'])}",
        f"  waterlogged  ({counts['waterlogged']:>3} pts)  avg survival: {_surv_str(zone_avg_survival['waterlogged'])}",
        f"  dry          ({counts['dry']:>3} pts)  avg survival: {_surv_str(zone_avg_survival['dry'])}",
        "",
        "20-acre contiguous flooded-area check:",
        f"  Flooded points (submerged + waterlogged): {len(flooded_pts)}",
        f"  Contiguous clusters detected:             {n_flooded_clusters}",
        f"  Largest cluster estimated area:           {largest_acres:.1f} acres",
        f"  >= {ACRE_THRESHOLD:.0f}-acre threshold:                  {'YES — qualifies' if threshold_met else 'NO — does not qualify'}",
    ]

    spatial_analysis: SpatialAnalysis = {
        "enriched_points": enriched,
        "zone_summaries":  "\n".join(summary_lines),
        "zone_a_count":    counts["submerged"],
        "zone_b_count":    counts["waterlogged"],
        # Extra keys (TypedDict is not enforced at runtime)
        "zone_dry_count":           counts["dry"],
        "zone_avg_survival":        zone_avg_survival,
        "flooded_area_acres":       round(largest_acres, 2),
        "acre_threshold_met":       threshold_met,
        "n_contiguous_clusters":    n_flooded_clusters,
    }

    return {"spatial_analysis": spatial_analysis, "errors": errors}
