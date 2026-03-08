"""
test_phase2_graph.py
--------------------
Standalone smoke-test for the Phase 2 LangGraph DAG.

Run from the /backend directory:
    python test_phase2_graph.py

Expected: all six nodes execute, flood_pathway is assigned, spatial
analysis keys are present, and the synthesis executive_summary is
populated (live Claude call or fallback).
"""

import asyncio
import json
from datetime import date

from app.agents.graph import app as langgraph_app
from app.agents.state import FloodAssessmentState

# ─── Mock initial state ───────────────────────────────────────────────────────

initial_state: FloodAssessmentState = {
    # ── Inputs ────────────────────────────────────────────────────────────────
    "assessment_id":      "test-phase2-001",
    "crop_type":          "corn",
    # May 15 is before the corn final planting date (May 31) for Champaign County —
    # this exercises the pre-planting branch of the classifier.
    "weather_event_date": date(2026, 5, 15),
    "county_fips":        "17019",   # Champaign County, IL
    "scouting_points": [
        {
            "id":          1,
            "lat":         40.1105,
            "lng":         -88.2401,
            "severity":    "high",
            "zone":        "A",
            "damage_type": "Flood Inundation",
        },
        {
            "id":          2,
            "lat":         40.1112,
            "lng":         -88.2395,
            "severity":    "moderate",
            "zone":        "B",
            "damage_type": "Waterlogging",
        },
    ],

    # ── Computed context (not yet set — nodes will populate) ──────────────────
    "final_planting_date": None,
    "is_pre_planting":     None,
    "days_remaining":      None,
    "avg_survival_pct":    None,

    # ── Agent outputs (empty at entry) ────────────────────────────────────────
    "vision_results":     None,
    "environmental_data": None,
    "spatial_analysis":   None,
    "insurance_matches":  None,
    "synthesis":          None,

    # ── Routing ───────────────────────────────────────────────────────────────
    "flood_pathway": None,

    # ── Metadata ─────────────────────────────────────────────────────────────
    "errors":     [],
    "created_at": "2026-05-15T12:00:00Z",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    width = 60
    print(f"\n{'-' * width}")
    print(f"  {title}")
    print(f"{'-' * width}")


def pretty(obj) -> str:
    return json.dumps(obj, indent=2, default=str)


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n[CropClaim AI] Phase 2 Graph Smoke Test")
    print(f"    Assessment ID : {initial_state['assessment_id']}")
    print(f"    Crop          : {initial_state['crop_type']}")
    print(f"    Event date    : {initial_state['weather_event_date']}")
    print(f"    County FIPS   : {initial_state['county_fips']}")
    print(f"    Scout points  : {len(initial_state['scouting_points'])}")

    section("Starting pipeline...")
    final_state = await langgraph_app.ainvoke(initial_state)
    print("  OK  Graph invocation complete.")

    # ── 1. Flood pathway ──────────────────────────────────────────────────────
    section("1. Flood Pathway (Classifier Node)")
    pathway = final_state.get("flood_pathway")
    print(f"  flood_pathway  : {pathway}")
    print(f"  is_pre_planting: {final_state.get('is_pre_planting')}")
    print(f"  final_planting : {final_state.get('final_planting_date')}")
    assert pathway is not None, "FAIL: flood_pathway was not set"
    print("  OK  Classifier node ran successfully.")

    # ── 2. Spatial analysis ───────────────────────────────────────────────────
    section("2. Spatial Analysis (Spatial Agent Node)")
    spatial = final_state.get("spatial_analysis")
    assert spatial is not None, "FAIL: spatial_analysis was not set"
    print(f"  Keys present   : {list(spatial.keys())}")
    print(f"  Enriched points: {len(spatial.get('enriched_points', []))}")
    print(f"\n  Zone summary:\n{spatial.get('zone_summaries', '(none)')}")
    print("  OK  Spatial agent ran successfully.")

    # ── 3. Synthesis executive summary ────────────────────────────────────────
    section("3. Synthesis (Executive Summary)")
    synthesis = final_state.get("synthesis")
    assert synthesis is not None, "FAIL: synthesis was not set"
    print(f"  Source         : {synthesis.get('source')}")
    print(f"  Confidence     : {synthesis.get('overall_confidence')}")
    print(f"  Conflict flags : {synthesis.get('conflict_flags')}")
    print(f"\n  Executive summary:\n")
    print(f"    {synthesis.get('executive_summary', '(empty)').replace(chr(10), chr(10) + '    ')}")
    print("  OK  Synthesis node ran successfully.")

    # ── 4. Pipeline errors ────────────────────────────────────────────────────
    section("4. Pipeline Warnings / Non-Fatal Errors")
    errors = final_state.get("errors", [])
    unique_errors = list(dict.fromkeys(errors))   # preserve order, dedupe
    if unique_errors:
        for e in unique_errors:
            print(f"  WARN  {e}")
    else:
        print("  (none)")

    # ── 5. Full final state (optional deep debug) ─────────────────────────────
    section("5. Full Final State (debug)")
    debug_state = {
        k: v for k, v in final_state.items()
        if k not in ("synthesis", "spatial_analysis")   # already printed above
    }
    print(pretty(debug_state))

    section("ALL CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
