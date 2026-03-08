import { callClaude } from './claudeClient'

// Simply using a Map as an in-memory cache wrapper for demo continuity
const visionCache = new Map()

/**
 * Basic hashing for the cache key to prevent processing the exact same
 * images on back-to-back app hot-reloads during the hackathon.
 */
function hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
    }
    return hash.toString(16)
}

const SYSTEM_PROMPT = `You are a certified FCIC Loss Adjuster evaluating crop damage for a federal indemnity claim.

STAGING PROTOCOL:
You must use the "Horizontal Leaf" (or "Droopy Leaf") method to determine the growth stage. Count the lowest leaf with a rounded tip up to the highest leaf whose tip points below the horizontal plane. Do NOT use the V-stage (leaf collar) method.

DEFOLIATION PROTOCOL:
Tissue that is shredded or tattered but remains green and attached is capable of continued photosynthesis and must NOT be counted as destroyed. Only tissue that is missing, severed, or entirely necrotic (brown) can be calculated into the defoliation percentage.

OUTPUT FORMAT:
Output ONLY a raw JSON object with no markdown formatting, markdown blocks, or conversational text. Use this exact schema:
{
  "crop_type": "Corn",
  "growth_stage": "10-Leaf",
  "damage_types": ["Defoliation", "Stand Reduction"],
  "defoliation_percent": 45,
  "stand_loss_percent": 12,
  "confidence": 0.88,
  "reasoning": "Horizontal leaf method indicates 10-leaf stage. 45% of leaf tissue is entirely severed or necrotic. Shredded green tissue was excluded from defoliation count."
}`

export async function runVisionAgent(imagesBase64Array) {
    try {
        if (!imagesBase64Array || !imagesBase64Array.length) {
            throw new Error("No images provided to Vision Agent.")
        }

        // 1. Check Cache
        // We'll hash a chunk of the first image to make a reasonably unique key quickly.
        const sampleForHash = imagesBase64Array[0].substring(0, 1000) + imagesBase64Array.length
        const cacheKey = hashString(sampleForHash)

        if (visionCache.has(cacheKey)) {
            console.log('👁️ Vision Agent: Returning cached assessment (Demo Hack).')
            return { success: true, data: visionCache.get(cacheKey) }
        }

        console.log('👁️ Vision Agent: Calling Claude API...')

        // 2. Prepare User Request
        const userMessage = "Examine these field photos. Determine the crop damage solely based on the FCIC LASH protocols outlined. Output only the requested JSON."

        // 3. Fire Request
        const responseText = await callClaude(SYSTEM_PROMPT, userMessage, imagesBase64Array)

        if (!responseText) {
            throw new Error("Claude API returned an empty or failed response.")
        }

        // 4. Force strict JSON parsing
        // (LLMs sometimes wrap raw JSON in markdown backticks even when told not to)
        const cleanJsonText = responseText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim()

        const parsedData = JSON.parse(cleanJsonText)

        // 5. Store result in cache
        visionCache.set(cacheKey, parsedData)

        return {
            success: true,
            data: parsedData
        }
    } catch (error) {
        console.error("👁️ Vision Agent Error:", error)
        return {
            success: false,
            error: error.message
        }
    }
}
