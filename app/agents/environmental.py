import httpx
from datetime import datetime, timedelta
from typing import Dict, Any

async def run_flood_environmental(state: Any) -> Dict[str, Any]:
    """
    Fetches real-world environmental data (7 day trailing precipitation, soil moisture)
    and strictly-fallback-protected elevation based on the centroid of the scouting points.
    Returns a dict to update 'environmental_data' in the LangGraph state.
    """
    scouting_points = state.get("scouting_points", []) if isinstance(state, dict) else getattr(state, "scouting_points", [])
    if not scouting_points:
        return {"environmental_data": {"error": "No scouting points available to center query."}}

    # Calculate geographic centroid to query localized weather APIs
    lats = [p.get("lat", p.get("latitude")) if isinstance(p, dict) else getattr(p, "latitude", getattr(p, "lat", None)) for p in scouting_points]
    lons = [p.get("lon", p.get("longitude")) if isinstance(p, dict) else getattr(p, "longitude", getattr(p, "lon", None)) for p in scouting_points]
    
    lats = [lat for lat in lats if lat is not None]
    lons = [lon for lon in lons if lon is not None]

    if not lats or not lons:
        return {"environmental_data": {"error": "Scouting points missing required coordinates."}}

    centroid_lat = sum(lats) / len(lats)
    centroid_lon = sum(lons) / len(lons)

    # Use the assessment event date if present, otherwise default to yesterday
    event_date_val = state.get("weather_event_date") if isinstance(state, dict) else getattr(state, "weather_event_date", None)
    if not event_date_val:
        event_date = datetime.now() - timedelta(days=1)
        event_date_str = event_date.strftime("%Y-%m-%d")
    else:
        # Handle if date arrives as string or date object
        if isinstance(event_date_val, str):
            event_date = datetime.strptime(event_date_val, "%Y-%m-%d")
            event_date_str = event_date_val
        else:
            event_date = event_date_val
            event_date_str = event_date.strftime("%Y-%m-%d")

    # We want a 7-day query ending on the weather event date
    start_date = event_date - timedelta(days=6)
    start_date_str = start_date.strftime("%Y-%m-%d")

    env_data = {
        "centroid_lat": centroid_lat,
        "centroid_lon": centroid_lon,
        "date_queried": event_date_str,
        "date_queried_start": start_date_str,
        "elevation_m": 213.0, # Default fallback (Champaign County baseline)
        "precipitation_7d_mm": 0.0,
        "soil_moisture_0_to_7cm_mean": 0.0,
        "estimated_submersion_hours": 0.0
    }

    async with httpx.AsyncClient() as client:
        # 1. Fetch Topography/Elevation from Open-Elevation API
        try:
            elevation_url = f"https://api.open-elevation.com/api/v1/lookup?locations={centroid_lat},{centroid_lon}"
            elev_resp = await client.get(elevation_url, timeout=5.0)
            elev_resp.raise_for_status()
            
            data = elev_resp.json()
            if "results" in data and len(data["results"]) > 0:
                env_data["elevation_m"] = data["results"][0]["elevation"]
        except Exception as e:
            # Fallback to 213m so demo never crashes
            print(f"Open-Elevation fallback triggered (error: {e}). Defaulting to 213m.")
            env_data["elevation_m"] = 213.0

        # 2. Fetch 7-day Historical Weather/Soil data from Open-Meteo Archive API
        try:
            weather_url = (
                f"https://archive-api.open-meteo.com/v1/archive"
                f"?latitude={centroid_lat}&longitude={centroid_lon}"
                f"&start_date={start_date_str}&end_date={event_date_str}"
                f"&daily=precipitation_sum,soil_moisture_0_to_7cm_mean"
                f"&timezone=auto"
            )
            weather_resp = await client.get(weather_url, timeout=8.0)
            weather_resp.raise_for_status()
            w_data = weather_resp.json()
            
            if "daily" in w_data:
                daily = w_data["daily"]
                
                # Sum precip over the 7 days
                if "precipitation_sum" in daily:
                    valid_precip = [p for p in daily["precipitation_sum"] if p is not None]
                    env_data["precipitation_7d_mm"] = sum(valid_precip)
                
                # Average soil moisture over the 7 days
                if "soil_moisture_0_to_7cm_mean" in daily:
                    valid_sm = [sm for sm in daily["soil_moisture_0_to_7cm_mean"] if sm is not None]
                    if valid_sm:
                        env_data["soil_moisture_0_to_7cm_mean"] = sum(valid_sm) / len(valid_sm)

            # Heuristic calculation for estimated submersion hours based on 7-day aggregate
            precip = env_data["precipitation_7d_mm"]
            soil = env_data["soil_moisture_0_to_7cm_mean"]
            
            if precip > 50 and soil > 0.40:
                env_data["estimated_submersion_hours"] = 72.0
            elif precip > 25 and soil > 0.35:
                env_data["estimated_submersion_hours"] = 24.0
            elif precip > 10:
                env_data["estimated_submersion_hours"] = 6.0
            else:
                env_data["estimated_submersion_hours"] = 0.0

        except Exception as e:
            print(f"Open-Meteo historical request failed: {e}")
            env_data["weather_error"] = str(e)

    return {"environmental_data": env_data}
