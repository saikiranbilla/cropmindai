"""Environmental Agent — live implementation (Phase 2.5).

Fetches real-world weather (Open-Meteo archive API) and elevation
(Open-Elevation) for the centroid of the scouting points.

Both external calls are wrapped in try/except with timeouts so a
slow or down free-tier API never blocks the pipeline.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import httpx

from app.agents.state import EnvironmentalData, FloodAssessmentState

_OPEN_METEO_URL   = "https://archive-api.open-meteo.com/v1/archive"
_OPEN_ELEV_URL    = "https://api.open-elevation.com/api/v1/lookup"
_FALLBACK_ELEV_M  = 213.0          # Champaign County, IL average
_HTTP_TIMEOUT     = 10.0           # seconds for weather (more data)
_ELEV_TIMEOUT     = 3.0            # seconds — tight; free tier is slow


def _centroid(points: list[dict]) -> tuple[float, float]:
    """Average lat/lng of scouting points. Fallback to Champaign coords."""
    if not points:
        return 40.1164, -88.2434
    lats = [float(p["lat"]) for p in points if "lat" in p]
    lngs = [float(p["lng"]) for p in points if "lng" in p]
    if not lats:
        return 40.1164, -88.2434
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


def _flood_risk(precip_mm: float, elevation_m: float) -> str:
    """Simple heuristic — Champaign low-lying threshold is ~220 m."""
    low_lying  = elevation_m < 220.0
    heavy_rain = precip_mm > 50.8   # 2 inches
    mod_rain   = precip_mm > 25.4   # 1 inch

    if low_lying and heavy_rain:
        return "High"
    if low_lying and mod_rain:
        return "Moderate"
    if heavy_rain:
        return "Moderate"
    return "Low"


def _soil_saturation(precip_mm: float) -> str:
    if precip_mm > 75.0:
        return "High"
    if precip_mm > 35.0:
        return "Moderate"
    return "Low"


async def run_environmental_agent(state: FloodAssessmentState) -> dict[str, Any]:
    errors:  list[str] = []
    points   = list(state.get("scouting_points") or [])
    lat, lng = _centroid(points)

    # ── Event date — may arrive as date object or ISO string ──────────────────
    raw_date = state.get("weather_event_date")
    if isinstance(raw_date, date):
        event_date = raw_date
    else:
        try:
            event_date = date.fromisoformat(str(raw_date)[:10])
        except (ValueError, TypeError):
            event_date = date.today()
            errors.append("environmental_agent: could not parse weather_event_date — using today")

    start_date = (event_date - timedelta(days=7)).isoformat()
    end_date   = event_date.isoformat()

    # ── 1. Open-Meteo weather ─────────────────────────────────────────────────
    precip_mm   = 0.0
    min_temp_c  = 0.0
    max_wind    = 0.0
    weather_src = "fallback"

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(_OPEN_METEO_URL, params={
                "latitude":  lat,
                "longitude": lng,
                "start_date": start_date,
                "end_date":   end_date,
                "daily": "precipitation_sum,temperature_2m_min,wind_speed_10m_max",
                "timezone": "America/Chicago",
            })
            resp.raise_for_status()
            daily = resp.json().get("daily", {})

            precip_vals = [v for v in (daily.get("precipitation_sum") or []) if v is not None]
            temp_vals   = [v for v in (daily.get("temperature_2m_min") or []) if v is not None]
            wind_vals   = [v for v in (daily.get("wind_speed_10m_max") or []) if v is not None]

            precip_mm  = round(sum(precip_vals), 1)
            min_temp_c = round(min(temp_vals), 1) if temp_vals else 0.0
            max_wind   = round(max(wind_vals), 1) if wind_vals else 0.0
            weather_src = "live"

    except Exception as exc:  # noqa: BLE001
        errors.append(f"environmental_agent: Open-Meteo failed — {exc}")

    # ── 2. Open-Elevation (3 s timeout, fallback to 213 m) ────────────────────
    elevation_m = _FALLBACK_ELEV_M
    elev_src    = "fallback"

    try:
        async with httpx.AsyncClient(timeout=_ELEV_TIMEOUT) as client:
            resp = await client.get(_OPEN_ELEV_URL, params={
                "locations": f"{lat},{lng}"
            })
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                elevation_m = float(results[0].get("elevation", _FALLBACK_ELEV_M))
                elev_src    = "live"
    except Exception as exc:  # noqa: BLE001
        errors.append(f"environmental_agent: Open-Elevation failed — {exc} — defaulting to {_FALLBACK_ELEV_M} m")

    source = "live" if (weather_src == "live" and elev_src == "live") else \
             "partial" if (weather_src == "live" or elev_src == "live") else "fallback"

    data: EnvironmentalData = {
        "precipitation_mm":  precip_mm,
        "min_temp_c":        min_temp_c,
        "max_wind_kmh":      max_wind,
        "elevation_m":       round(elevation_m, 1),
        "flood_risk_score":  _flood_risk(precip_mm, elevation_m),
        "soil_saturation":   _soil_saturation(precip_mm),
        "source":            source,
    }
    return {"environmental_data": data, "errors": errors}
