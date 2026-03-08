"""Insurance Agent — Phase 4 RAG implementation.

Embeds the flood pathway + crop type via sentence-transformers and queries
the Supabase pgvector `match_policies` RPC to retrieve relevant FCIC policy
chunks, then generates structured action items from the retrieved text.
"""

from __future__ import annotations

import logging
from typing import Any

from sentence_transformers import SentenceTransformer
from supabase import create_client

from app.agents.state import FloodAssessmentState, InsuranceMatches
from app.config import settings

logger = logging.getLogger(__name__)

# Load model once at import time (384-dim, ~80 MB, cached after first download)
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _build_query_text(flood_pathway: str | None, crop_type: str | None) -> str:
    """Combine state fields into a single retrieval query string."""
    parts: list[str] = []
    if flood_pathway:
        parts.append(f"flood pathway: {flood_pathway.replace('_', ' ')}")
    if crop_type:
        parts.append(f"crop: {crop_type}")
    return "; ".join(parts) if parts else "flood crop insurance policy"


def _derive_action_items(chunks: list[str], flood_pathway: str | None) -> list[str]:
    """Generate 2-3 concrete action items grounded in retrieved policy text."""
    actions: list[str] = []

    # Action 1 — always: notify FSA / file notice of loss
    deadline_hint = "within 72 hours of discovery"
    if flood_pathway == "prevented_planting":
        deadline_hint = "no later than the final planting date or 72 hours after discovery"
    actions.append(
        f"File a Notice of Loss with your crop insurance agent {deadline_hint}; "
        "failure to report timely may void coverage."
    )

    # Action 2 — drawn from first retrieved chunk if available
    if len(chunks) >= 1:
        # Extract the most policy-specific sentence from the first chunk
        sentences = [s.strip() for s in chunks[0].split(".") if len(s.strip()) > 30]
        if sentences:
            actions.append(
                f"Review policy provision: \"{sentences[0]}.\" "
                "Confirm applicable APH yield and unit structure with your AIP."
            )
        else:
            actions.append(
                "Preserve all field evidence (photos, GPS tracks, yield records) "
                "as required by the Standard Reinsurance Agreement."
            )
    else:
        actions.append(
            "Preserve all field evidence (photos, GPS tracks, yield records) "
            "as required by the Standard Reinsurance Agreement."
        )

    # Action 3 — drawn from second chunk or pathway-specific guidance
    if len(chunks) >= 2:
        sentences2 = [s.strip() for s in chunks[1].split(".") if len(s.strip()) > 30]
        if sentences2:
            actions.append(
                f"Per retrieved policy: \"{sentences2[0]}.\" "
                "Schedule a joint field inspection with the loss adjuster."
            )
        else:
            actions.append("Schedule a joint field inspection with the loss adjuster.")
    elif flood_pathway == "stand_mortality":
        actions.append(
            "Do not replant or terminate the insured crop before the adjuster "
            "completes the stand-count inspection (FCIC germination / plant-population rules)."
        )
    elif flood_pathway in ("replant_eligible", "prevented_planting"):
        actions.append(
            "Obtain written consent from your AIP before replanting; "
            "unauthorized replanting may forfeit prevented-planting indemnity."
        )
    else:
        actions.append(
            "Document crop growth stage at time of loss using BBCH or V/R staging "
            "to support the yield-adjustment calculation."
        )

    return actions


def run_insurance_agent(state: FloodAssessmentState) -> dict[str, Any]:
    """
    RAG node: embeds flood_pathway + crop_type → queries Supabase `match_policies`
    → formats results into InsuranceMatches for the report.
    """
    flood_pathway: str | None = state.get("flood_pathway")
    crop_type: str | None = state.get("crop_type")

    # ── 1. Build query text and embed ─────────────────────────────────────────
    query_text = _build_query_text(flood_pathway, crop_type)
    logger.info("insurance_agent: embedding query=%r", query_text)

    try:
        model = _get_model()
        vector = model.encode(query_text, normalize_embeddings=True)
    except Exception as exc:
        logger.exception("insurance_agent: embedding failed — %s", exc)
        return _fallback(errors=[f"Embedding failed: {exc}"])

    # ── 2. Query Supabase pgvector RPC ────────────────────────────────────────
    try:
        supabase = create_client(settings.supabase_url, settings.supabase_service_key)
        response = supabase.rpc(
            "match_policies",
            {
                "query_embedding": vector.tolist(),
                "match_threshold": 0.5,
                "match_count": 2,
            },
        ).execute()
    except Exception as exc:
        logger.exception("insurance_agent: Supabase RPC failed — %s", exc)
        return _fallback(errors=[f"Supabase RPC failed: {exc}"])

    rows: list[dict[str, Any]] = response.data or []
    logger.info("insurance_agent: retrieved %d policy chunks", len(rows))

    # ── 3. Extract chunks and build matched_sections ──────────────────────────
    chunks: list[str] = [r.get("chunk_text", "") for r in rows if r.get("chunk_text")]

    matched_sections = []
    for i, row in enumerate(rows):
        chunk_text: str = row.get("chunk_text", "")
        reference: str = row.get("reference", row.get("id", f"POLICY-{i + 1}"))
        similarity: float = row.get("similarity", 0.0)

        # Use first sentence as a readable title (fallback to reference)
        first_sentence = chunk_text.split(".")[0].strip() if chunk_text else reference

        matched_sections.append(
            {
                "reference": reference,
                "explanation": chunk_text,
                "title": first_sentence[:120] if first_sentence else reference,
                "similarity": round(similarity, 4),
            }
        )

    # ── 4. Build action items from retrieved policy text ──────────────────────
    action_items = _derive_action_items(chunks, flood_pathway)

    # ── 5. Assemble InsuranceMatches payload ──────────────────────────────────
    matches: InsuranceMatches = {
        "matched_sections": matched_sections,
        "yield_loss_estimate": "Pending adjuster inspection",
        "deadlines": [
            "File Notice of Loss within 72 hours of damage discovery (FCIC requirement)",
        ],
        "action_items": action_items,
        "source": "live" if rows else "fallback",
    }

    if not rows:
        logger.warning("insurance_agent: no policy chunks returned — check pgvector data")
        matches["matched_sections"] = [
            {
                "reference": "NO-MATCH",
                "explanation": (
                    "No policy chunks met the similarity threshold. "
                    "Verify that the `policy_chunks` table is populated and "
                    "`match_policies` RPC is deployed in Supabase."
                ),
                "title": "Policy data unavailable",
                "similarity": 0.0,
            }
        ]

    return {"insurance_matches": matches, "errors": []}


# ── Fallback helper ────────────────────────────────────────────────────────────

def _fallback(errors: list[str]) -> dict[str, Any]:
    matches: InsuranceMatches = {
        "matched_sections": [
            {
                "reference": "FALLBACK",
                "explanation": "Insurance RAG pipeline encountered an error; manual review required.",
                "title": "Automated policy match unavailable",
                "similarity": 0.0,
            }
        ],
        "yield_loss_estimate": "TBD",
        "deadlines": ["File Notice of Loss within 72 hours of damage discovery"],
        "action_items": ["Contact your crop insurance agent immediately for manual policy review."],
        "source": "fallback",
    }
    return {"insurance_matches": matches, "errors": errors}
