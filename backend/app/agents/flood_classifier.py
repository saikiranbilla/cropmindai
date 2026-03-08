from __future__ import annotations

from datetime import date

from app.agents.state import FloodAssessmentState

# ─── FCIC final planting date table (mocked per crop) ─────────────────────────
# In production, look these up from the FCIC actuarial data API by crop + county_fips.
# Dates are the same each calendar year — we resolve to the event year at runtime.

_FINAL_PLANTING_MONTH_DAY: dict[str, tuple[int, int]] = {
    "corn":      (5, 31),   # May 31
    "soybeans":  (6, 15),   # June 15
    "wheat":     (10, 31),  # October 31 (winter wheat)
    "cotton":    (6, 15),
    "sorghum":   (6, 20),
}

_DEFAULT_FINAL_PLANTING: tuple[int, int] = (5, 31)  # corn default if unknown crop


def _resolve_final_planting_date(crop_type: str, event_year: int) -> date:
    """Return the FCIC final planting date for the given crop in the event year."""
    month, day = _FINAL_PLANTING_MONTH_DAY.get(crop_type.lower(), _DEFAULT_FINAL_PLANTING)
    return date(event_year, month, day)


def _season_end(crop_type: str, event_year: int) -> date:
    """Approximate end of the growing season — used to calculate days_remaining."""
    season_ends: dict[str, tuple[int, int]] = {
        "corn":      (10, 15),
        "soybeans":  (10, 1),
        "wheat":     (7, 15),
        "cotton":    (10, 31),
        "sorghum":   (10, 1),
    }
    month, day = season_ends.get(crop_type.lower(), (10, 15))
    return date(event_year, month, day)


# ─── Main classifier node ──────────────────────────────────────────────────────

def classify_flood_pathway(state: FloodAssessmentState) -> dict:
    """
    Deterministic routing node — no LLM involved.

    Reads computed context fields and environmental data to assign one of four
    FCIC-aligned flood pathways. Returns a partial state dict that LangGraph
    merges back into the full state.

    Branch priority (evaluated top-to-bottom, first match wins):
        1. prevented_planting  — event before final planting date, no crop in ground
        2. replant_eligible    — planted crop, <10% survival, ≥30 days left in season
        3. stand_mortality     — planted crop, <10% survival, <30 days left
        4. partial_damage      — default (crop damaged but viable stand remains)
    """
    errors: list[str] = []

    # Accept date object or ISO string (LangGraph may deserialise dates as str)
    raw_date = state["weather_event_date"]
    event_date: date = raw_date if isinstance(raw_date, date) else date.fromisoformat(str(raw_date)[:10])
    crop_type:        str   = state.get("crop_type", "corn")
    avg_survival:     float = state.get("avg_survival_pct") or 100.0
    days_remaining:   int   = state.get("days_remaining")  or 999

    # Resolve final planting date (use pre-computed value if the setup node set it,
    # otherwise derive it from the mock table).
    final_date: date = (
        state.get("final_planting_date")
        or _resolve_final_planting_date(crop_type, event_date.year)
    )

    # Determine soil saturation from environmental data (may not be set yet if
    # classifier runs before the environmental agent — safe default to "Low").
    env_data       = state.get("environmental_data") or {}
    soil_sat       = env_data.get("soil_saturation", "Low")
    soil_saturated = soil_sat == "High"

    # ── Branch 1: Prevented Planting ──────────────────────────────────────────
    # Event occurred before the final planting date AND the field has no crop
    # planted (represented here as avg_survival == 100 with no vision data, i.e.
    # scouting points show no standing crop) AND soil saturation is High.
    vision      = state.get("vision_results") or {}
    no_crop_planted = (
        not vision                          # vision agent hasn't found a crop
        or vision.get("growth_stage") in (None, "", "0-Leaf", "pre-emergence")
    )

    is_pre_planting = event_date < final_date

    if is_pre_planting and no_crop_planted:
        return {
            "flood_pathway":        "prevented_planting",
            "final_planting_date":  final_date,
            "is_pre_planting":      True,
            "errors":               errors,
        }

    # ── Branch 2: Replant Eligible ─────────────────────────────────────────────
    # Crop is in the ground, catastrophic stand loss (< 10% survival),
    # and enough growing season remains to justify replanting (≥ 30 days).
    if avg_survival < 10.0 and days_remaining >= 30:
        return {
            "flood_pathway":        "replant_eligible",
            "final_planting_date":  final_date,
            "is_pre_planting":      is_pre_planting,
            "errors":               errors,
        }

    # ── Branch 3: Stand Mortality ──────────────────────────────────────────────
    # Same catastrophic loss threshold but too late in the season to replant.
    # Indemnity is calculated on the dead stand as harvested yield.
    if avg_survival < 10.0 and days_remaining < 30:
        return {
            "flood_pathway":        "stand_mortality",
            "final_planting_date":  final_date,
            "is_pre_planting":      is_pre_planting,
            "errors":               errors,
        }

    # ── Branch 4: Partial Damage (default) ────────────────────────────────────
    # Crop is alive with a viable stand — defoliation / lodging damage is present
    # but the plant can physiologically recover. Yield loss is calculated via the
    # FCIC defoliation tables (handled by the insurance agent downstream).
    return {
        "flood_pathway":        "partial_damage",
        "final_planting_date":  final_date,
        "is_pre_planting":      is_pre_planting,
        "errors":               errors,
    }
