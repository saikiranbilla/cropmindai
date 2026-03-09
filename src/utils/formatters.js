/**
 * @module formatters
 * @description Pure, testable utility functions for data formatting,
 * percentage calculations, and coordinate manipulation used throughout
 * the report UI. Extracting these from JSX keeps components declarative
 * and makes business logic independently unit-testable.
 */

// ─── Date & Time ──────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string into a human-readable US date.
 * Returns a dash placeholder when the input is falsy.
 *
 * @param {string|null|undefined} isoString - ISO 8601 date string.
 * @param {Intl.DateTimeFormatOptions} [opts] - Override formatting options.
 * @returns {string} Formatted date string, e.g. "March 8, 2026".
 *
 * @example
 * formatDate('2026-03-08T12:00:00Z') // → 'March 8, 2026'
 * formatDate(null)                    // → '—'
 */
export function formatDate(isoString, opts) {
    if (!isoString) return '—'
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            ...opts,
        })
    } catch {
        return '—'
    }
}

// ─── Numeric Formatting ───────────────────────────────────────────────────────

/**
 * Formats a 0–1 confidence float as a whole-number percentage string.
 *
 * @param {number|null|undefined} confidence - Value between 0 and 1.
 * @returns {string} e.g. "87%" or "—" when unavailable.
 *
 * @example
 * formatConfidencePercent(0.872) // → '87%'
 * formatConfidencePercent(null)  // → '—'
 */
export function formatConfidencePercent(confidence) {
    if (confidence == null || typeof confidence !== 'number') return '—'
    return `${(confidence * 100).toFixed(0)}%`
}

/**
 * Formats a soil moisture value (m³/m³) as an integer percentage.
 *
 * @param {number|null|undefined} moisture - Volumetric soil moisture (0–1 range).
 * @returns {number|null} Integer percentage or null if unavailable.
 *
 * @example
 * formatSoilMoisturePercent(0.42) // → 42
 * formatSoilMoisturePercent(null) // → null
 */
export function formatSoilMoisturePercent(moisture) {
    if (moisture == null || typeof moisture !== 'number') return null
    return Math.round(moisture * 100)
}

/**
 * Formats a precipitation value as a string with one decimal place.
 *
 * @param {number|string|null|undefined} mm - Precipitation in millimeters.
 * @returns {string} Formatted string, e.g. "70.8", or "—" if unavailable.
 *
 * @example
 * formatPrecipMm(70.83) // → '70.8'
 * formatPrecipMm('70.8') // → '70.8'
 */
export function formatPrecipMm(mm) {
    if (mm == null) return '—'
    if (typeof mm === 'number') return mm.toFixed(1)
    return String(mm)
}

/**
 * Formats a similarity score (0–1) as a rounded percentage integer.
 *
 * @param {number|null|undefined} similarity
 * @returns {string|null} e.g. "91" or null if unavailable.
 */
export function formatSimilarityPercent(similarity) {
    if (similarity == null || typeof similarity !== 'number') return null
    return (similarity * 100).toFixed(0)
}

// ─── Coordinate Formatting ────────────────────────────────────────────────────

/**
 * Formats a latitude/longitude pair into a compact display string.
 *
 * @param {number|string|null} lat
 * @param {number|string|null} lng
 * @returns {string} e.g. "40.1098, -88.2410" or "—"
 */
export function formatCoordinates(lat, lng) {
    if (lat == null || lng == null) return '—'
    return `${lat}, ${lng}`
}

// ─── Severity / Yield-Loss Mapping ────────────────────────────────────────────

/**
 * Maps a raw severity string (from scouting data) to a normalized display label.
 *
 * @param {'high'|'medium'|'moderate'|'low'|string} raw - Raw severity value.
 * @returns {'Severe'|'Moderate'|'Low'} Normalized severity label.
 *
 * @example
 * normalizeSeverity('high')     // → 'Severe'
 * normalizeSeverity('moderate') // → 'Moderate'
 */
export function normalizeSeverity(raw) {
    const lower = String(raw ?? '').toLowerCase()
    if (lower === 'high' || lower === 'severe') return 'Severe'
    if (lower === 'medium' || lower === 'moderate') return 'Moderate'
    return 'Low'
}

/**
 * Derives the estimated yield loss percentage text from a severity label.
 * This is a heuristic approximation used for pre-qualification dashboards.
 *
 * @param {'Severe'|'Moderate'|'Low'} severity - Normalized severity.
 * @returns {string} e.g. "~45%", "~11%", "~3%"
 */
