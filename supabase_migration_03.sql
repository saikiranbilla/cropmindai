-- Migration 03: Add insurance_matches JSONB column to persist the full
-- insurance agent output (matched_sections + action_items) from the pipeline.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS insurance_matches JSONB;
