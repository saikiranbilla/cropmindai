-- Migration 001 — Create assessments table
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.assessments (
    id                  TEXT        PRIMARY KEY,
    crop_type           TEXT        NOT NULL,
    weather_event_date  TIMESTAMPTZ NOT NULL,
    photo_url           TEXT,
    photo_metadata      JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (service_role key bypasses it automatically)
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Optional: allow authenticated users to read their own assessments
-- CREATE POLICY "Users see own assessments"
--   ON public.assessments FOR SELECT
--   USING (auth.uid() IS NOT NULL);
