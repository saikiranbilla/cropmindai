/**
 * @module InsuranceReport
 * @description The "Damage Dashboard" — a compact, scrollable view that
 * shows zone damage summaries, FCIC policy matches, and an interactive
 * action checklist. This is the first screen visible on the Report tab
 * before the user generates the full Claim Report.
 *
 * Follows the same architectural patterns as ClaimReport:
 * - Reads assessment data from AssessmentContext
 * - Delegates all data formatting to `src/utils/formatters.js`
 * - Delegates rendering to single-responsibility child components
 * - No hardcoded fallback data — empty states render when data is absent
 *
 * @see {@link module:ZoneDamageBreakdown}
 * @see {@link module:FCICPolicyList}
 * @see {@link module:ActionChecklist}
 */

import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useDemo } from '../context/AssessmentContext'
import {
  buildZoneSummaries,
  normalizeFcicMatches,
  normalizeActionItems,
} from '../utils/formatters'
import { ZoneDamageBreakdown } from './report'
import { FCICPolicyList } from './report'
import { ActionChecklist } from './report'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsuranceReport() {
  const { scenario, appData } = useDemo()

  // ── Derive header metadata (defensive, all optional-chained) ─────────────
  const claimId = appData?._raw?.assessment_id
    ? `CLM-${String(appData._raw.assessment_id).slice(0, 8).toUpperCase()}`
    : null
  const status = appData ? 'Pre-Qualification' : 'Awaiting Data'
  const lastUpdated = scenario?.weatherEvent?.dateOfLoss
    ? `${scenario.weatherEvent.dateOfLoss} · Field Unit 004`
    : null

  // ── Zone damage summaries ────────────────────────────────────────────────
  const sourcePoints = appData?.spatial?.data?.enrichedPoints
    ?? scenario?.scoutingPoints
    ?? []
  const damageSummary = buildZoneSummaries(sourcePoints)

  // ── FCIC policy matches (strict mapping, no hardcoded fallbacks) ─────────
  const fcicMatches = (() => {
    const liveSections = appData?.insurance?.matched_sections
    if (Array.isArray(liveSections) && liveSections.length > 0) {
      return normalizeFcicMatches(liveSections)
    }

    const rawMatches = appData?._raw?.insurance_matches
    if (Array.isArray(rawMatches) && rawMatches.length > 0) {
      return normalizeFcicMatches(rawMatches)
    }

    return []
  })()

  // ── Action items (strict mapping, no hardcoded fallbacks) ────────────────
  const actionItems = (() => {
    const liveInsurance = appData?.insurance
    const deadlines = Array.isArray(liveInsurance?.deadlines) ? liveInsurance.deadlines : []
    const liveActions = Array.isArray(liveInsurance?.action_items) ? liveInsurance.action_items : []
    const combined = [...deadlines, ...liveActions]

    if (combined.length > 0) {
      return normalizeActionItems(combined, deadlines.length)
    }

    return []
  })()

  // ── Derived counts for the progress bar ──────────────────────────────────
  const totalActions = actionItems.length

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg-base)] text-[var(--text-primary)]">

      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-4 pt-3 pb-3"
        style={{
          background: 'rgba(10,14,23,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1e2d4a',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1
              className="font-semibold"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '18px' }}
            >
              Damage Dashboard
            </h1>
            {(claimId || lastUpdated) && (
              <p
                className="mt-0.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {[claimId, lastUpdated].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
            {status}
          </span>
        </div>

        {/* Action completion progress (only shown when items exist) */}
        {totalActions > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all duration-500"
                style={{ width: '0%' }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 shrink-0">
              0/{totalActions} actions
            </span>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 px-4 pt-4 pb-36">

        {/* Zone Damage Cards */}
        <section>
          <ZoneDamageBreakdown zones={damageSummary} />
        </section>

        {/* FCIC Policy Match Cards */}
        <section>
          <FCICPolicyList matches={fcicMatches} />
        </section>

        {/* Action Checklist */}
        <section>
          <ActionChecklist items={actionItems} />
        </section>

        {/* Disclaimer */}
        <div
          className="rounded-[8px] p-[12px_16px] flex items-start gap-3 mt-4"
          style={{
            background: 'rgba(245,166,35,0.06)',
            borderLeft: '3px solid var(--accent-amber)',
          }}
        >
          <AlertTriangle
            size={14}
            style={{ color: 'var(--accent-amber)' }}
            className="shrink-0 mt-0.5"
          />
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            <span className="font-semibold text-white">Disclaimer: </span>
            {appData?.synthesis?.disclaimer
              ?? 'Pre-qualification assessment. Does not replace a licensed adjuster.'}
          </p>
        </div>

      </div>
    </div>
  )
}
