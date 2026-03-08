"""Flood Classifier — stub (Phase 2, Task B placeholder).

Reads VisionResult + EnvironmentalData and writes `flood_pathway` to
route the graph toward the correct downstream chain.

Pathways:
  "prevented_planting"  — field never planted / inundated before planting
  "replant_eligible"    — partial crop loss, replanting economically viable
  "stand_mortality"     — severe stand loss, replanting not viable
  "partial_damage"      — localised damage, harvest still expected
"""

from __future__ import annotations

from typing import Any

from app.agents.state import FloodAssessmentState


def run_flood_classifier(state: FloodAssessmentState) -> dict[str, Any]:
    """Stub: classifies pathway from environmental flood_risk_score."""
    errors: list[str] = []

    env = state.get("environmental_data") or {}
    risk = str(env.get("flood_risk_score", "Low")).lower()
    vision = state.get("vision_results") or {}
    stand_loss = float(vision.get("stand_loss_percent", 0.0))

    if risk == "high" and stand_loss >= 50.0:
        pathway = "stand_mortality"
    elif risk == "high":
        pathway = "replant_eligible"
    elif risk == "moderate":
        pathway = "partial_damage"
    else:
        pathway = "partial_damage"

    errors.append(f"flood_classifier: stub — assigned pathway '{pathway}'")
    return {"flood_pathway": pathway, "errors": errors}
