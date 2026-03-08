from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
import uuid

class AssessmentCreate(BaseModel):
    crop_type: str
    weather_event_date: date
    field_name: str

class PhotoMetadata(BaseModel):
    lat: float
    lon: float
    elevation_m: float
    captured_at: datetime
    gps_source: str

class ScoutingPoint(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    photo_url: str
    latitude: float
    longitude: float
    elevation_m: float
    captured_at: datetime
    gps_source: str
    crop_detected: Optional[bool] = None
    crop_type: Optional[str] = None
    growth_stage: Optional[str] = None
    standing_water: Optional[bool] = None
    alive_pct: Optional[float] = None
    dead_pct: Optional[float] = None
    severity: Optional[str] = None
    zone_id: Optional[str] = None

class Assessment(BaseModel):
    id: uuid.UUID
    user_id: str
    status: str
    field_name: str
    county: Optional[str] = None
    crop_type: str
    flood_pathway: Optional[str] = None
    weather_event_date: Optional[date] = None
    total_field_acres: Optional[float] = None
    meets_pp_threshold: Optional[bool] = None
    executive_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    scouting_points: Optional[List[ScoutingPoint]] = []
