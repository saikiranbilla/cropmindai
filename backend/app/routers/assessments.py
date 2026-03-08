"""POST /api/assessments — Phase 2.5: live pipeline wiring.

Flow:
  1. Validate + parse the multipart form data.
  2. Upload photo to Supabase Storage (non-fatal if it fails).
  3. Insert a pending assessment row into the assessments table.
  4. Enqueue the LangGraph pipeline as a FastAPI BackgroundTask.
  5. Return 201 immediately — the client polls for results.

The background task (run_pipeline_bg) runs the full LangGraph DAG and
writes the synthesis result back to Supabase when complete.
"""

from __future__ import annotations

import json
import traceback
import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from supabase import create_client

from app.agents.graph import app as langgraph_app
from app.agents.state import FloodAssessmentState
from app.config import settings

router = APIRouter(prefix="/api", tags=["assessments"])

STORAGE_BUCKET = "scouting_photos"


# ── Response schema ────────────────────────────────────────────────────────────

class AssessmentCreatedResponse(BaseModel):
    assessment_id: str
    photo_url:     str | None
    message:       str


# ── Supabase helper ───────────────────────────────────────────────────────────

def _supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


# ── Background pipeline task ──────────────────────────────────────────────────

async def run_pipeline_bg(assessment_id: str, initial_state: FloodAssessmentState) -> None:
    """Run the LangGraph pipeline and persist results to Supabase.

    Runs entirely in the background after the 201 response is sent.
    All exceptions are caught so a pipeline failure never surfaces to the client.
    """
    sb = _supabase()

    try:
        final_state = await langgraph_app.ainvoke(initial_state)

        synthesis   = final_state.get("synthesis") or {}
        spatial     = final_state.get("spatial_analysis") or {}
        insurance   = final_state.get("insurance_matches") or {}

        sb.table("assessments").update({
            "status":            "completed",
            "flood_pathway":     final_state.get("flood_pathway"),
            "executive_summary": synthesis.get("executive_summary"),
            "confidence":        synthesis.get("overall_confidence"),
            "conflict_flags":    synthesis.get("conflict_flags", []),
            "zone_summaries":    spatial.get("zone_summaries"),
            "yield_loss_estimate": insurance.get("yield_loss_estimate"),
            # Persist the full insurance agent output so the frontend can render
            # matched policy sections and action items without falling back to stubs.
            "insurance_matches": {
                "matched_sections": insurance.get("matched_sections", []),
                "action_items":     insurance.get("action_items", []),
                "deadlines":        insurance.get("deadlines", []),
                "yield_loss_estimate": insurance.get("yield_loss_estimate"),
                "source":           insurance.get("source", "live"),
            },
            "satellite_data":    final_state.get("satellite_data"),
            "pipeline_errors":   final_state.get("errors", []),
            "completed_at":      datetime.now(timezone.utc).isoformat(),
        }).eq("id", assessment_id).execute()

    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()  # print full stack trace to the terminal
        # Mark the row as failed so the client can display an error state
        try:
            sb.table("assessments").update({
                "status":          "failed",
                "pipeline_errors": [traceback.format_exc()],
            }).eq("id", assessment_id).execute()
        except Exception:
            pass  # DB is also down — nothing more we can do


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post(
    "/assessments",
    status_code=status.HTTP_201_CREATED,
    response_model=AssessmentCreatedResponse,
)
async def create_assessment(
    background_tasks: BackgroundTasks,
    crop_type: str = Form(..., description="Crop type, e.g. 'corn'"),
    weather_event_date: str = Form(..., description="ISO-8601 datetime of the weather event"),
    photo_metadata: str = Form(..., description="JSON with scouting_points array and county_fips"),
    photo: UploadFile | None = None,
) -> AssessmentCreatedResponse:

    # ── 1. Parse inputs ────────────────────────────────────────────────────────
    try:
        event_dt = datetime.fromisoformat(weather_event_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="weather_event_date must be a valid ISO-8601 datetime string.",
        )

    try:
        metadata: dict[str, Any] = json.loads(photo_metadata)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="photo_metadata must be valid JSON.",
        )

    assessment_id = str(uuid.uuid4())
    created_at    = datetime.now(timezone.utc).isoformat()
    sb            = _supabase()
    photo_url: str | None = None

    # ── 2. Upload photo (non-fatal) ────────────────────────────────────────────
    if photo is not None:
        try:
            content      = await photo.read()
            ext          = (photo.filename or "photo.jpg").rsplit(".", 1)[-1]
            storage_path = f"{assessment_id}/photo.{ext}"

            sb.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": photo.content_type or "image/jpeg"},
            )
            photo_url = (
                f"{settings.supabase_url}/storage/v1/object/public"
                f"/{STORAGE_BUCKET}/{storage_path}"
            )
        except Exception as exc:  # noqa: BLE001
            metadata["_photo_upload_error"] = str(exc)

    # ── 3. Insert pending row ──────────────────────────────────────────────────
    row = {
        "id":                 assessment_id,
        "crop_type":          crop_type,
        "weather_event_date": event_dt.isoformat(),
        "photo_url":          photo_url,
        "photo_metadata":     metadata,
        "status":             "pending",
        "created_at":         created_at,
    }

    try:
        result = sb.table("assessments").insert(row).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database insert returned no data.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist assessment: {exc}",
        ) from exc

    # ── 4. Build initial state and enqueue pipeline ────────────────────────────
    scouting_points = metadata.get("scouting_points", [])
    county_fips     = str(metadata.get("county_fips", "17019"))

    initial_state: FloodAssessmentState = {
        "assessment_id":      assessment_id,
        "scouting_points":    scouting_points,
        "crop_type":          crop_type,
        "weather_event_date": event_dt.date(),
        "county_fips":        county_fips,
        # Computed fields — populated by classifier
        "final_planting_date": None,
        "is_pre_planting":     None,
        "days_remaining":      None,
        "avg_survival_pct":    None,
        # Agent outputs — all None at entry
        "vision_results":     None,
        "environmental_data": None,
        "satellite_data":     None,
        "spatial_analysis":   None,
        "insurance_matches":  None,
        "synthesis":          None,
        # Routing
        "flood_pathway": None,
        # Metadata
        "errors":     [],
        "created_at": created_at,
    }

    background_tasks.add_task(run_pipeline_bg, assessment_id, initial_state)

    # ── 5. Return 201 immediately ──────────────────────────────────────────────
    return AssessmentCreatedResponse(
        assessment_id=assessment_id,
        photo_url=photo_url,
        message="Assessment created. Pipeline running in background.",
    )


# ── GET /api/assessments/{id}/status ──────────────────────────────────────────

@router.get("/assessments/{assessment_id}/status", tags=["assessments"])
def get_assessment_status(assessment_id: str):
    """Lightweight status check — called every 2 s by the frontend poller."""
    sb = _supabase()
    try:
        result = sb.table("assessments") \
                   .select("id, status") \
                   .eq("id", assessment_id) \
                   .single() \
                   .execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Assessment not found: {exc}") from exc

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Assessment not found.")

    return {"assessment_id": result.data["id"], "status": result.data["status"]}


# ── GET /api/assessments/{id} ─────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}", tags=["assessments"])
def get_assessment(assessment_id: str):
    """Return the full assessment row once the pipeline has completed."""
    sb = _supabase()
    try:
        result = sb.table("assessments") \
                   .select("*") \
                   .eq("id", assessment_id) \
                   .single() \
                   .execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Assessment not found: {exc}") from exc

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Assessment not found.")

    return result.data