export function estimateYieldLoss(severity) {
    switch (severity) {
        case 'Severe': return '~45%'
        case 'Moderate': return '~11%'
        default: return '~3%'
    }
}

/**
 * Returns the numeric bar width percentage for a severity level.
 *
 * @param {'Severe'|'Moderate'|'Low'} severity
 * @returns {number} Percentage value (0–100).
 */
export function severityToBarPercent(severity) {
    switch (severity) {
        case 'Severe': return 80
        case 'Moderate': return 45
        default: return 15
    }
}

// ─── Scouting Point Aggregation ───────────────────────────────────────────────

/**
 * Groups an array of scouting points by zone and builds a damage summary
 * for each zone. Pure function — no side effects.
 *
 * @param {Object[]} scoutingPoints - Array of scouting point objects.
 * @param {string}   scoutingPoints[].zone - Zone identifier (e.g. "A", "B").
 * @param {string}   scoutingPoints[].severity - Raw severity string.
 * @param {string}   scoutingPoints[].damageType - Damage type label.
 * @param {string}   [scoutingPoints[].assignedZone] - Optional pre-assigned zone name.
 * @returns {Object[]} Array of zone summary objects.
 */
export function buildZoneSummaries(scoutingPoints) {
    if (!Array.isArray(scoutingPoints) || scoutingPoints.length === 0) return []

    const ZONE_LABELS = { A: 'Zone A — Ridge', B: 'Zone B — Depression' }
    const groups = {}

    scoutingPoints.forEach(pt => {
        const key = pt.assignedZone ?? pt.zone ?? 'Unknown'
        if (!groups[key]) groups[key] = []
        groups[key].push(pt)
    })

    return Object.entries(groups).map(([zone, pts]) => {
        const topSev = pts.some(p => normalizeSeverity(p.severity) === 'Severe')
            ? 'Severe'
            : pts.some(p => normalizeSeverity(p.severity) === 'Moderate')
                ? 'Moderate'
                : 'Low'

        return {
            zone: ZONE_LABELS[zone] ?? zone,
            name: ZONE_LABELS[zone] ?? zone,
            severity: topSev,
            damage: topSev,
            type: pts[0]?.damageType ?? '—',
            estLoss: estimateYieldLoss(topSev),
            points: pts.length,
            notes: `${pts.length} scouting points. Primary damage: ${pts[0]?.damageType ?? 'Unknown'}. Highest severity: ${topSev}.`,
        }
    })
}

// ─── FCIC / Insurance Match Normalization ─────────────────────────────────────

/**
 * Normalizes raw backend insurance match objects into a uniform shape
 * consumed by the FCIC policy list UI.
 *
 * @param {Object[]} rawMatches - Array from `assessment.insurance_matches.matched_sections`
 *                                or `assessment._raw.insurance_matches`.
 * @returns {Object[]} Normalized policy match objects.
 */
export function normalizeFcicMatches(rawMatches) {
    if (!Array.isArray(rawMatches) || rawMatches.length === 0) return []

    return rawMatches
        .filter(m => m.reference || m.explanation || m.policy || m.text)
        .map(m => ({
            code: m.reference ?? m.policy ?? 'FCIC',
            section: m.title ?? m.section ?? '',
            title: m.reference ?? m.policy ?? '',
            status: m.status ?? 'Triggered',
            detail: m.explanation ?? m.text ?? '',
            similarity: m.similarity ?? null,
        }))
}

/**
 * Normalizes raw backend action items into a uniform shape
 * consumed by the action checklist UI.
 *
 * @param {Array<string|Object>} items - Array of action items (strings or objects).
 * @param {number} [urgentCount=0] - Number of leading items to mark as 'critical'.
 * @returns {Object[]} Normalized action item objects.
 */
export function normalizeActionItems(items, urgentCount = 0) {
    if (!Array.isArray(items) || items.length === 0) return []

    return items.map((item, i) => ({
        id: i + 1,
        text: typeof item === 'string' ? item : item?.text ?? String(item),
        deadline: i < urgentCount ? 'Urgent' : (item?.deadline ?? 'See report'),
        urgency: i < urgentCount ? 'critical' : (item?.urgency ?? 'high'),
    }))
}

/**
 * Truncates a string to a maximum length, appending an ellipsis if needed.
 *
 * @param {string} str - Input string.
 * @param {number} [maxLen=70] - Maximum character length.
 * @returns {string} Truncated string.
 */
export function truncate(str, maxLen = 70) {
    if (!str || str.length <= maxLen) return str ?? ''
    return `${str.slice(0, maxLen)}…`
}
