import base64
import json
import httpx
from typing import Dict, Any
from anthropic import AsyncAnthropic
from app.config import ANTHROPIC_API_KEY

SYSTEM_PROMPT = """You are an FCIC loss adjuster. Look for standing water, mud/silt lines on stalks, and plant necrosis. Critical rule: For corn, if the plant is pre-V6 (fewer than 6 leaves), the growing point is underground. Do not classify pre-V6 plants as dead if the stalk base is firm, as they will likely recover. Rate plant status as alive, stressed, or dead.

OUTPUT FORMAT:
Output ONLY a raw JSON object with no markdown formatting, markdown blocks, or conversational text. Use this exact schema:
{
  "crop_detected": true,
  "plant_status": "stressed",
  "growth_stage_estimate": "V4",
  "growing_point_assessment": "underground",
  "standing_water_detected": true,
  "silt_line_visible": false,
  "estimated_survival_pct": 80,
  "reasoning": "Plant appears to be at V4 stage, so growing point is underground. Base is firm despite standing water, meaning it will likely recover."
}"""

async def _fetch_image_as_base64(client: httpx.AsyncClient, url: str) -> str:
    """Helper to download the image URL as base64 for Claude's payload."""
    try:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        return base64.b64encode(response.content).decode('utf-8')
    except Exception as e:
        print(f"Failed to fetch image from {url}: {e}")
        return None

async def run_flood_vision(state: Any) -> Dict[str, Any]:
    """
    Processes scouting point photos using Claude Vision to assess flood damage.
    Returns a dict to update 'vision_results' in the LangGraph state.
    """
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    
    # Handle dict or Pydantic state gracefully
    scouting_points = state.get("scouting_points", []) if isinstance(state, dict) else getattr(state, "scouting_points", [])
    if not scouting_points:
        return {"vision_results": []}

    results = []
    
    async with httpx.AsyncClient() as http_client:
        for point in scouting_points:
            point_id = point.get("id") if isinstance(point, dict) else getattr(point, "id", None)
            photo_url = point.get("photo_url") if isinstance(point, dict) else getattr(point, "photo_url", None)
            
            if not photo_url:
                continue

            # Fetch image and convert to base64
            img_b64 = await _fetch_image_as_base64(http_client, photo_url)
            if not img_b64:
                results.append({"point_id": point_id, "error": "Could not fetch image bytes."})
                continue

            # Best-effort MIME extraction
            media_type = "image/png" if photo_url.lower().endswith(".png") else "image/jpeg"

            try:
                response = await client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": img_b64,
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "Analyze this scouting photo for flood damage using the provided FCIC protocols. Output only JSON."
                                }
                            ]
                        }
                    ]
                )

                response_text = response.content[0].text
                
                # Strip potential markdown formatting applied by the LLM
                clean_json_text = response_text.replace("```json", "").replace("```", "").strip()
                parsed_data = json.loads(clean_json_text)
                
                results.append({
                    "point_id": point_id,
                    "assessment": parsed_data
                })

            except Exception as e:
                print(f"Claude Vision API Error for point {point_id}: {e}")
                results.append({
                    "point_id": point_id,
                    "error": str(e)
                })

    return {"vision_results": results}
