#!/usr/bin/env python3

"""

verify_phase1.py -- CropClaim AI Phase 1 automated verification suite.



Run from the backend/ directory:

    python verify_phase1.py



Tests

-----

1. Health Check         GET /health -> 200 + correct body

2. Supabase Connection  create_client -> list buckets -> confirm service key works

3. Storage Bucket       "scouting_photos" bucket exists (creates it if missing)

4. Assessments Table    "assessments" table is reachable (creates it if missing)

5. End-to-End Upload    POST /api/assessments -> 201 + assessment_id UUID



Remediation is applied automatically when possible (missing bucket /

missing table). Manual-intervention items are flagged clearly.

"""



from __future__ import annotations



import io

import json

import os

import sys

import textwrap

import traceback

import uuid

from typing import Callable



# -- Make sure we resolve imports from this directory -------------------------

sys.path.insert(0, os.path.dirname(__file__))



# -----------------------------------------------------------------------------

# Colour helpers

# -----------------------------------------------------------------------------

GREEN  = "\033[92m"

RED    = "\033[91m"

YELLOW = "\033[93m"

CYAN   = "\033[96m"

RESET  = "\033[0m"

BOLD   = "\033[1m"



def ok(msg: str)    -> None: print(f"  {GREEN}[PASS]{RESET} {msg}")

def fail(msg: str)  -> None: print(f"  {RED}[FAIL]{RESET} {msg}")

def warn(msg: str)  -> None: print(f"  {YELLOW}[WARN]{RESET} {msg}")

def info(msg: str)  -> None: print(f"  {CYAN}[INFO]{RESET} {msg}")

def header(msg: str)-> None: print(f"\n{BOLD}{msg}{RESET}")



# -----------------------------------------------------------------------------

# Test registry

# -----------------------------------------------------------------------------

results: list[tuple[str, bool, str]] = []   # (name, passed, detail)



def run_test(name: str, fn: Callable[[], None]) -> bool:

    header(f"[{len(results)+1}] {name}")

    try:

        fn()

        results.append((name, True, ""))

        return True

    except SystemExit:

        raise

    except Exception as exc:

        detail = traceback.format_exc()

        fail(str(exc))

        results.append((name, False, detail))

        return False



# -----------------------------------------------------------------------------

# 1. Health Check

# -----------------------------------------------------------------------------



def test_health_check() -> None:

    from fastapi.testclient import TestClient

    from app.main import app



    client = TestClient(app, raise_server_exceptions=True)

    resp = client.get("/health")



    assert resp.status_code == 200, (

        f"Expected 200, got {resp.status_code}\nBody: {resp.text}"

    )

    body = resp.json()

    assert body == {"status": "ok", "version": "2.0-flood"}, (

        f"Unexpected body: {body}"

    )

    ok(f"GET /health -> 200  body={body}")



# -----------------------------------------------------------------------------

# 2. Supabase Connection

# -----------------------------------------------------------------------------



def test_supabase_connection() -> None:

    from supabase import create_client

    from app.config import settings



    sb = create_client(settings.supabase_url, settings.supabase_service_key)



    # A lightweight RPC-free probe: list storage buckets (requires service role)

    try:

        buckets = sb.storage.list_buckets()

        bucket_names = [b.name for b in buckets]

        ok(f"Supabase client connected -- {len(buckets)} storage bucket(s) found")

        info(f"Buckets: {bucket_names or '(none yet)'}")

    except Exception as exc:

        raise RuntimeError(

            f"Supabase list_buckets() failed -- check SUPABASE_URL and "

            f"SUPABASE_SERVICE_KEY in .env\nDetail: {exc}"

        ) from exc



# -----------------------------------------------------------------------------

# 3. Storage Bucket -- auto-create if missing

# -----------------------------------------------------------------------------



BUCKET = "scouting_photos"



