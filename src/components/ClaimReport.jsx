import { Download, MapPin, CloudLightning, Layers, Bot, BookOpen, ListChecks, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useDemo } from '../context/DemoContext'

function buildReportData(scenario) {
  const { fieldInfo, weatherEvent, agentOutputs, scoutingPoints, insuranceMatches, actionItems } = scenario

  // Derive zones from scoutingPoints
  const groups = {}
  scoutingPoints.forEach(pt => {
    if (!groups[pt.zone]) groups[pt.zone] = []
    groups[pt.zone].push(pt)
  })
  const ZONE_LABELS = { A: 'Zone A (Ridge)', B: 'Zone B (Depression)' }
  const zones = Object.entries(groups).map(([zone, pts]) => {
    const topSev  = pts.some(p => p.severity === 'high')   ? 'Severe'
                  : pts.some(p => p.severity === 'medium') ? 'Moderate' : 'Low'
    return {
      name:    ZONE_LABELS[zone] ?? `Zone ${zone}`,
      damage:  topSev,
      type:    pts[0].damageType,
      estLoss: topSev === 'Severe' ? '~45%' : topSev === 'Moderate' ? '~11%' : '~3%',
    }
  })

  return {
    meta: {
      date:        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      location:    fieldInfo.location,
      crop:        fieldInfo.crop,
      growthStage: fieldInfo.adjusterStage,
    },
    weather: {
      event:      weatherEvent.type,
      dateOfLoss: weatherEvent.dateOfLoss,
    },
    agentFindings: agentOutputs.synthesis,
    zones,
    fcicMatches: insuranceMatches.map(m => `${m.reference}: ${m.title}`),
    actions:     actionItems.map(a => a.text),
  }
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const card = 'rounded-2xl p-5 print:rounded-none print:border-0 print:p-0 print:mb-6'
const cardDark = `${card} bg-slate-900 print:bg-white`
const sectionTitle = 'flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-4 text-slate-400 print:text-slate-500'
const divider = 'border-t border-slate-800 print:border-slate-200 my-5'

const DAMAGE_STYLES = {
  Severe:   { badge: 'bg-red-500/15 text-red-400 border border-red-500/30',   bar: 'bg-red-500',    print: 'print:text-red-700' },
  Moderate: { badge: 'bg-yellow-400/15 text-yellow-300 border border-yellow-400/30', bar: 'bg-yellow-400', print: 'print:text-yellow-700' },
  Low:      { badge: 'bg-green-500/15 text-green-400 border border-green-500/30',  bar: 'bg-green-500',  print: 'print:text-green-700' },
}

// ─── Sub-sections ──────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h2 className={sectionTitle}>
        <Icon size={13} className="shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function MetaGrid({ meta, weather }) {
  const cells = [
    { label: 'Report Date',    value: meta.date },
    { label: 'Date of Loss',   value: weather.dateOfLoss },
    { label: 'Location',       value: meta.location },
    { label: 'Crop',           value: meta.crop },
    { label: 'Growth Stage',   value: meta.growthStage },
    { label: 'Peril',          value: weather.event },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl p-3 print:rounded-none print:border print:border-slate-200 print:p-2"
          style={{ background: '#0a0e17' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 print:text-slate-400 mb-0.5">{label}</p>
          <p className="text-xs font-semibold text-slate-100 print:text-slate-800 leading-snug">{value}</p>
        </div>
      ))}
    </div>
  )
}

