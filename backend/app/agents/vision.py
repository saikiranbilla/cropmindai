"""Vision Agent — live implementation (Phase 2.5).

Sends scouting-point metadata to Claude acting as an FCIC loss adjuster.
Since base64 field images are not yet in the LangGraph state (they live in
Supabase Storage), this agent reasons from structured damage descriptions.
When image bytes are plumbed into the state in a later phase the same
system prompt applies — only the content array changes.
"""

from __future__ import annotations

import json
import re
from typing import Any

import anthropic

from app.agents.state import FloodAssessmentState, VisionResult
from app.config import settings

_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = """\
You are a certified FCIC Loss Adjuster evaluating crop flood damage.

STAGING PROTOCOL:
Use the V-stage (leaf collar) method for corn unless told otherwise.
At V6 (six visible leaf collars) and below the growing point is below-ground
and may survive brief inundation. At V7+ the growing point has emerged above
the soil surface and is vulnerable.

FLOOD DAMAGE PROTOCOL:
  - "high" severity scouting points indicate standing water or complete lodging.
  - "moderate" indicates partial lodging or evidence of recent inundation.
  - "low" indicates peripheral damage or minimal water contact.

Estimate stand_loss_percent as the proportion of plants that will not recover.
Do NOT count plants that are lodged but still rooted and green.

OUTPUT FORMAT:
Reply with ONLY a raw JSON object — no markdown fences, no commentary.
Schema:
{
  "crop_type":           "<string>",
  "growth_stage":        "<string, e.g. V6>",
  "damage_types":        ["<string>"],
  "defoliation_percent": <float 0-100>,
  "stand_loss_percent":  <float 0-100>,
  "confidence":          <float 0.0-1.0>,
  "reasoning":           "<one paragraph>"
}
"""


def _build_user_message(state: FloodAssessmentState) -> str:
    points = state.get("scouting_points", [])
    crop   = state.get("crop_type", "unknown")
    event  = state.get("weather_event_date", "unknown")

    lines = [
        f"Crop type       : {crop}",
        f"Weather event   : {event}",
        f"County FIPS     : {state.get('county_fips', 'N/A')}",
        "",
        "Scouting points (field observations):",
    ]
    for pt in points:
        lines.append(
            f"  - Point {pt.get('id', '?')}: severity={pt.get('severity', '?')}, "
            f"damage_type={pt.get('damage_type', '?')}, "
            f"zone={pt.get('zone', '?')}, "
            f"lat={pt.get('lat', '?')}, lng={pt.get('lng', '?')}"
        )
    lines += [
        "",
        "Based on these observations, produce the JSON assessment.",
    ]
    return "\n".join(lines)


async def run_vision_agent(state: FloodAssessmentState) -> dict[str, Any]:
    errors: list[str] = []

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=_MODEL,
            max_tokens=512,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_message(state)}],
        )

        raw = message.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\s*```\s*$",       "", raw, flags=re.MULTILINE)
        parsed: dict[str, Any] = json.loads(raw.strip())

        result: VisionResult = {
            "crop_type":           str(parsed.get("crop_type",           state.get("crop_type", "unknown"))),
            "growth_stage":        str(parsed.get("growth_stage",        "unknown")),
            "damage_types":        list(parsed.get("damage_types",       ["flood"])),
            "defoliation_percent": float(parsed.get("defoliation_percent", 0.0)),
            "stand_loss_percent":  float(parsed.get("stand_loss_percent",  0.0)),
            "confidence":          float(parsed.get("confidence",          0.0)),
            "reasoning":           str(parsed.get("reasoning",            "")),
        }

    except anthropic.APIError as exc:
        errors.append(f"vision_agent: Anthropic API error — {exc}")
        result = _fallback_result(state)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        errors.append(f"vision_agent: response parse error — {exc}")
        result = _fallback_result(state)

    return {"vision_results": result, "errors": errors}


def _fallback_result(state: FloodAssessmentState) -> VisionResult:
    points  = state.get("scouting_points", [])
    n_high  = sum(1 for p in points if p.get("severity") == "high")
    n_total = len(points) or 1
    est_loss = round((n_high / n_total) * 60, 1)  # rough heuristic

    return VisionResult(
        crop_type=state.get("crop_type", "unknown"),
        growth_stage="unknown",
        damage_types=["flood"],
        defoliation_percent=0.0,
        stand_loss_percent=est_loss,
        confidence=0.2,
        reasoning="Claude unavailable — stand loss estimated from scouting severity counts.",
    )
