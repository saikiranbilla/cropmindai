import { useState, useEffect } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, CloudLightning, TrendingDown,
  BookOpen, ChevronDown, ChevronUp, Square, CheckSquare,
} from 'lucide-react'
import { useDemo } from '../context/AssessmentContext'

// ─── Scenario → Dashboard shape adapters ─────────────────────────────────────

function buildDamageSummary(scoutingPoints) {
  const groups = {}
  scoutingPoints.forEach(pt => {
    if (!groups[pt.zone]) groups[pt.zone] = []
    groups[pt.zone].push(pt)
  })
  const ZONE_LABELS = { A: 'Zone A — Ridge', B: 'Zone B — Depression' }
  return Object.entries(groups).map(([zone, pts]) => {
    const topSev = pts.some(p => p.severity === 'high') ? 'Severe'
      : pts.some(p => p.severity === 'medium') ? 'Moderate' : 'Low'
    const estLoss = topSev === 'Severe' ? '~45%' : topSev === 'Moderate' ? '~11%' : '~3%'
    return {
      zone: ZONE_LABELS[zone] ?? `Zone ${zone}`,
      severity: topSev,
      type: pts[0].damageType,
      estLoss,
      points: pts.length,
      notes: `${pts.length} scouting points. Primary damage: ${pts[0].damageType}. Highest severity: ${topSev}.`,
    }
  })
}

function buildFcicMatches(insuranceMatches) {
  const relevanceToStatus = { Critical: 'Triggered', High: 'Triggered', Medium: 'Potential', Low: 'Clear' }
  return insuranceMatches.map(m => ({
    code: m.reference,
    section: m.relevance,
    title: m.title,
    status: relevanceToStatus[m.relevance] ?? 'Potential',
    detail: m.explanation,
  }))
}

function buildActions(actionItems) {
  return actionItems.map((a, i) => ({
    id: i + 1,
    text: a.text,
    deadline: a.urgent ? 'Within 72 hrs' : 'Ongoing',
    urgency: a.urgent ? 'critical' : 'medium',
  }))
}

// ─── Demo FCIC matches (shown when no live pipeline data is available) ─────────
const DEMO_FCIC_MATCHES = [
  {
    code:   '457.8(b)(1)',
    section: 'Prevented Planting — Flood',
    title:  'Prevented Planting — Flood',
    status: 'Triggered',
    detail: 'An indemnity is owed when the insured is prevented from planting the insured crop on acreage by the final planting date due to an insured cause of loss — including excess moisture or flooding — that is general in the area. The insured must provide evidence that other producers in the area were also prevented from planting.',
  },
  {
    code:   '457.8(b)(3)',
    section: 'Stand Loss — Pre-V6 Corn',
    title:  'Stand Loss — Pre-V6 Corn',
    status: 'Potential',
    detail: 'For corn at or below the V6 growth stage, the growing point remains below the soil surface and the plant may recover from short-duration submersion. A stand-count inspection by an approved loss adjuster is required before any replanting indemnity is approved. Premature termination of the insured crop without consent forfeits coverage.',
  },
  {
    code:   '457.8(c)(2)',
    section: 'Replant — Notice Requirement',
    title:  'Replant — Notice Requirement',
    status: 'Potential',
    detail: 'The insured must notify the insurance company within 72 hours of discovering damage that may result in a replanting. The company must have the opportunity to inspect the damaged crop before any replanting occurs. Failure to provide timely notice may result in denial of the replanting payment.',
  },
]

const DEMO_ACTIONS = [
  { id: 1, text: 'File Notice of Loss with your AIP within 72 hours of damage discovery (FCIC §457.8 requirement).', deadline: 'Within 72 hrs', urgency: 'critical' },
  { id: 2, text: 'Do not replant or terminate the insured crop before the adjuster completes a stand-count inspection.', deadline: 'Before replanting', urgency: 'critical' },
  { id: 3, text: 'Document GPS-tagged photos of standing water, silt lines, and plant necrosis at each scouting point.', deadline: 'Ongoing', urgency: 'high' },
  { id: 4, text: 'Contact your FSA office to verify APH (Actual Production History) yield records for the affected unit.', deadline: 'Within 1 week', urgency: 'medium' },
]

// ─── Style maps ───────────────────────────────────────────────────────────────

