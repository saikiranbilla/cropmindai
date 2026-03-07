import { useState } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, CloudLightning, TrendingDown,
  BookOpen, ChevronDown, ChevronUp, Square, CheckSquare,
} from 'lucide-react'
import { useDemo } from '../context/DemoContext'

// ─── Scenario → Dashboard shape adapters ─────────────────────────────────────

function buildDamageSummary(scoutingPoints) {
  const groups = {}
  scoutingPoints.forEach(pt => {
    if (!groups[pt.zone]) groups[pt.zone] = []
    groups[pt.zone].push(pt)
  })
  const ZONE_LABELS = { A: 'Zone A — Ridge', B: 'Zone B — Depression' }
  return Object.entries(groups).map(([zone, pts]) => {
    const topSev  = pts.some(p => p.severity === 'high')   ? 'Severe'
                  : pts.some(p => p.severity === 'medium') ? 'Moderate' : 'Low'
    const estLoss = topSev === 'Severe' ? '~45%' : topSev === 'Moderate' ? '~11%' : '~3%'
    return {
      zone:     ZONE_LABELS[zone] ?? `Zone ${zone}`,
      severity: topSev,
      type:     pts[0].damageType,
      estLoss,
      points:   pts.length,
      notes:    `${pts.length} scouting points. Primary damage: ${pts[0].damageType}. Highest severity: ${topSev}.`,
    }
  })
}

function buildFcicMatches(insuranceMatches) {
  const relevanceToStatus = { Critical: 'Triggered', High: 'Triggered', Medium: 'Potential', Low: 'Clear' }
  return insuranceMatches.map(m => ({
    code:    m.reference,
    section: m.relevance,
    title:   m.title,
    status:  relevanceToStatus[m.relevance] ?? 'Potential',
    detail:  m.explanation,
  }))
}

function buildActions(actionItems) {
  return actionItems.map((a, i) => ({
    id:       i + 1,
    text:     a.text,
    deadline: a.urgent ? 'Within 72 hrs' : 'Ongoing',
    urgency:  a.urgent ? 'critical' : 'medium',
  }))
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const SEVERITY = {
  Severe:   { badge: 'bg-red-500/15 text-red-400 border-red-500/30',          bar: 'bg-red-500',    pct: 80 },
  Moderate: { badge: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30', bar: 'bg-yellow-400', pct: 45 },
  Low:      { badge: 'bg-green-500/15 text-green-400 border-green-500/30',    bar: 'bg-green-500',  pct: 15 },
}

const FCIC_STATUS = {
  Triggered: { pill: 'bg-red-500/15 text-red-400 border-red-500/30',          dot: 'bg-red-400' },
  Potential: { pill: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30', dot: 'bg-yellow-400 animate-pulse' },
  Clear:     { pill: 'bg-green-500/15 text-green-400 border-green-500/30',    dot: 'bg-green-400' },
}

const URGENCY = {
  critical: { label: 'Urgent',  textColor: 'text-red-400',    bg: 'bg-red-500/10 border border-red-500/20',       icon: 'text-red-400'    },
  high:     { label: 'High',    textColor: 'text-orange-400', bg: 'bg-orange-500/10 border border-orange-500/20', icon: 'text-orange-400' },
  medium:   { label: 'Medium',  textColor: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20', icon: 'text-yellow-300' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, meta }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} className="text-slate-400 shrink-0" />
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      {meta && <span className="ml-auto text-[10px] text-slate-600 font-mono">{meta}</span>}
    </div>
  )
}

function DamageCard({ zone }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEVERITY[zone.severity] ?? SEVERITY.Low

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
      <div className={`h-0.5 ${s.bar}`} />
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-bold text-slate-100">{zone.zone}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{zone.type} · {zone.points} scout pts</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>
            {zone.severity}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2.5">
          <TrendingDown size={11} className="text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400">Est. Yield Loss</span>
          <span className="ml-auto font-mono text-sm font-bold text-slate-100">{zone.estLoss}</span>
        </div>

        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
          <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'Hide notes' : 'Field notes'}
        </button>
        {expanded && (
          <p className="mt-2 pt-2 text-xs text-slate-300 leading-relaxed border-t border-slate-800">
            {zone.notes}
          </p>
        )}
      </div>
    </div>
  )
}

function FcicCard({ match }) {
  const [expanded, setExpanded] = useState(false)
  const s = FCIC_STATUS[match.status] ?? FCIC_STATUS.Clear

  return (
    <div className="rounded-xl p-3.5" style={{ background: '#111827', border: '1px solid #1e2d4a' }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-bold text-blue-400 shrink-0">{match.code}</span>
          <span className="text-[10px] text-slate-600 truncate">{match.section}</span>
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${s.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {match.status}
        </span>
      </div>
      <p className="text-xs font-semibold text-slate-200 mb-2">{match.title}</p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expanded ? 'Collapse' : 'View policy detail'}
      </button>
      {expanded && (
        <p className="mt-2 pt-2 text-xs text-slate-300 leading-relaxed border-t border-slate-800">
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
  const { demoMode, scenario } = useDemo()

  const claimId     = 'CLM-2026-0314'
  const status      = 'Pre-Qualification'
  const lastUpdated = `${scenario.weatherEvent.dateOfLoss} · Field Unit 004`

  const damageSummary = demoMode ? buildDamageSummary(scenario.scoutingPoints) : []
  const fcicMatches   = demoMode ? buildFcicMatches(scenario.insuranceMatches)  : []
  const actions       = demoMode ? buildActions(scenario.actionItems)           : []

  const [checklist, setChecklist] = useState(() => actions.map(a => ({ ...a, done: false })))

  const completedCount = checklist.filter(a => a.done).length

  function toggleAction(id) {
    setChecklist(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a))
  }

  return (
    <div className="flex flex-col min-h-full" style={{ background: '#0a0e17' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-4 pt-3 pb-3"
        style={{ background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d4a' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-100">Damage Dashboard</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">{claimId} · {lastUpdated}</p>
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
      <div className="flex flex-col gap-5 px-4 pt-4 pb-6">

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
          className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: '#0d1220', border: '1px solid #1e2d4a' }}
        >
          <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-400">Disclaimer: </span>
            Pre-qualification assessment, does not replace licensed adjuster.
          </p>
        </div>

      </div>
    </div>
  )
}