def test_storage_bucket() -> None:

    from supabase import create_client

    from app.config import settings



    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    buckets = sb.storage.list_buckets()

    bucket_names = [b.name for b in buckets]



    if BUCKET in bucket_names:

        ok(f"Bucket '{BUCKET}' already exists")

        return



    # Auto-remediate: create the bucket

    warn(f"Bucket '{BUCKET}' not found -- creating it now...")

    try:

        sb.storage.create_bucket(BUCKET, options={"public": False})

        ok(f"Bucket '{BUCKET}' created successfully")

    except Exception as exc:

        raise RuntimeError(

            f"Could not create bucket '{BUCKET}': {exc}\n"

            "Visit Supabase Dashboard -> Storage -> New bucket and create it manually."

        ) from exc



# -----------------------------------------------------------------------------

# 4. Assessments Table -- probe + auto-create DDL hint if missing

# -----------------------------------------------------------------------------



_CREATE_TABLE_SQL = textwrap.dedent("""

    -- Run this in Supabase Dashboard -> SQL Editor to create the assessments table:

    CREATE TABLE IF NOT EXISTS public.assessments (

        id                  TEXT        PRIMARY KEY,

        crop_type           TEXT        NOT NULL,

        weather_event_date  TIMESTAMPTZ NOT NULL,

        photo_url           TEXT,

        photo_metadata      JSONB,

        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

    );



    -- Enable Row Level Security (the service key bypasses it automatically)

    ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

""").strip()



def test_assessments_table() -> None:

    from supabase import create_client

    from app.config import settings



    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    project_ref = settings.supabase_url.split("//")[1].split(".")[0]

    dashboard_sql_url = f"https://supabase.com/dashboard/project/{project_ref}/sql/new"



    # Probe with a zero-row select -- if the table doesn't exist this raises

    try:

        result = sb.table("assessments").select("id").limit(1).execute()

        row_count = len(result.data)

        ok(f"'assessments' table reachable ({row_count} existing row(s) returned by probe)")

    except Exception as exc:

        error_str = str(exc).lower()

        if (

            "does not exist" in error_str

            or "42p01" in error_str

            or "relation" in error_str

            or "pgrst205" in error_str

            or "schema cache" in error_str

        ):

            warn("Table 'assessments' does not exist yet.")

            warn("Auto-remediation: cannot execute DDL via PostgREST (service key is read/write only).")

            print()

            print(f"  {YELLOW}ACTION REQUIRED (one-time, ~30 seconds):{RESET}")

            print(f"  1. Open: {CYAN}{dashboard_sql_url}{RESET}")

            print(f"  2. Paste and run migrations/001_create_assessments.sql")

            print(f"  3. Re-run: python verify_phase1.py")

            print()

            print(f"  {YELLOW}-- DDL (also saved to migrations/001_create_assessments.sql) --{RESET}")

            for line in _CREATE_TABLE_SQL.splitlines():

                print(f"    {line}")

            print()

            raise RuntimeError(

                "Table 'assessments' must be created via Supabase SQL Editor. "

                "Dashboard link and DDL printed above."

            ) from exc

        else:

            raise RuntimeError(f"Unexpected error probing 'assessments' table: {exc}") from exc



# -----------------------------------------------------------------------------

# 5. End-to-End Upload  POST /api/assessments

# -----------------------------------------------------------------------------



# Minimal 1x1 white JPEG (valid JFIF, 631 bytes)

_TINY_JPEG = bytes([

    0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,

    0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,

    0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,

    0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,0x24,0x2E,0x27,0x20,

    0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,

    0x39,0x3D,0x38,0x32,0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,

    0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,

    0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,

    0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,

    0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,0x01,0x02,0x03,0x00,

    0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,

    0x81,0x91,0xA1,0x08,0x23,0x42,0xB1,0xC1,0x15,0x52,0xD1,0xF0,0x24,0x33,0x62,0x72,

    0x82,0x09,0x0A,0x16,0x17,0x18,0x19,0x1A,0x25,0x26,0x27,0x28,0x29,0x2A,0x34,0x35,

    0x36,0x37,0x38,0x39,0x3A,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4A,0x53,0x54,0x55,

    0x56,0x57,0x58,0x59,0x5A,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6A,0x73,0x74,0x75,

    0x76,0x77,0x78,0x79,0x7A,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8A,0x92,0x93,0x94,

    0x95,0x96,0x97,0x98,0x99,0x9A,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xB2,

    0xB3,0xB4,0xB5,0xB6,0xB7,0xB8,0xB9,0xBA,0xC2,0xC3,0xC4,0xC5,0xC6,0xC7,0xC8,0xC9,

    0xCA,0xD2,0xD3,0xD4,0xD5,0xD6,0xD7,0xD8,0xD9,0xDA,0xE1,0xE2,0xE3,0xE4,0xE5,0xE6,

    0xE7,0xE8,0xE9,0xEA,0xF1,0xF2,0xF3,0xF4,0xF5,0xF6,0xF7,0xF8,0xF9,0xFA,0xFF,0xDA,

    0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0xFB,0xD2,0x8A,0x28,0x03,0xFF,0xD9,

])



