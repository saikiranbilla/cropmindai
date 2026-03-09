import { useState, useEffect, useCallback } from 'react'
import { ListChecks, ClipboardList } from 'lucide-react'
import SectionHeader from './SectionHeader'
import EmptyState from './EmptyState'

// ─── Custom Check Icon ────────────────────────────────────────────────────────

/**
 * SVG checkbox icon with checked/unchecked states.
 * @param {{ checked: boolean }} props
 */
function CheckIcon({ checked }) {
    return checked ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect width="18" height="18" rx="5" fill="#10b981" />
            <path d="M4.5 9L7.5 12L13.5 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="4.25" stroke="#3f3f46" strokeWidth="1.5" />
        </svg>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * @module ActionChecklist
 * @description Interactive checklist of immediate action items derived from
 * the insurance agent's output. Maps strictly to
 * `assessment.insurance_matches.action_items` and `assessment.insurance_matches.deadlines`.
 *
 * Tracks completion state locally. No hardcoded action items — renders an
 * elegant empty state when no items are available.
 *
 * @param {Object}   props
 * @param {Array<string|Object>} props.items - Array of action items.
 *   When items are strings, they are displayed directly.
 *   When items are objects, they should have a `text` (string) property.
 * @returns {JSX.Element}
 */
export default function ActionChecklist({ items }) {
    const hasItems = Array.isArray(items) && items.length > 0

    const [checked, setChecked] = useState(() =>
        new Array(hasItems ? items.length : 0).fill(false)
    )

    // Re-sync checked state when items change (e.g. live pipeline data arrives)
    useEffect(() => {
        if (hasItems) {
            setChecked(new Array(items.length).fill(false))
        }
    }, [items?.length]) // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = useCallback((i) => {
        setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
    }, [])

    const doneCount = checked.filter(Boolean).length

    return (
        <SectionHeader icon={ListChecks} title="Immediate Action Items">
            {hasItems ? (
                <div className="flex flex-col gap-2">
                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mb-1 print:hidden">
                        <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${(doneCount / items.length) * 100}%` }}
                            />
                        </div>
                        <span className="font-mono text-[9px] text-zinc-500 shrink-0">
                            {doneCount}/{items.length}
                        </span>
                    </div>

                    {/* Action items */}
                    <ul className="flex flex-col gap-1.5">
                        {items.map((item, i) => {
                            const text = typeof item === 'string' ? item : item?.text ?? String(item)
                            return (
                                <li key={i}>
                                    <button
                                        onClick={() => toggle(i)}
                                        className="w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all active:scale-[0.99] print:rounded print:border print:border-gray-200 print:mb-1"
                                        style={{
                                            background: checked[i] ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)',
                                            border: `1px solid ${checked[i] ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                                            opacity: checked[i] ? 0.5 : 1,
                                        }}
                                    >
                                        <span className="mt-0.5 shrink-0 print:hidden">
                                            <CheckIcon checked={checked[i]} />
                                        </span>
                                        <span
                                            className="text-[12px] leading-snug print:text-zinc-800"
                                            style={{
                                                color: 'var(--text-secondary)',
                                                textDecoration: checked[i] ? 'line-through' : 'none',
                                            }}
                                        >
                                            {text}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ) : (
                <EmptyState
                    icon={ClipboardList}
                    message="No action items available"
                    description="Required actions and deadlines will appear after the insurance agent completes its analysis."
                />
            )}
        </SectionHeader>
    )
}
