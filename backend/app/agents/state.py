from __future__ import annotations

import operator
from datetime import date
from typing import Annotated, Any, Optional, TypedDict


# ─── Nested payload types ──────────────────────────────────────────────────────

class ScoutingPoint(TypedDict):
    id:          int
    lat:         float
    lng:         float
    severity:    str          # "high" | "moderate" | "low"
    zone:        str          # "A" | "B" | ...
    damage_type: str          # "Defoliation" | "Wind Lodging" | ...


class VisionResult(TypedDict):
    crop_type:            str
    growth_stage:         str
    damage_types:         list[str]
    defoliation_percent:  float
    stand_loss_percent:   float
    confidence:           float
    reasoning:            str


class EnvironmentalData(TypedDict):
    precipitation_mm:   float
    min_temp_c:         float
    max_wind_kmh:       float
    elevation_m:        float
    flood_risk_score:   str   # "High" | "Moderate" | "Low"
    soil_saturation:    str   # "High" | "Moderate" | "Low"
    source:             str   # "live" | "partial" | "fallback"


class SpatialAnalysis(TypedDict):
    enriched_points:  list[dict[str, Any]]
    zone_summaries:   str
    zone_a_count:     int
    zone_b_count:     int


class InsuranceMatch(TypedDict):
    reference:    str
    explanation:  str


class InsuranceMatches(TypedDict):
    matched_sections:     list[InsuranceMatch]
    yield_loss_estimate:  str
    deadlines:            list[str]
    action_items:         list[str]
    source:               str   # "live" | "fallback"


class ActionItem(TypedDict):
    deadline:    str   # ISO date or human description, e.g. "Within 15 days of discovery"
    action:      str   # What the farmer / adjuster must do
    responsible: str   # "farmer" | "adjuster" | "both"


class SynthesisOutput(TypedDict):
    executive_summary:  str
    action_timeline:    list[ActionItem]   # ordered list of deadline-driven steps
    conflict_flags:     list[str]
    overall_confidence: float
    disclaimer:         str
    source:             str


class SatelliteData(TypedDict):
    avg_soil_moisture_m3m3: Optional[float]   # volumetric water content 0–7 cm
    total_precip_mm:        Optional[float]   # 7-day cumulative precipitation
    hours_sampled:          int
    source:                 str               # "open-meteo" | "fallback"
    summary:                str               # human-readable one-liner


# ─── Root state ────────────────────────────────────────────────────────────────

class FloodAssessmentState(TypedDict):
    # ── Inputs (provided by the caller) ────────────────────────────────────────
    assessment_id:      str
    scouting_points:    list[ScoutingPoint]
    crop_type:          str           # "corn" | "soybeans" | "wheat" ...
    weather_event_date: date          # date loss was discovered / storm occurred
    county_fips:        str           # e.g. "17019" for Champaign County, IL

    # ── Computed agronomic context (populated by setup node) ───────────────────
    # May 31 for corn, June 15 for soybeans (Champaign County defaults)
    final_planting_date:    Optional[date]   # FCIC final planting date for crop/county
    is_pre_planting:        Optional[bool]   # True if event_date < final_planting_date
    days_remaining:         Optional[int]    # growing-season days left after event
    avg_survival_pct:       Optional[float]  # mean stand survival across scouting points

    # ── Agent outputs (each node writes its own key) ────────────────────────────
    vision_results:     Optional[VisionResult]
    environmental_data: Optional[EnvironmentalData]
    satellite_data:     Optional[SatelliteData]
    spatial_analysis:   Optional[SpatialAnalysis]
    insurance_matches:  Optional[InsuranceMatches]
    synthesis:          Optional[SynthesisOutput]

    # ── Routing decision (written by flood_classifier node) ────────────────────
    flood_pathway: Optional[str]
    # "prevented_planting" | "replant_eligible" | "stand_mortality" | "partial_damage"

    # ── Metadata ───────────────────────────────────────────────────────────────
    # Annotated with operator.add so LangGraph concatenates concurrent writes
    # from parallel nodes (vision + environmental both append warnings here).
    errors: Annotated[list[str], operator.add]
    created_at: Optional[str]  # ISO timestamp set at graph entry
