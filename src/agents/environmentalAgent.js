// ─── Fallback data (Champaign County typical storm event) ────────────────────
// Returned any time an API call fails or times out so the orchestrator never crashes.
const FALLBACK = {
  precipitation_mm: 58.4,
  min_temp_c: 14.2,
  max_wind_kmh: 72.0,
  elevation_m: 213,
  flood_risk_score: 'Moderate',
  source: 'fallback',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

/**
 * fetch() with an AbortController timeout.
 * Throws if the request takes longer than `ms` milliseconds.
 */
async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Flood risk heuristic for Champaign County, IL.
 *
 * Champaign sits on a nearly flat glacial till plain (~213–228 m).
 * Low-lying zones (< 220 m) combined with significant rainfall
 * reliably produce ponding and stand loss — consistent with FCIC loss reports.
 */
function calcFloodRisk(elevationM, precipMm) {
  const lowElevation = elevationM < 220
  const heavyRain    = precipMm  > 50.8  // 2.0 inches
  const moderateRain = precipMm  > 25.4  // 1.0 inch

  if (lowElevation && heavyRain)    return 'High'
  if (lowElevation && moderateRain) return 'Moderate'
  if (heavyRain)                    return 'Moderate'
  return 'Low'
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Fetches real-world weather (Open-Meteo archive) and elevation (Open-Elevation)
 * for the given coordinates, then computes flood and wind risk.
 *
 * Both external calls run in parallel. Each has an independent try/catch so a
 * single API failure degrades gracefully rather than crashing the pipeline.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{
 *   precipitation_mm: number,
 *   min_temp_c: number,
 *   max_wind_kmh: number,
 *   elevation_m: number,
 *   flood_risk_score: 'High'|'Moderate'|'Low',
 *   source: 'live'|'partial'|'fallback'
 * }>}
 */
export async function runEnvironmentalAgent(lat, lng) {
  try {
    const today        = new Date()
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(today.getDate() - 3)

    const startDate = formatDate(threeDaysAgo)
    const endDate   = formatDate(today)

    const weatherUrl   = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum,temperature_2m_min,wind_speed_10m_max&timezone=America%2FChicago`
    const elevationUrl = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`

    // ── Parallel fetch — each failure is isolated ────────────────────────────
    const [weatherResult, elevationResult] = await Promise.allSettled([
      fetchWithTimeout(weatherUrl,   7000),
      fetchWithTimeout(elevationUrl, 7000),
    ])

    // ── Weather parsing ───────────────────────────────────────────────────────
    let precipMm   = FALLBACK.precipitation_mm
    let minTempC   = FALLBACK.min_temp_c
    let maxWindKmh = FALLBACK.max_wind_kmh
    let weatherOk  = false

    if (weatherResult.status === 'fulfilled') {
      try {
        const daily = weatherResult.value.daily
        precipMm   = (daily.precipitation_sum   ?? []).reduce((s, v) => s + (v ?? 0), 0)
        minTempC   = Math.min(...(daily.temperature_2m_min ?? [FALLBACK.min_temp_c]).filter(v => v != null))
        maxWindKmh = Math.max(...(daily.wind_speed_10m_max ?? [FALLBACK.max_wind_kmh]).filter(v => v != null))
        weatherOk  = true
        console.log('🌧️ Environmental Agent: Weather data fetched.', { precipMm, minTempC, maxWindKmh })
      } catch (parseErr) {
        console.warn('🌧️ Environmental Agent: Weather parse error, using fallback values.', parseErr)
      }
    } else {
      console.warn('🌧️ Environmental Agent: Weather API failed, using fallback values.', weatherResult.reason)
    }

    // ── Elevation parsing ─────────────────────────────────────────────────────
    let elevationM  = FALLBACK.elevation_m
    let elevationOk = false

    if (elevationResult.status === 'fulfilled') {
      try {
        elevationM  = elevationResult.value.results?.[0]?.elevation ?? FALLBACK.elevation_m
        elevationOk = true
        console.log('⛰️ Environmental Agent: Elevation fetched.', { elevationM })
      } catch (parseErr) {
        console.warn('⛰️ Environmental Agent: Elevation parse error, using fallback value.', parseErr)
      }
    } else {
      console.warn('⛰️ Environmental Agent: Elevation API failed, using fallback value.', elevationResult.reason)
    }

    const source = (weatherOk && elevationOk) ? 'live' : (weatherOk || elevationOk) ? 'partial' : 'fallback'

    return {
      precipitation_mm:  Math.round(precipMm   * 10) / 10,
      min_temp_c:        Math.round(minTempC   * 10) / 10,
      max_wind_kmh:      Math.round(maxWindKmh * 10) / 10,
      elevation_m:       Math.round(elevationM),
      flood_risk_score:  calcFloodRisk(elevationM, precipMm),
      source,
    }

  } catch (err) {
    // Outer catch — something unexpected broke before any fetch
    console.error('🌧️ Environmental Agent: Unexpected error, returning full fallback.', err)
    return FALLBACK
  }
}
