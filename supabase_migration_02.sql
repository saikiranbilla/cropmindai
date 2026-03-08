-- Migration 02: Add all columns required by the Phase 2.5 backend pipeline.
-- Run this in the Supabase SQL Editor against your project.
-- All statements use ALTER TABLE ... ADD COLUMN IF NOT EXISTS so they are safe
-- to re-run without error.

-- ── assessments: input columns written by create_assessment ───────────────────

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS photo_url      TEXT,
  ADD COLUMN IF NOT EXISTS photo_metadata JSONB;

-- weather_event_date in migration 01 is DATE; the backend now sends a full
-- ISO-8601 datetime string, so widen it to TIMESTAMPTZ.
-- (Safe no-op if already TIMESTAMPTZ.)
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'assessments' AND column_name = 'weather_event_date') = 'date' THEN
    ALTER TABLE assessments
      ALTER COLUMN weather_event_date TYPE TIMESTAMPTZ
        USING weather_event_date::TIMESTAMPTZ;
  END IF;
END $$;

-- user_id was NOT NULL in migration 01 but the backend omits it on insert.
-- Make it nullable so the pipeline doesn't fail on auth-less submissions.
ALTER TABLE assessments
  ALTER COLUMN user_id DROP NOT NULL;

-- ── assessments: output columns written by run_pipeline_bg ────────────────────

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS confidence          NUMERIC,
  ADD COLUMN IF NOT EXISTS conflict_flags      JSONB    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zone_summaries      TEXT,
  ADD COLUMN IF NOT EXISTS yield_loss_estimate TEXT,
  ADD COLUMN IF NOT EXISTS satellite_data      JSONB,
  ADD COLUMN IF NOT EXISTS pipeline_errors     JSONB    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
