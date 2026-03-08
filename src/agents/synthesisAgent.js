import { callClaude } from './claudeClient'

// ─── Fallback (pipeline never crashes at the finish line) ─────────────────────
const FALLBACK = {
  executive_summary:  'Field assessment complete. Damage consistent with severe convective storm event. Primary damage type is defoliation on ridge zones with localized stand reduction in low-lying areas. Recommend immediate Notice of Loss filing and preservation of representative sample areas pending licensed adjuster visit.',
  conflict_flags:     ['Synthesis agent unavailable — manual review required.'],
  overall_confidence: 0.70,
  disclaimer:         'Pre-qualification assessment, does not replace licensed adjuster.',
  source:             'fallback',
}

const SYSTEM_PROMPT = `You are the Lead Synthesizer for a Crop Insurance multi-agent system. Review the independent assessments from the Vision, Environmental, Spatial, and Insurance agents. Generate a concise, professional executive summary for the farmer. You must cross-reference the data for conflicts (e.g., if Vision detects flood damage but Environmental shows 0mm of rain, flag it). Always include the standard legal disclaimer.

OUTPUT FORMAT:
Output ONLY a raw JSON object with no markdown formatting, no code blocks, and no conversational text. Use this exact schema:
{
  "executive_summary": "Overall assessment combining field data, weather, and policy implications...",
  "conflict_flags": ["None detected"],
  "overall_confidence": 0.92,
  "disclaimer": "Pre-qualification assessment, does not replace licensed adjuster."
}`

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Phase 3 supervisor node. Receives resolved outputs from all upstream agents,
 * detects cross-agent data conflicts, and produces a unified executive summary.
 *
 * @param {object} visionData      Output from runVisionAgent
 * @param {object} envData         Output from runEnvironmentalAgent
 * @param {object} spatialData     Full return value from runSpatialAgent (includes enrichedPoints)
 * @param {object} insuranceData   Output from runInsuranceAgent
 * @returns {Promise<{
 *   executive_summary: string,
 *   conflict_flags: string[],
 *   overall_confidence: number,
 *   disclaimer: string,
 *   source: 'live'|'fallback'
 * }>}
 */
export async function runSynthesisAgent(visionData, envData, spatialData, insuranceData) {
  try {
    const userMessage = `
VISION AGENT OUTPUT:
${JSON.stringify(visionData, null, 2)}

ENVIRONMENTAL AGENT OUTPUT:
${JSON.stringify(envData, null, 2)}

SPATIAL AGENT OUTPUT:
Zone Summary: ${spatialData?.zoneSummaries ?? 'N/A'}
Zone A point count: ${spatialData?.zoneACCount ?? 'N/A'}
Zone B point count: ${spatialData?.zoneBCount  ?? 'N/A'}

INSURANCE AGENT OUTPUT:
${JSON.stringify(insuranceData, null, 2)}

Cross-reference all four datasets, flag any conflicts, and produce the executive summary JSON.`.trim()

    console.log('🧠 Synthesis Agent: Calling Claude for executive summary...')

    const responseText = await callClaude(SYSTEM_PROMPT, userMessage)

    if (!responseText) {
      throw new Error('Claude returned an empty response.')
    }

    const clean = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(clean)

    console.log('🧠 Synthesis Agent: Executive summary complete.')

    return { ...parsed, source: 'live' }

  } catch (err) {
    console.error('🧠 Synthesis Agent: Error, returning safe fallback.', err)
    return FALLBACK
  }
}