function ZoneRow({ zone }) {
  const style = DAMAGE_STYLES[zone.damage] ?? DAMAGE_STYLES.Low
  const pct   = zone.damage === 'Severe' ? 80 : zone.damage === 'Moderate' ? 45 : 15

  return (
    <div
      className="rounded-xl p-3.5 print:rounded-none print:border print:border-slate-200 print:p-3 print:mb-2"
      style={{ background: '#0a0e17' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-bold text-slate-100 print:text-slate-800`}>{zone.name}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge} ${style.print} print:border print:bg-transparent`}>
          {zone.damage}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <p className="text-xs text-slate-400 print:text-slate-500">{zone.type}</p>
        <span className="text-slate-700 print:text-slate-300">·</span>
        <p className="text-xs font-mono font-semibold text-slate-200 print:text-slate-700">Est. Loss: {zone.estLoss}</p>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-800 print:bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${style.bar} print:opacity-70`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BulletList({ items, icon: Icon, iconClass }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <Icon size={14} className={`${iconClass} shrink-0 mt-0.5`} />
          <span className="text-sm text-slate-200 print:text-slate-700 leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ClaimReport() {
  const { demoMode, scenario, appData } = useDemo()

  // Build base report from scenario, then overlay live data where available
  const base = buildReportData(scenario)

  const meta    = base.meta
  const weather = base.weather

  // Use live synthesis executive summary when available
  const agentFindings = appData?.synthesis?.executive_summary ?? base.agentFindings

  // Derive zones from enriched spatial points when available
  const sourcePoints = appData?.spatial?.data?.enrichedPoints
  const zones = sourcePoints
    ? (() => {
        const groups = {}
        sourcePoints.forEach(pt => {
          const key = pt.assignedZone ?? (pt.zone ? `Zone ${pt.zone}` : 'Unknown')
          if (!groups[key]) groups[key] = []
          groups[key].push(pt)
        })
        return Object.entries(groups).map(([name, pts]) => {
          const topSev = pts.some(p => p.severity === 'high') ? 'Severe'
                       : pts.some(p => p.severity === 'moderate') ? 'Moderate' : 'Low'
          return { name, damage: topSev, type: pts[0].damageType ?? '—', estLoss: topSev === 'Severe' ? '~45%' : topSev === 'Moderate' ? '~11%' : '~3%' }
        })
      })()
    : base.zones

  // Use live insurance matches + actions when available
  const fcicMatches = appData?.insurance?.matched_sections
    ? appData.insurance.matched_sections.map(m => `${m.reference}: ${m.explanation.slice(0, 80)}…`)
    : base.fcicMatches

  const actions = appData?.insurance?.action_items ?? base.actions

  return (
    <>
      {/* Print styles injected globally */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          @page { margin: 1.25in 1in; }
        }
      `}</style>

      <div className="min-h-full pb-36 print:pb-0" style={{ background: '#0a0e17' }}>

        {/* ── Action bar (hidden on print) ────────────────────────────────── */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 print:hidden"
          style={{ background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d4a' }}
        >
          <div>
            <h1 className="text-base font-bold text-slate-100 leading-tight">Claim Report</h1>
            <p className="text-[11px] text-slate-500">Unit 004 · {meta.date}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              boxShadow: '0 0 16px rgba(59,130,246,0.35)',
            }}
          >
            <Download size={13} />
            Download Report
          </button>
        </div>

        {/* ── Document ────────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto px-4 pt-5 print:px-0 print:pt-0 print:max-w-none">

          {/* Print header (only visible in print) */}
          <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-300">
            <h1 className="text-2xl font-bold text-slate-900">Crop Insurance Claim Report</h1>
            <p className="text-sm text-slate-500 mt-1">CropMind AI · Pre-Qualification Assessment · {meta.date}</p>
          </div>

          <div className="flex flex-col gap-4 print:gap-0">

            {/* 1 — Field Info */}
            <div className={cardDark}>
              <Section icon={MapPin} title="Field Information">
                <MetaGrid meta={meta} weather={weather} />
              </Section>
            </div>

            <hr className={divider} />

            {/* 2 — Weather Event */}
            <div className={cardDark}>
              <Section icon={CloudLightning} title="Weather Event">
                <div
                  className="rounded-xl p-4 print:rounded-none print:border print:border-slate-200 print:p-3"
                  style={{ background: '#0a0e17' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-full p-1.5 bg-orange-500/15 print:bg-transparent">
                      <CloudLightning size={14} className="text-orange-400 print:text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-100 print:text-slate-800">{weather.event}</p>
                      <p className="text-xs text-slate-400 print:text-slate-500 mt-0.5">Date of Loss: {weather.dateOfLoss}</p>
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            <hr className={divider} />

            {/* 3 — Damage by Zone */}
            <div className={cardDark}>
              <Section icon={Layers} title="Damage by Zone">
                <div className="flex flex-col gap-2">
                  {zones.map(z => <ZoneRow key={z.name} zone={z} />)}
                </div>
              </Section>
            </div>

            <hr className={divider} />

            {/* 4 — Agent Findings */}
            <div className={cardDark}>
              <Section icon={Bot} title="Agent Findings">
                <div
                  className="rounded-xl p-4 print:rounded-none print:border print:border-slate-200 print:p-3"
                  style={{ background: '#0a0e17' }}
                >
                  <p className="text-sm text-slate-200 print:text-slate-700 leading-relaxed">{agentFindings}</p>
                </div>
              </Section>
            </div>

            <hr className={divider} />

            {/* 5 — FCIC Matches */}
            <div className={cardDark}>
              <Section icon={BookOpen} title="FCIC Policy Matches">
                <BulletList
                  items={fcicMatches}
                  icon={CheckCircle}
                  iconClass="text-blue-400 print:text-blue-600"
                />
              </Section>
            </div>

            <hr className={divider} />

            {/* 6 — Action Items */}
            <div className={cardDark}>
              <Section icon={ListChecks} title="Immediate Action Items">
                <BulletList
                  items={actions}
                  icon={Clock}
                  iconClass="text-yellow-400 print:text-yellow-600"
                />
              </Section>
            </div>

            {/* ── Disclaimer ──────────────────────────────────────────────── */}
            <div
              className="rounded-2xl p-4 flex items-start gap-3 print:rounded-none print:border print:border-slate-300 print:p-3 print:mt-8"
              style={{ background: '#0d1220', border: '1px solid #1e2d4a' }}
            >
              <AlertTriangle size={15} className="text-yellow-400 print:text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 print:text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-300 print:text-slate-700">Disclaimer: </span>
                Pre-qualification assessment, does not replace licensed adjuster.
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
