import { useState } from 'react'
import { Layers, Map } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'
import { severityToBarPercent } from '../../utils/formatters'

// ─── Style Tokens ─────────────────────────────────────────────────────────────

/** @type {Record<string, Object>} Severity-keyed style map for zone cards. */
const DAMAGE_STYLES = {
    Severe: {
        topBorder: '#ef4444',
        badge: 'bg-red-500/10 text-red-400 border border-red-500/25',
        bar: '#ef4444',
        textColor: 'var(--accent-red)',
        badgeBg: 'rgba(255,77,77,0.12)',
        badgeBorder: 'rgba(255,77,77,0.25)',
        cardBg: 'rgba(255,77,77,0.05)',
        cardBorder: 'rgba(255,77,77,0.25)',
    },
    Moderate: {
        topBorder: '#f59e0b',
        badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
        bar: '#f59e0b',
        textColor: 'var(--accent-amber)',
        badgeBg: 'rgba(245,166,35,0.12)',
        badgeBorder: 'rgba(245,166,35,0.25)',
        cardBg: 'rgba(245,166,35,0.05)',
        cardBorder: 'rgba(245,166,35,0.25)',
    },
    Low: {
        topBorder: '#10b981',
        badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
        bar: '#10b981',
        textColor: 'var(--accent-primary)',
        badgeBg: 'rgba(0,229,160,0.10)',
        badgeBorder: 'rgba(0,229,160,0.20)',
        cardBg: 'rgba(0,229,160,0.05)',
        cardBorder: 'rgba(0,229,160,0.20)',
    },
}

// ─── Zone Card Sub-component ──────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.zone - Zone summary object.
 * @param {string} props.zone.name - Zone display name (e.g. "Zone A — Ridge").
 * @param {string} props.zone.zone - Alternate zone name field.
 * @param {'Severe'|'Moderate'|'Low'} props.zone.damage - Normalized severity.
 * @param {'Severe'|'Moderate'|'Low'} props.zone.severity - Alternate severity field.
 * @param {string} props.zone.type - Damage type label.
 * @param {string} props.zone.estLoss - Estimated yield loss string.
 * @param {number} [props.zone.points] - Number of scouting points in zone.
 * @param {string} [props.zone.notes] - Optional field notes.
 */
function ZoneCard({ zone }) {
    const [expanded, setExpanded] = useState(false)
    const severity = zone?.damage ?? zone?.severity ?? 'Low'
    const s = DAMAGE_STYLES[severity] ?? DAMAGE_STYLES.Low
    const pct = severityToBarPercent(severity)
    const displayName = zone?.name ?? zone?.zone ?? 'Unknown Zone'

    return (
        <div
            className="rounded-[12px] overflow-hidden print:rounded print:border-gray-200 transition-all duration-300"
            style={{
                background: s.cardBg,
                border: `1px solid ${s.cardBorder}`,
                borderTop: `3px solid ${s.topBorder}`,
            }}
        >
            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <p
                            className="font-semibold print:text-zinc-900"
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '14px',
                                color: 'var(--text-primary)',
                            }}
                        >
                            {displayName}
                        </p>
                        <p
                            className="mt-0.5 print:text-zinc-600"
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {zone?.type ?? '—'}
                            {zone?.points != null && (
                                <span
                                    className="ml-2"
                                    style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '10px',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    {zone.points} scout pts
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide print:border print:border-gray-300 print:text-zinc-700 print:bg-gray-100 ${s.badge}`}
                    >
                        {severity}
                    </span>
                </div>

                {/* Yield loss bar */}
                <div className="mb-3">
                    <div className="flex justify-between items-end mb-2">
                        <span
                            className="uppercase"
                            style={{
                                fontFamily: 'var(--font-sans)',
                                color: 'var(--text-muted)',
                                fontSize: '10px',
                                letterSpacing: '0.08em',
                            }}
                        >
                            Est. Yield Loss
                        </span>
                        <span
                            className="print:text-zinc-900"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                fontSize: '22px',
                                color: s.topBorder,
                                lineHeight: 1,
                            }}
                        >
                            {zone?.estLoss ?? '—'}
                        </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 print:bg-gray-200 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${pct}%`,
                                background: s.bar,
                                boxShadow: `0 0 6px ${s.bar}80`,
                            }}
                        />
                    </div>
                </div>

                {/* Expandable notes */}
                {zone?.notes && (
                    <>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="flex items-center gap-1 text-[11px] transition-colors hover:opacity-80"
                            style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}
                        >
                            {expanded ? '▴ Hide notes' : '▾ Field notes'}
                        </button>
                        {expanded && (
                            <p
                                className="mt-3 pt-3 text-[12px] leading-relaxed"
                                style={{
                                    color: 'var(--text-secondary)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    fontFamily: 'var(--font-sans)',
                                }}
                            >
                                {zone.notes}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * @module ZoneDamageBreakdown
 * @description Maps over flood/damage zones and renders a severity-coded card
 * for each. Accepts pre-built zone summaries from the parent. Shows an elegant
 * empty state when no zone data is available.
 *
 * @param {Object}   props
 * @param {Object[]} props.zones - Array of zone summary objects.
 * @param {string}   props.zones[].name - Zone display name.
 * @param {'Severe'|'Moderate'|'Low'} props.zones[].damage - Normalized severity.
 * @param {string}   props.zones[].type - Primary damage type.
 * @param {string}   props.zones[].estLoss - Estimated yield loss string.
 * @param {number}   [props.zones[].points] - Scouting point count for the zone.
 * @param {string}   [props.zones[].notes] - Expandable field notes.
 * @returns {JSX.Element}
 */
export default function ZoneDamageBreakdown({ zones }) {
    const hasZones = Array.isArray(zones) && zones.length > 0

    return (
        <SectionHeader
            icon={Layers}
            title="Damage by Zone"
            meta={hasZones ? `${zones.length} zones` : undefined}
        >
            {hasZones ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {zones.map((z, i) => (
                        <ZoneCard key={z?.name ?? z?.zone ?? i} zone={z} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={Map}
                    message="No zone damage data available"
                    description="Zone breakdowns will appear after the spatial analysis agent processes scouting points."
                />
            )}
        </SectionHeader>
    )
}
