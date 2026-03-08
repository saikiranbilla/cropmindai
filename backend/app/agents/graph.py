"""LangGraph DAG — CropClaim AI flood-assessment pipeline.

Topology
--------

    START
      |---> vision_agent       -|
      |---> environmental_agent -|---> flood_classifier
      |---> satellite_agent    -|
                                          |
                              (conditional on flood_pathway)
                                          |
                                    spatial_agent
                                          |
                                   insurance_agent   (RAG -- stub)
                                          |
                                   synthesis_agent  (async)
                                          |
                                         END

IMPORTANT — async synthesis node
---------------------------------
`synthesis_agent` is an async coroutine.  LangGraph supports mixed sync/async
graphs, but the compiled graph must be invoked with the async API:

    result = await app.ainvoke(initial_state)

Calling the synchronous `app.invoke()` on a graph containing async nodes will
raise a RuntimeError.  In FastAPI route handlers use:

    import asyncio
    result = await app.ainvoke(initial_state)       # inside async def route
    # or
    result = asyncio.run(app.ainvoke(initial_state)) # in sync contexts
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agents.environmental import run_environmental_agent
from app.agents.flood_classifier import classify_flood_pathway
from app.agents.insurance import run_insurance_agent
from app.agents.satellite import run_satellite_agent
from app.agents.spatial import run_flood_spatial
from app.agents.state import FloodAssessmentState
from app.agents.synthesis import run_flood_synthesis
from app.agents.vision import run_vision_agent

# ── Routing function ──────────────────────────────────────────────────────────

_VALID_PATHWAYS = {
    "prevented_planting",
    "replant_eligible",
    "stand_mortality",
    "partial_damage",
}


def _route_from_classifier(state: FloodAssessmentState) -> str:
    """Return the next node name based on the flood_pathway written by the classifier.

    All current pathways proceed to spatial analysis.  The conditional-edge
    structure is in place so future phases can branch to pathway-specific
    nodes without touching the graph wiring.
    """
    pathway = state.get("flood_pathway", "")
    if pathway not in _VALID_PATHWAYS:
        # Unknown pathway — still proceed; spatial agent will handle gracefully
        return "spatial_agent"
    return "spatial_agent"


# ── Graph definition ──────────────────────────────────────────────────────────

graph = StateGraph(FloodAssessmentState)

# Nodes
graph.add_node("vision_agent", run_vision_agent)
graph.add_node("environmental_agent", run_environmental_agent)
graph.add_node("satellite_agent", run_satellite_agent)
graph.add_node("flood_classifier", classify_flood_pathway)
graph.add_node("spatial_agent", run_flood_spatial)
graph.add_node("insurance_agent", run_insurance_agent)
graph.add_node("synthesis_agent", run_flood_synthesis)

# Edges — parallel fan-out from START (three concurrent branches)
graph.add_edge(START, "vision_agent")
graph.add_edge(START, "environmental_agent")
graph.add_edge(START, "satellite_agent")

# All three parallel branches converge at flood_classifier
graph.add_edge("vision_agent", "flood_classifier")
graph.add_edge("environmental_agent", "flood_classifier")
graph.add_edge("satellite_agent", "flood_classifier")

# Conditional routing out of flood_classifier
graph.add_conditional_edges(
    "flood_classifier",
    _route_from_classifier,
    {
        "spatial_agent": "spatial_agent",
    },
)

# Linear tail of the pipeline
graph.add_edge("spatial_agent", "insurance_agent")
graph.add_edge("insurance_agent", "synthesis_agent")
graph.add_edge("synthesis_agent", END)

# ── Compiled app ──────────────────────────────────────────────────────────────

app = graph.compile()