const SEVERITY = {
  Severe: {
    textColor: 'var(--accent-red)', badgeBg: 'rgba(255,77,77,0.12)', badgeBorder: 'rgba(255,77,77,0.25)',
    cardBg: 'rgba(255,77,77,0.05)', cardBorder: 'rgba(255,77,77,0.25)', bar: 'var(--accent-red)', pct: 80
  },
  Moderate: {
    textColor: 'var(--accent-amber)', badgeBg: 'rgba(245,166,35,0.12)', badgeBorder: 'rgba(245,166,35,0.25)',
    cardBg: 'rgba(245,166,35,0.05)', cardBorder: 'rgba(245,166,35,0.25)', bar: 'var(--accent-amber)', pct: 45
  },
  Low: {
    textColor: 'var(--accent-primary)', badgeBg: 'rgba(0,229,160,0.10)', badgeBorder: 'rgba(0,229,160,0.20)',
    cardBg: 'rgba(0,229,160,0.05)', cardBorder: 'rgba(0,229,160,0.20)', bar: 'var(--accent-primary)', pct: 15
  },
}

const FCIC_STATUS = {
  Triggered: { pill: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
  Potential: { pill: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30', dot: 'bg-yellow-400 animate-pulse' },
  Clear: { pill: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
}

const URGENCY = {
  critical: { label: 'Urgent', textColor: 'text-red-400', bg: 'bg-red-500/10 border border-red-500/20', icon: 'text-red-400' },
  high: { label: 'High', textColor: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/20', icon: 'text-orange-400' },
  medium: { label: 'Medium', textColor: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20', icon: 'text-yellow-300' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, meta }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <div className="flex items-center gap-2 shrink-0">
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        <h2 className="uppercase" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          {title}
        </h2>
      </div>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      {meta && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{meta}</span>}
    </div>
  )
}

function DamageCard({ zone }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEVERITY[zone.severity] ?? SEVERITY.Low

  return (
    <div
      className="rounded-[12px] p-[20px] transition-all duration-300 relative"
      style={{ background: s.cardBg, border: `1px solid ${s.cardBorder}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[16px] font-[600]" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>{zone.zone}</p>
          <p className="mt-1" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {zone.type} <span className="mx-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{zone.points} scout pts</span>
          </p>
        </div>
        <span
          className="uppercase px-2.5 py-0.5 rounded-full"
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em',
            background: s.badgeBg, color: s.textColor, border: `1px solid ${s.badgeBorder}`
          }}
        >
          {zone.severity}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-end mb-2">
          <span className="uppercase" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.08em' }}>Est. Yield Loss</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '30px', color: s.textColor, lineHeight: 1 }}>{zone.estLoss}</span>
        </div>
        <div className="h-2 rounded-md bg-[var(--bg-elevated)] overflow-hidden">
          <div className="h-full rounded-md" style={{ width: `${s.pct}%`, background: s.bar, boxShadow: `0 0 8px ${s.bar}80` }} />
        </div>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[11px] transition-colors hover:opacity-80"
        style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Hide notes' : 'Field notes'}
      </button>
      {expanded && (
        <p className="mt-3 pt-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', fontFamily: 'var(--font-sans)' }}>
          {zone.notes}
        </p>
      )}
    </div>
  )
}

function FcicCard({ match }) {
  const s = FCIC_STATUS[match.status] ?? FCIC_STATUS.Clear

  return (
    <div
      className="rounded-[12px] p-[16px] transition-all duration-300"
      style={{ background: 'var(--bg-card)', borderLeft: '3px solid #10b981', border: '1px solid var(--border-subtle)', borderLeftWidth: '3px', borderLeftColor: '#10b981' }}
    >
      {/* Header row: reference code + status pill */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#10b981' }}>
            {match.code}
          </span>
          {match.section && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(16,185,129,0.55)' }}>
              {match.section}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${s.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {match.status}
        </span>
      </div>

      {/* Title (when different from code) */}
      {match.title && match.title !== match.code && (
        <p className="mb-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: '#34d399' }}>
          {match.title}
        </p>
      )}

      {/* Policy text — always visible, no accordion */}
      {match.detail && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.7, color: '#f4f4f5' }}>
          {match.detail}
        </p>
      )}
    </div>
  )
}

function ActionItem({ item, onToggle }) {
  const u = URGENCY[item.urgency] ?? URGENCY.medium

  return (
    <div className={`rounded-xl p-3 transition-opacity ${u.bg} ${item.done ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-2.5">
        <button onClick={() => onToggle(item.id)} className="mt-0.5 shrink-0 transition-transform active:scale-90">
          {item.done
            ? <CheckSquare size={15} className="text-green-400" />
            : <Square size={15} className={u.icon} />
          }
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-snug ${item.done ? 'line-through text-slate-500' : 'text-slate-100'}`}>
            {item.text}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock size={9} className={`shrink-0 ${item.done ? 'text-slate-600' : u.textColor}`} />
            <span className={`text-[10px] font-mono ${item.done ? 'text-slate-600' : u.textColor}`}>
              {item.deadline}
            </span>
            <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider ${item.done ? 'text-slate-600' : u.textColor}`}>
              {item.done ? 'Done' : u.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsuranceReport() {
  const { demoMode, scenario, appData } = useDemo()

  const claimId = 'CLM-2026-0314'
  const status = 'Pre-Qualification'
  const lastUpdated = `${scenario.weatherEvent.dateOfLoss} · Field Unit 004`

  // Use live pipeline data when available, fall back to demo scenario
  const liveInsurance = appData?.insurance
  const sourcePoints = appData?.spatial?.data?.enrichedPoints ?? scenario.scoutingPoints

  const damageSummary = buildDamageSummary(sourcePoints)

  // Always start with demo data; only replace when live arrays are non-empty
  let fcicMatches = DEMO_FCIC_MATCHES

  const liveSections = Array.isArray(liveInsurance?.matched_sections)
    ? liveInsurance.matched_sections.filter(m => m.reference || m.explanation)
    : []
  const rawMatches = Array.isArray(appData?._raw?.insurance_matches)
    ? appData._raw.insurance_matches.filter(m => m.policy || m.text)
    : []

  if (liveSections.length) {
    fcicMatches = liveSections.map(m => ({
      code:    m.reference   ?? 'FCIC',
      section: m.title       ?? '',
      title:   m.reference   ?? '',
      status:  'Triggered',
      detail:  m.explanation ?? '',
    }))
  } else if (rawMatches.length) {
    fcicMatches = rawMatches.map(m => ({
      code:    m.policy   ?? 'FCIC',
      section: m.section  ?? '',
      title:   m.policy   ?? '',
      status:  'Triggered',
      detail:  m.text     ?? '',
    }))
  }

  // Same pattern for actions: demo by default, override only when live has content
  let actions = DEMO_ACTIONS

  const liveActionItems = [
    ...(Array.isArray(liveInsurance?.deadlines)    ? liveInsurance.deadlines    : []),
    ...(Array.isArray(liveInsurance?.action_items) ? liveInsurance.action_items : []),
  ]
  if (liveActionItems.length) {
    actions = liveActionItems.map((text, i) => ({
      id:       i + 1,
      text:     typeof text === 'string' ? text : String(text),
      deadline: i < (liveInsurance?.deadlines?.length ?? 0) ? 'Urgent' : 'See report',
      urgency:  i < (liveInsurance?.deadlines?.length ?? 0) ? 'critical' : 'high',
    }))
  }

  const [checklist, setChecklist] = useState(() => actions.map(a => ({ ...a, done: false })))

  // Re-initialize checklist when live pipeline data arrives
  useEffect(() => {
    setChecklist(actions.map(a => ({ ...a, done: false })))
  }, [liveInsurance]) // eslint-disable-line react-hooks/exhaustive-deps

  const completedCount = checklist.filter(a => a.done).length

  function toggleAction(id) {
    setChecklist(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a))
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg-base)] text-[var(--text-primary)]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-4 pt-3 pb-3"
        style={{ background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d4a' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-semibold" style={{ fontFamily: 'var(--font-sans)', fontSize: '18px' }}>Damage Dashboard</h1>
            <p className="mt-0.5" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{claimId} · {lastUpdated}</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
            {status}
          </span>
        </div>

        {/* Action completion progress */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all duration-500"
              style={{ width: `${(completedCount / checklist.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {completedCount}/{checklist.length} actions
          </span>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 px-4 pt-4 pb-36">

        {/* Damage Summary Cards */}
        <section>
          <SectionHeader icon={CloudLightning} title="Damage by Zone" meta={`${damageSummary.length} zones`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {damageSummary.map(z => <DamageCard key={z.zone} zone={z} />)}
          </div>
        </section>

        {/* FCIC Policy Match Cards */}
        <section>
          <SectionHeader icon={BookOpen} title="FCIC Policy Matches" meta={`${fcicMatches.length} matched`} />
          <div className="flex flex-col gap-2">
            {fcicMatches.map(m => <FcicCard key={m.code} match={m} />)}
          </div>
        </section>

        {/* Action Checklist */}
        <section>
          <SectionHeader
            icon={CheckCircle}
            title="Action Checklist"
            meta={`${completedCount}/${checklist.length} complete`}
          />
          <div className="flex flex-col gap-2">
            {checklist.map(a => <ActionItem key={a.id} item={a} onToggle={toggleAction} />)}
          </div>
        </section>

        {/* Disclaimer */}
        <div
          className="rounded-[8px] p-[12px_16px] flex items-start gap-3 mt-4"
          style={{ background: 'rgba(245,166,35,0.06)', borderLeft: '3px solid var(--accent-amber)' }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--accent-amber)' }} className="shrink-0 mt-0.5" />
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
            <span className="font-semibold text-white">Disclaimer: </span>
            Pre-qualification assessment, does not replace licensed adjuster.
          </p>
        </div>

      </div>
    </div>
  )
}