def test_e2e_upload() -> None:

    from fastapi.testclient import TestClient

    from app.main import app



    client = TestClient(app, raise_server_exceptions=True)



    photo_metadata = json.dumps({

        "county_fips": "17019",

        "scouting_points": [

            {

                "id": 1,

                "lat": 40.1164,

                "lng": -88.2434,

                "severity": "high",

                "zone": "A",

                "damage_type": "Flood Inundation",

            }

        ],

    })



    resp = client.post(

        "/api/assessments",

        data={

            "crop_type": "corn",

            "weather_event_date": "2026-03-01T12:00:00Z",

            "photo_metadata": photo_metadata,

        },

        files={

            "photo": ("test_photo.jpg", io.BytesIO(_TINY_JPEG), "image/jpeg"),

        },

    )



    if resp.status_code != 201:

        body_text = resp.text

        # Surface Pydantic / FastAPI validation details

        try:

            detail = resp.json().get("detail", body_text)

        except Exception:

            detail = body_text

        raise AssertionError(

            f"Expected 201 Created, got {resp.status_code}\n"

            f"Response detail: {detail}"

        )



    body = resp.json()

    assessment_id = body.get("assessment_id", "")



    # Validate it's a UUID

    try:

        uuid.UUID(assessment_id)

    except ValueError:

        raise AssertionError(

            f"assessment_id is not a valid UUID: {assessment_id!r}"

        )



    ok(f"POST /api/assessments -> 201 Created")

    ok(f"assessment_id = {assessment_id}")

    if body.get("photo_url"):

        ok(f"photo_url     = {body['photo_url']}")

    else:

        warn("photo_url is None (photo upload failed non-fatally -- check bucket permissions)")



# -----------------------------------------------------------------------------

# Runner

# -----------------------------------------------------------------------------



TESTS: list[tuple[str, Callable[[], None]]] = [

    ("Health Check",          test_health_check),

    ("Supabase Connection",   test_supabase_connection),

    ("Storage Bucket",        test_storage_bucket),

    ("Assessments Table",     test_assessments_table),

    ("End-to-End Upload",     test_e2e_upload),

]



def main() -> None:

    print(f"\n{BOLD}{'='*60}{RESET}")

    print(f"{BOLD}  CropClaim AI -- Phase 1 Verification Suite{RESET}")

    print(f"{BOLD}{'='*60}{RESET}")



    stop_on_fail = False



    for name, fn in TESTS:

        passed = run_test(name, fn)

        if not passed and stop_on_fail:

            warn("Stopping early due to failure.")

            break



    # -- Summary ---------------------------------------------------------------

    passed_count = sum(1 for _, p, _ in results if p)

    total        = len(results)



    print(f"\n{BOLD}{'-'*60}{RESET}")

    print(f"{BOLD}  Results: {passed_count}/{total} tests passed{RESET}")

    print(f"{BOLD}{'-'*60}{RESET}")



    for name, passed, detail in results:

        status_str = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"

        print(f"  [{status_str}]  {name}")



    if passed_count < total:

        print(f"\n{RED}Some tests failed. See diagnostics above.{RESET}")

        sys.exit(1)

    else:

        print(f"\n{GREEN}{BOLD}All tests passed!{RESET}")

        sys.exit(0)





if __name__ == "__main__":

    main()

