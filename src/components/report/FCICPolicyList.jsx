import { FileText, BookOpen } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'
import { truncate, formatSimilarityPercent } from '../../utils/formatters'

// ─── Status Badge Styles ──────────────────────────────────────────────────────

/** @type {Record<string, { pill: string, dot: string }>} */
const FCIC_STATUS = {
    Triggered: { pill: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
    Potential: { pill: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30', dot: 'bg-yellow-400 animate-pulse' },
    Clear: { pill: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
}

// ─── Individual Policy Card ──────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.match - Normalized FCIC policy match object.
 * @param {string} props.match.code - Policy reference code.
 * @param {string} [props.match.section] - Section title.
 * @param {string} [props.match.title] - Policy title.
 * @param {'Triggered'|'Potential'|'Clear'} [props.match.status] - Match status.
 * @param {string} [props.match.detail] - Full policy text.
 * @param {number|null} [props.match.similarity] - Match similarity score (0–1).
 */
function FcicCard({ match }) {
    const s = FCIC_STATUS[match?.status] ?? FCIC_STATUS.Clear
    const simPercent = formatSimilarityPercent(match?.similarity)

    return (
        <div
            className="rounded-r-xl p-3.5 print:rounded print:border print:border-gray-200 print:mb-2 transition-all duration-300"
            style={{ background: '#18181b', borderLeft: '3px solid #10b981' }}
        >
            {/* Header: code + section + similarity + status */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span
                        className="px-2 py-0.5 rounded font-bold uppercase tracking-widest print:text-emerald-800"
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            color: '#10b981',
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.25)',
                        }}
                    >
                        {match?.code ?? 'FCIC'}
                    </span>
                    {match?.section && match.section !== match?.code && (
                        <span
                            className="print:text-zinc-700"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                color: 'rgba(16,185,129,0.55)',
                            }}
                        >
                            {truncate(match.section)}
                        </span>
                    )}
                    {simPercent != null && (
                        <span
                            className="ml-auto print:text-zinc-500"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '8px',
                                color: '#52525b',
                            }}
                        >
                            MATCH: {simPercent}%
                        </span>
                    )}
                </div>
                <span
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${s.pill}`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {match?.status ?? 'Clear'}
                </span>
            </div>

            {/* Title (when distinct from code) */}
            {match?.title && match.title !== match?.code && (
                <p
                    className="mb-2"
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#34d399',
                    }}
                >
                    {match.title}
                </p>
            )}

            {/* Policy detail text */}
            {match?.detail && (
                <p
                    className="leading-relaxed print:text-zinc-800"
                    style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        lineHeight: 1.7,
                        color: '#f4f4f5',
                    }}
                >
                    {match.detail}
                </p>
            )}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * @module FCICPolicyList
 * @description Renders matched FCIC crop insurance policy sections from the
 * RAG-based insurance agent. Maps strictly to
 * `assessment.insurance_matches.matched_sections`. No hardcoded policy text.
 *
 * @param {Object}   props
 * @param {Object[]} props.matches - Array of normalized FCIC match objects.
 * @param {string}   props.matches[].code - Policy reference code (e.g. "457.8(b)(1)").
 * @param {string}   [props.matches[].section] - Section human-readable title.
 * @param {string}   [props.matches[].title] - Full policy title.
 * @param {'Triggered'|'Potential'|'Clear'} [props.matches[].status] - Match trigger status.
 * @param {string}   [props.matches[].detail] - Explanation / policy excerpt.
 * @param {number|null} [props.matches[].similarity] - Cosine similarity score (0–1).
 * @returns {JSX.Element}
 */
export default function FCICPolicyList({ matches }) {
    const hasMatches = Array.isArray(matches) && matches.length > 0

    return (
        <SectionHeader
            icon={FileText}
            title="FCIC Policy Matches"
            meta={hasMatches ? `${matches.length} matched` : undefined}
        >
            {hasMatches ? (
                <div className="flex flex-col gap-2.5 overflow-y-auto">
                    {matches.map((m, i) => (
                        <FcicCard key={m?.code ?? i} match={m} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={BookOpen}
                    message="No policy matches available"
                    description="FCIC policy matches will appear after the insurance RAG agent processes the assessment data."
                />
            )}
        </SectionHeader>
    )
}
