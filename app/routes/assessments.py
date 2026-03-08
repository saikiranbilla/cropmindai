import json
import uuid
from typing import List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.database import supabase
from app.models import PhotoMetadata

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_assessment(
    crop_type: str = Form(...),
    weather_event_date: str = Form(...),
    field_name: str = Form(...),
    photos: List[UploadFile] = File(...),
    photo_metadata: str = Form(...)  # Expects a JSON string of a list of metadata dicts
):
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database client not initialized"
        )

    # 1. Parse photo metadata JSON
    try:
        metadata_list = json.loads(photo_metadata)
        if len(metadata_list) != len(photos):
            raise ValueError("The number of metadata entries must directly match the number of uploaded photos.")
        
        parsed_metadata = [PhotoMetadata(**m) for m in metadata_list]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid photo_metadata format or mismatched lengths: {str(e)}"
        )

    # Note: In a real app we'd extract the user_id from the auth dependency.
    user_id = "default_user_123"

    # 2. Insert new 'pending' assessment
    try:
        assessment_res = supabase.table("assessments").insert({
            "user_id": user_id,
            "status": "pending",
            "field_name": field_name,
            "crop_type": crop_type,
            "weather_event_date": weather_event_date
        }).execute()
        
        if not assessment_res.data:
            raise Exception("No data returned from database insert.")
            
        assessment_data = assessment_res.data[0]
        assessment_id = assessment_data["id"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create assessment record: {str(e)}"
        )

    # 3. Upload photos to Supabase Storage and build scouting point rows
    scouting_points_to_insert = []
    bucket_name = "scouting_photos"

    for i, file in enumerate(photos):
        meta = parsed_metadata[i]
        
        # Try to infer extension, default to .jpg
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        # Group uploads into a folder named by their assessment UUID
        file_path = f"{assessment_id}/{uuid.uuid4()}.{file_ext}"
        
        try:
            # Upload the spooled file data to Supabase Storage bucket
            # We use file.file.read() to get the raw bytes
            file_bytes = await file.read()
            supabase.storage.from_(bucket_name).upload(
                path=file_path,
                file=file_bytes,
                file_options={"content-type": file.content_type}
            )
            
            # Generate the public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
            
            # Map the parsed Pydantic schema to the database column names
            scouting_points_to_insert.append({
                "assessment_id": assessment_id,
                "photo_url": public_url,
                "latitude": meta.lat,
                "longitude": meta.lon,
                "elevation_m": meta.elevation_m,
                "captured_at": meta.captured_at.isoformat(),
                "gps_source": meta.gps_source
            })
            
        except Exception as e:
            # In a true robust architecture, we'd add rollback logic here for partial uploads
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload and process photo '{file.filename}': {str(e)}"
            )

    # 4. Insert scouting points rows in bulk
    try:
        points_res = supabase.table("scouting_points").insert(scouting_points_to_insert).execute()
        points_data = points_res.data
    except Exception as e:
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail=f"Failed to link scouting point records to the assessment: {str(e)}"
         )

    return {
        "assessment_id": assessment_id,
        "scouting_points": points_data
    }
