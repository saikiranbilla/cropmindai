"""Synthesis Agent — async LLM synthesis of all upstream agent outputs.

Uses anthropic.AsyncAnthropic so it integrates cleanly with LangGraph's
async execution model (call the graph with `await app.ainvoke(...)`).

The agent is instructed to:
  1. Lead with the specific FCIC claim pathway identified.
  2. Produce a concrete, deadline-driven action timeline.
  3. Explicitly surface logical conflicts between agent outputs — the most
     critical being Vision (plant state) vs Environmental (submersion hours),
     since continuous inundation beyond ~72-96 h is lethal for most row crops
     regardless of how healthy plants appear in a photo taken before death.
"""

from __future__ import annotations

import json
import re
from typing import Any

import anthropic

from app.agents.state import ActionItem, FloodAssessmentState, SynthesisOutput
from app.config import settings

_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = """\
You are the Lead Synthesizer for CropClaim AI, an automated crop-insurance \
assessment platform. You receive structured outputs from four upstream agents \
(Vision, Environmental, Spatial, Insurance) and must produce a final report.

Rules:
1. Lead your executive summary with the specific claim pathway identified \
   (Prevented Planting, Replant Eligible, or Stand Mortality). State it in \
   the first sentence. Keep the summary to 2 paragraphs maximum.
2. Produce an action_timeline: an ordered list of concrete, deadline-driven \
   steps the farmer and adjuster must take. Limit to 5 items maximum. \
   Each item must have:
     - "deadline":    ISO-8601 date or a plain-English deadline
     - "action":      What must be done (specific, not generic)
     - "responsible": "farmer", "adjuster", or "both"
3. Explicitly check for logical conflicts between agent outputs and list them \
   in conflict_flags. The most important conflict to detect:
     - Vision reports living or green plants BUT Environmental data shows the \
       field was submerged for >= 72 hours — agronomically impossible for most \
       row crops at vegetative stages; one source must be wrong.
   Other conflicts: Spatial says dry but Environmental says High flood risk; \
   Insurance says replant viable but Spatial says 0 contiguous acres flooded.
4. Reply with ONLY valid JSON — no markdown fences, no prose outside the JSON. \
   Be concise — the entire response must fit within 1500 tokens.

Required JSON schema:
{
  "executive_summary":  "<2 paragraph max string>",
  "action_timeline": [
    {
      "deadline":     "<string>",
      "action":       "<string>",
      "responsible":  "farmer" | "adjuster" | "both"
    }
  ],
  "conflict_flags":    ["<string>", ...],
  "overall_confidence": <float 0.0-1.0>,
  "disclaimer": "<one sentence>"
}
"""


# ── Context builder ────────────────────────────────────────────────────────────

def _build_user_message(state: FloodAssessmentState) -> str:
    vision    = state.get("vision_results")    or {}
    env       = state.get("environmental_data") or {}
    spatial   = state.get("spatial_analysis")  or {}
    insurance = state.get("insurance_matches") or {}

    # Pull spatial extras written outside the TypedDict for richer context
    acre_met  = spatial.get("acre_threshold_met", "unknown")
    acres     = spatial.get("flooded_area_acres",  "unknown")
    zone_surv = spatial.get("zone_avg_survival",   {})

    parts = [
        "## Claim context",
        f"- Assessment ID      : {state.get('assessment_id', 'N/A')}",
        f"- Crop type          : {state.get('crop_type', 'N/A')}",
        f"- Weather event date : {state.get('weather_event_date', 'N/A')}",
        f"- County FIPS        : {state.get('county_fips', 'N/A')}",
        f"- Flood pathway      : {state.get('flood_pathway', 'N/A')}",
        f"- Final planting date: {state.get('final_planting_date', 'N/A')}",
        f"- Days remaining     : {state.get('days_remaining', 'N/A')}",
        f"- Field avg survival : {state.get('avg_survival_pct', 'N/A')}%",
        "",
        "## Vision Agent",
        json.dumps(vision, indent=2, default=str),
        "",
        "## Environmental Agent",
        json.dumps(env, indent=2, default=str),
        "",
        "## Spatial Agent — zone summary",
        spatial.get("zone_summaries", "(none)"),
        "",
        f"  flooded_area_acres   : {acres}",
        f"  acre_threshold_met   : {acre_met}",
        f"  zone_avg_survival    : {json.dumps(zone_surv)}",
        "",
        "## Insurance Agent",
        json.dumps(insurance, indent=2, default=str),
        "",
        "## Pipeline warnings / non-fatal errors",
        json.dumps(state.get("errors", []), indent=2),
        "",
        "---",
        "Produce your JSON response now. Ensure conflict_flags is populated "
        "whenever Vision and Environmental data are logically inconsistent.",
    ]
    return "\n".join(parts)


