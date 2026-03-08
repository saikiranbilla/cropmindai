-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create ENUM for assessment status
CREATE TYPE assessment_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- 3. Create core assessments table
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    status assessment_status DEFAULT 'pending',
    field_name TEXT,
    county TEXT,
    crop_type TEXT,
    flood_pathway TEXT,
    weather_event_date DATE,
    total_field_acres NUMERIC,
    meets_pp_threshold BOOLEAN,
    executive_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create scouting_points table securely linked to assessments
CREATE TABLE scouting_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    photo_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    elevation_m NUMERIC,
    captured_at TIMESTAMPTZ,
    gps_source TEXT,
    crop_detected BOOLEAN,
    crop_type TEXT,
    growth_stage TEXT,
    standing_water BOOLEAN,
    alive_pct NUMERIC,
    dead_pct NUMERIC,
    severity TEXT,
    zone_id TEXT
);

-- 5. Create flood_zones table to hold analytical boundary and grouping data
CREATE TABLE flood_zones (
    id TEXT PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    zone_type TEXT CHECK (zone_type IN ('submerged', 'waterlogged', 'dry')),
    severity TEXT,
    elevation_min_m NUMERIC,
    estimated_acres NUMERIC,
    boundary_polygon JSONB,
    point_ids JSONB
);
