import { callClaude } from './claudeClient'
import { insuranceKB } from '../data/insuranceKB'

// ─── Fallback (CCIP-SEC14 always surfaced so 72-hr deadline is never lost) ───
const FALLBACK = {
  matched_sections: [
    {
      reference: "CCIP Section 14",
      explanation: "You must formally notify your crop insurance agent within 72 hours of discovering damage. Do not abandon, destroy, or replant any portion of the crop without first obtaining written consent from your adjuster."
    }
  ],
  yield_loss_estimate: "Pending adjuster assessment",
  deadlines: ["Submit Notice of Loss within 72 hours of damage discovery"],
  action_items: [
    "Contact your AIP (Approved Insurance Provider) immediately",
    "Do not destroy or replant the crop without written adjuster consent",
    "Preserve representative sample areas for in-person appraisal"
  ],
  source: 'fallback'
}

const SYSTEM_PROMPT = `You are an expert FCIC crop insurance agent. You have been provided with physical field damage data, environmental context, and the exact federal policy sections that apply. Explain what these matched sections mean for the farmer in plain language, calculate a rough estimated yield loss, and provide strict action items.

OUTPUT FORMAT:
Output ONLY a raw JSON object with no markdown formatting, no code blocks, and no conversational text. Use this exact schema:
{
  "matched_sections": [
    { "reference": "CCIP Section 14", "explanation": "plain-language explanation" }
  ],
  "yield_loss_estimate": "10-15%",
  "deadlines": ["Submit Notice of Loss within 72 hours"],
  "action_items": ["Do not destroy crop without written consent"]
}`

// ─── Rule matching ────────────────────────────────────────────────────────────

function selectRules(visionData, environmentalData) {
  const matched = []

  // Always include the notification duties rule
  const ccip = insuranceKB.find(r => r.id === 'CCIP-SEC14')
  if (ccip) matched.push(ccip)

  // Defoliation rule — check vision agent damage_types array
  const damageTypes = visionData?.damage_types ?? []
  if (damageTypes.some(t => t.toLowerCase().includes('defoliation'))) {
    const hail = insuranceKB.find(r => r.id === 'FCIC-25080-EX15')
    if (hail) matched.push(hail)
  }

  // Replant/flood rule — check environmental flood risk
  const floodRisk = environmentalData?.flood_risk_score ?? ''
  if (floodRisk === 'High' || floodRisk === 'Moderate') {
    const replant = insuranceKB.find(r => r.id === 'FCIC-25370')
    if (replant) matched.push(replant)
  }

  return matched
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Filters the insurance knowledge base against real field and environmental data,
 * then asks Claude to synthesize matched rules into plain-language guidance.
 *
 * @param {object} visionData        Output from runVisionAgent  (damage_types, growth_stage, etc.)
 * @param {object} environmentalData Output from runEnvironmentalAgent (flood_risk_score, etc.)
 * @returns {Promise<{
 *   matched_sections: Array<{reference: string, explanation: string}>,
 *   yield_loss_estimate: string,
 *   deadlines: string[],
 *   action_items: string[],
 *   source: 'live'|'fallback'
 * }>}
 */
export async function runInsuranceAgent(visionData, environmentalData) {
  try {
    const matchedRules = selectRules(visionData, environmentalData)

    console.log(`📋 Insurance Agent: ${matchedRules.length} rule(s) matched:`, matchedRules.map(r => r.id))

    // Build the user message with all context Claude needs
    const userMessage = `
FIELD DAMAGE DATA (from Vision Agent):
${JSON.stringify(visionData, null, 2)}

ENVIRONMENTAL DATA (from Environmental Agent):
${JSON.stringify(environmentalData, null, 2)}

MATCHED FEDERAL POLICY SECTIONS:
${matchedRules.map(r => `[${r.reference}] ${r.title}\n${r.content}`).join('\n\n')}

Based strictly on the above, output the JSON assessment.`.trim()

    const responseText = await callClaude(SYSTEM_PROMPT, userMessage)

    if (!responseText) {
      throw new Error('Claude returned an empty response.')
    }

    // Strip markdown code fences if Claude adds them despite instructions
    const clean = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(clean)

    console.log('📋 Insurance Agent: Assessment complete.')

    return { ...parsed, source: 'live' }

  } catch (err) {
    console.error('📋 Insurance Agent: Error, returning CCIP-SEC14 fallback.', err)
    return FALLBACK
  }
}
