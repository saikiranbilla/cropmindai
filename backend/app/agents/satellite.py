"""Satellite / Climate Agent — Open-Meteo forecast API (free tier).

Fetches hourly soil-moisture and precipitation data for the past 7 days
at the centroid of the scouting-point coordinates, then summarises the
values into a human-readable string and a structured dict that feed the
synthesis agent and the Supabase row.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.agents.state import FloodAssessmentState

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_HTTP_TIMEOUT  = 10.0  # seconds


def _centroid(points: list[dict]) -> tuple[float, float]:
    """Average lat/lng of scouting points; falls back to Champaign County."""
    if not points:
        return 40.1164, -88.2434
    lats = [float(p["lat"]) for p in points if "lat" in p]
    lngs = [float(p["lng"]) for p in points if "lng" in p]
    if not lats:
        return 40.1164, -88.2434
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


async def fetch_satellite_data(lat: float, lon: float) -> dict:
    """Call Open-Meteo forecast endpoint and return averaged/summed values.

    Returns a dict with:
      avg_soil_moisture_m3m3  – mean volumetric soil water (0–7 cm) over 7 d
      total_precip_mm         – cumulative precipitation over 7 d
      hours_sampled           – number of hourly readings used
      source                  – "open-meteo"
    """
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(_FORECAST_URL, params={
            "latitude":      lat,
            "longitude":     lon,
            "hourly":        "soil_moisture_0_to_7cm,precipitation",
            "past_days":     7,
            "forecast_days": 1,   # minimise payload — we only need historical
        })
        resp.raise_for_status()
        hourly = resp.json().get("hourly", {})

    moisture_vals = [v for v in (hourly.get("soil_moisture_0_to_7cm") or []) if v is not None]
    precip_vals   = [v for v in (hourly.get("precipitation")           or []) if v is not None]

    avg_moisture = round(sum(moisture_vals) / len(moisture_vals), 4) if moisture_vals else None
    total_precip = round(sum(precip_vals), 2)                        if precip_vals   else None

    return {
        "avg_soil_moisture_m3m3": avg_moisture,
        "total_precip_mm":        total_precip,
        "hours_sampled":          len(moisture_vals),
        "source":                 "open-meteo",
    }


def _build_summary(data: dict) -> str:
    moisture = data.get("avg_soil_moisture_m3m3")
    precip   = data.get("total_precip_mm")
    src      = data.get("source", "unknown")

    if src == "fallback":
        return "Satellite climate data unavailable — API request failed."

    parts: list[str] = []
    if moisture is not None:
        saturation = "saturated" if moisture > 0.35 else "moderate" if moisture > 0.20 else "dry"
        parts.append(f"Avg soil moisture (0–7 cm): {moisture} m³/m³ ({saturation})")
    if precip is not None:
        intensity = "heavy" if precip > 75 else "moderate" if precip > 25 else "light"
        parts.append(f"7-day cumulative precipitation: {precip} mm ({intensity})")

    return " | ".join(parts) if parts else "No usable satellite data returned."


async def run_satellite_agent(state: FloodAssessmentState) -> dict[str, Any]:
    """LangGraph node — fetch Open-Meteo satellite/climate data, update state."""
    errors: list[str] = []
    points = list(state.get("scouting_points") or [])
    lat, lon = _centroid(points)

    try:
        data = await fetch_satellite_data(lat, lon)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"satellite_agent: Open-Meteo forecast failed — {exc}")
        data = {
            "avg_soil_moisture_m3m3": None,
            "total_precip_mm":        None,
            "hours_sampled":          0,
            "source":                 "fallback",
        }

    satellite_data = {**data, "summary": _build_summary(data)}
    return {"satellite_data": satellite_data, "errors": errors}
