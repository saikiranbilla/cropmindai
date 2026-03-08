// ─── Spatial Agent (pure logic — no LLM) ─────────────────────────────────────
//
// Clusters scouting points into damage zones using elevation + flood risk to
// separate low-lying depression zones from upland ridge zones, then applies
// Vision Agent defoliation data to score ridge severity.

const ELEVATION_THRESHOLD = 220 // metres — Champaign County topographic break

/**
 * Classifies a single scouting point into a zone and severity level.
 *
 * Elevation source priority:
 *   1. Per-point `elevation` field (if present)
 *   2. Environmental centroid elevation ± zone offset (zone B = −8m, zone A = +5m)
 *   3. Hard fallback of 215m (mid-range Champaign County)
 */
function classifyPoint(pt, defoliationPct, floodActive, baseElevation) {
  const zoneOffset   = (pt.zone === 'B') ? -8 : 5
  const ptElevation  = pt.elevation ?? (baseElevation + zoneOffset) ?? 215
  const isLowLying   = ptElevation < ELEVATION_THRESHOLD

  // Low-lying + active flood risk → depression / stand loss
  if (isLowLying && floodActive) {
    return {
      severity:     'high',
      assignedZone: 'Zone B (Depression)',
      zoneSummaryKey: 'B',
      elevation_est: ptElevation,
      reasoning:    `Low elevation (${ptElevation}m) with active flood risk. Ponding likely causing stand reduction.`,
    }
  }

  // Upland ridge → severity driven by Vision Agent defoliation %
  let severity = 'low'
  if      (defoliationPct > 50) severity = 'high'
  else if (defoliationPct > 30) severity = 'moderate'

  return {
    severity,
    assignedZone:   'Zone A (Ridge)',
    zoneSummaryKey: 'A',
    elevation_est:  ptElevation,
    reasoning:      `Upland position (${ptElevation}m). Defoliation at ${defoliationPct}% → ${severity} severity.`,
  }
}

/**
 * Builds a plain-language zone summary string for display in AgentCouncil
 * and the final report.
 */
function buildZoneSummary(zoneA, zoneB, defoliationPct, floodRisk, precipMm) {
  const parts = []

  if (zoneA.length) {
    const topSev = zoneA.some(p => p.severity === 'high') ? 'high' : 'moderate'
    parts.push(
      `Zone A (Ridge): ${zoneA.length} point(s) with ${topSev} severity defoliation` +
      ` (${defoliationPct}% leaf area loss per Vision Agent).`
    )
  }

  if (zoneB.length) {
    parts.push(
      `Zone B (Depression): ${zoneB.length} point(s) with high severity stand reduction.` +
      ` ${floodRisk} flood risk — ${precipMm}mm precipitation recorded.`
    )
  }

  return parts.join(' ')
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Pure-logic clustering agent — no API calls, always returns a result.
 *
 * @param {Array}  scoutingPoints    Raw GPS points from demoScenario / scouting capture
 * @param {object} visionData        Output from runVisionAgent
 * @param {object} environmentalData Output from runEnvironmentalAgent
 * @returns {{ success: boolean, data: object }}
 */
export function runSpatialAgent(scoutingPoints, visionData, environmentalData) {
  try {
    const floodRisk      = environmentalData?.flood_risk_score  ?? 'Low'
    const precipMm       = environmentalData?.precipitation_mm  ?? 0
    const baseElevation  = environmentalData?.elevation_m       ?? 215
    const defoliationPct = visionData?.defoliation_percent      ?? 0
    const floodActive    = floodRisk === 'High' || floodRisk === 'Moderate'

    // Enrich each scouting point with zone + severity classification
    const enrichedPoints = scoutingPoints.map(pt => ({
      ...pt,
      ...classifyPoint(pt, defoliationPct, floodActive, baseElevation),
    }))

    const zoneA = enrichedPoints.filter(p => p.zoneSummaryKey === 'A')
    const zoneB = enrichedPoints.filter(p => p.zoneSummaryKey === 'B')

    const zoneSummaries = buildZoneSummary(zoneA, zoneB, defoliationPct, floodRisk, precipMm)

    console.log(`📍 Spatial Agent: ${zoneA.length} Ridge pts, ${zoneB.length} Depression pts.`)

    return {
      success: true,
      data: {
        enrichedPoints,
        zoneSummaries,
        zoneACCount: zoneA.length,
        zoneBCount:  zoneB.length,
      },
    }
  } catch (err) {
    console.error('📍 Spatial Agent: Error during clustering.', err)
    // Return original points unmodified so the pipeline never crashes
    return {
      success: false,
      data: {
        enrichedPoints: scoutingPoints,
        zoneSummaries:  'Spatial clustering unavailable — using raw scouting data.',
        zoneACCount: 0,
        zoneBCount:  0,
      },
    }
  }
}
