import os
from supabase import create_client, Client

# Load config from environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

def init_supabase() -> Client:
    """
    Initializes and returns the Supabase client using the official supabase-py SDK.
    Requires SUPABASE_URL and SUPABASE_SERVICE_KEY to be set in the environment.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables are missing.")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Export the initialized client
# Note: For safe module importing during dev/testing when env vars might be missing,
# we handle the initialization inside a try-except block.
try:
    supabase: Client = init_supabase()
except ValueError as e:
    supabase = None
    print(f"Warning: Database client not initialized. {e}")