# ── Response parser ────────────────────────────────────────────────────────────

def _repair_truncated_json(text: str) -> str | None:
    """Close a truncated JSON object by re-balancing braces and brackets.

    Handles the common case where Claude's response is cut off mid-string
    because max_tokens was hit. Tries to produce a parseable document by:
      1. Stripping any trailing incomplete string value.
      2. Closing open arrays and objects in reverse order.
    Returns the repaired string, or None if it still won't parse.
    """
    repair = text.rstrip()
    # Drop a trailing comma or incomplete value after the last complete one
    repair = re.sub(r",\s*$", "", repair)
    # If we're inside an unterminated string, close it
    # Count unescaped quotes to detect odd (open) state
    quote_count = len(re.findall(r'(?<!\\)"', repair))
    if quote_count % 2 != 0:
        repair += '"'
    # Re-balance brackets and braces
    open_brackets = repair.count("[") - repair.count("]")
    open_braces   = repair.count("{") - repair.count("}")
    repair += "]" * max(open_brackets, 0)
    repair += "}" * max(open_braces, 0)
    try:
        json.loads(repair)
        return repair
    except json.JSONDecodeError:
        return None


def _parse_response(raw: str, errors: list[str]) -> dict[str, Any] | None:
    """Strip markdown fences and parse JSON. Falls back to truncation repair."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        errors.append(f"synthesis_agent: JSON parse error — {exc}; attempting repair")
        repaired = _repair_truncated_json(text)
        if repaired is not None:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass
        errors.append("synthesis_agent: JSON repair failed — using fallback")
        return None


def _to_synthesis_output(parsed: dict[str, Any], source: str) -> SynthesisOutput:
    # Normalise action_timeline — tolerate missing fields gracefully
    raw_timeline = parsed.get("action_timeline", [])
    timeline: list[ActionItem] = []
    for item in raw_timeline if isinstance(raw_timeline, list) else []:
        if isinstance(item, dict):
            timeline.append(
                ActionItem(
                    deadline=str(item.get("deadline", "")),
                    action=str(item.get("action", "")),
                    responsible=str(item.get("responsible", "both")),
                )
            )

    return SynthesisOutput(
        executive_summary=str(parsed.get("executive_summary", "")),
        action_timeline=timeline,
        conflict_flags=list(parsed.get("conflict_flags", [])),
        overall_confidence=float(parsed.get("overall_confidence", 0.0)),
        disclaimer=str(parsed.get("disclaimer", "")),
        source=source,
    )


# ── Fallback ───────────────────────────────────────────────────────────────────

def _fallback_synthesis(state: FloodAssessmentState, errors: list[str]) -> SynthesisOutput:
    pathway = state.get("flood_pathway", "unknown")
    spatial = state.get("spatial_analysis") or {}
    return SynthesisOutput(
        executive_summary=(
            f"[FALLBACK] Pathway: {pathway}. "
            f"Spatial summary: {spatial.get('zone_summaries', 'N/A')}. "
            "Claude synthesis unavailable — review raw agent outputs manually."
        ),
        action_timeline=[
            ActionItem(
                deadline="Immediately",
                action="Review raw agent outputs and contact adjuster manually.",
                responsible="both",
            )
        ],
        conflict_flags=["synthesis_agent: operating in fallback mode"],
        overall_confidence=0.1,
        disclaimer=(
            "This assessment is AI-generated and must be reviewed by a licensed "
            "crop-insurance adjuster before any coverage determination is made."
        ),
        source="fallback",
    )


# ── Main async node ────────────────────────────────────────────────────────────

async def run_flood_synthesis(state: FloodAssessmentState) -> dict[str, Any]:
    """
    Async LangGraph node — call with `await app.ainvoke(...)` at the graph level.

    Sends all upstream agent context to Claude and returns a structured
    SynthesisOutput containing the executive summary, action timeline, and
    any detected logical conflicts between agent findings.
    """
    # Only collect NEW errors from this node — do NOT re-emit state.errors,
    # because errors uses operator.add and re-emitting would double every
    # prior agent's errors in the final pipeline_errors list.
    new_errors: list[str] = []

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        message = await client.messages.create(
            model=_MODEL,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_message(state)}],
        )

        raw_text = message.content[0].text
        parsed   = _parse_response(raw_text, new_errors)

        if parsed is None:
            synthesis = _fallback_synthesis(state, new_errors)
        else:
            synthesis = _to_synthesis_output(parsed, source="live")

    except anthropic.APIError as exc:
        new_errors.append(f"synthesis_agent: Anthropic API error — {exc}")
        synthesis = _fallback_synthesis(state, new_errors)

    return {"synthesis": synthesis, "errors": new_errors}
