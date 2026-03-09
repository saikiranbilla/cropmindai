import { Bot, FileSearch } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'
import { formatConfidencePercent } from '../../utils/formatters'

/**
 * @module ExecutiveSummaryCard
 * @description Displays the AI-generated executive summary and confidence
 * score. Maps strictly to `assessment.synthesis.executive_summary` and
 * `assessment.synthesis.overall_confidence`.
 *
 * @param {Object}  props
 * @param {string|null|undefined}  props.summary - Executive summary text from the synthesis agent.
 * @param {number|null|undefined}  props.confidence - Overall confidence score (0–1).
 * @returns {JSX.Element}
 */
export default function ExecutiveSummaryCard({ summary, confidence }) {
    const hasSummary = typeof summary === 'string' && summary.trim().length > 0

    return (
        <SectionHeader icon={Bot} title="Executive Summary">
            {hasSummary ? (
                <>
                    <div className="rounded-[10px] p-4 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                        <p
                            className="leading-relaxed print:text-zinc-800"
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '13px',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            {summary}
                        </p>
                    </div>

                    {confidence != null && (
                        <div className="mt-3 flex items-center gap-3">
                            <span
                                className="uppercase tracking-widest print:text-zinc-600"
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '9px',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                AI Confidence
                            </span>
                            <div className="flex-1 h-1 rounded-full bg-zinc-800 print:bg-gray-200 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                                />
                            </div>
                            <span
                                className="print:text-emerald-800"
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10px',
                                    color: '#34d399',
                                }}
                            >
                                {formatConfidencePercent(confidence)}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <EmptyState
                    icon={FileSearch}
                    message="No executive summary available"
                    description="Summary will appear here once the AI synthesis agent completes its analysis."
                />
            )}
        </SectionHeader>
    )
}
