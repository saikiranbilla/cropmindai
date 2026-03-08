import { useState } from 'react'
import {
  Download, MapPin, CloudLightning, Layers, Bot, BookOpen,
  ListChecks, AlertTriangle, Satellite, Camera, FileText,
} from 'lucide-react'
import { useDemo } from '../context/AssessmentContext'
import demoRadar       from '../assets/demo-radar.svg'
import demoFlood1      from '../assets/demo-flood1.svg'
import demoFlood2      from '../assets/demo-flood2.svg'
import demoFieldBanner from '../assets/demo-field-banner.svg'
import demoZoneHealthy from '../assets/demo-zone-healthy.svg'

// ─── Hardcoded demo image URLs (with local SVG onError fallbacks) ─────────────
const NEXRAD_URL  = 'https://upload.wikimedia.org/wikipedia/commons/2/23/NEXRAD_radar_loop_for_Hurricane_Katrina.gif'
const FIELD_IMG_1 = 'https://images.unsplash.com/photo-1595856980486-53860bb4d154?auto=format&fit=crop&q=80&w=1000'
const FIELD_IMG_2 = 'https://images.unsplash.com/photo-1600333859688-661775e5461c?auto=format&fit=crop&q=80&w=1000'

// ─── Report data builder ─────────────────────────────────────────────────────

function buildReportData(scenario) {
  const {
    fieldInfo = {},
    weatherEvent = {},
    agentOutputs = {},
    scoutingPoints = [],
    insuranceMatches = [],
    actionItems = [],
  } = scenario ?? {}

  const groups = {}
  scoutingPoints.forEach(pt => {
    if (!groups[pt.zone]) groups[pt.zone] = []
    groups[pt.zone].push(pt)
  })
  const ZONE_LABELS = { A: 'Zone A (Ridge)', B: 'Zone B (Depression)' }
  const zones = Object.entries(groups).map(([zone, pts]) => {
    const topSev = pts.some(p => p.severity === 'high') ? 'Severe'
      : pts.some(p => p.severity === 'medium') ? 'Moderate' : 'Low'
    return {
      name: ZONE_LABELS[zone] ?? `Zone ${zone}`,
      damage: topSev,
      type: pts[0].damageType,
      estLoss: topSev === 'Severe' ? '~45%' : topSev === 'Moderate' ? '~11%' : '~3%',
    }
  })

  return {
    meta: {
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      location: fieldInfo.location ?? 'Champaign County, IL',
      crop: fieldInfo.crop ?? 'Corn',
      growthStage: fieldInfo.adjusterStage ?? '—',
    },
    weather: {
      event: weatherEvent.type ?? 'Severe Convective Storm',
      dateOfLoss: weatherEvent.dateOfLoss ?? '—',
    },
    agentFindings: agentOutputs.synthesis || null,
    zones,
    fcicMatches: insuranceMatches.map(m => ({
      policy:  m.reference ?? 'FCIC',
      section: m.title ?? m.reference ?? '—',
      text:    m.explanation ?? '',
    })),
    actions: actionItems.map(a => a.text ?? String(a)),
  }
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const card = 'rounded-[12px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)] print:rounded-none print:border print:border-gray-200 print:bg-white print:p-4 print:mb-4'
const divider = 'border-t border-zinc-800/50 print:border-zinc-200 my-4'

const DAMAGE_STYLES = {
  Severe:   { topBorder: '#ef4444',  badge: 'bg-red-500/10 text-red-400 border border-red-500/25',     bar: '#ef4444'  },
  Moderate: { topBorder: '#f59e0b',  badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/25', bar: '#f59e0b'  },
  Low:      { topBorder: '#10b981',  badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25', bar: '#10b981' },
}

const SEV_BADGE = {
  high:     { label: 'STATUS: SEVERE DAMAGE',  bg: 'rgba(239,68,68,0.88)',   border: '#ef4444' },
  moderate: { label: 'STATUS: WATERLOGGED',     bg: 'rgba(245,158,11,0.88)', border: '#f59e0b' },
  low:      { label: 'STATUS: NOMINAL',         bg: 'rgba(34,197,94,0.88)',  border: '#22c55e' },
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <section className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 print:mb-2">
        <Icon size={13} className="shrink-0 text-zinc-500 print:text-zinc-700" />
        <h2 className="text-[10px] font-semibold tracking-[0.12em] uppercase text-zinc-500 print:text-zinc-700">
          {title}
        </h2>
        <div className="flex-1 h-px bg-zinc-800 print:bg-zinc-200" />
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

// ─── Field meta grid ──────────────────────────────────────────────────────────

function MetaGrid({ meta, weather }) {
  const cells = [
    { label: 'Report Date',  value: meta.date },
    { label: 'Date of Loss', value: weather.dateOfLoss },
    { label: 'Location',     value: meta.location },
    { label: 'Crop',         value: meta.crop },
    { label: 'Growth Stage', value: meta.growthStage },
    { label: 'Peril',        value: weather.event },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cells.map(({ label, value }) => (
        <div key={label} className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
          <p className="mb-0.5 text-[9px] font-semibold tracking-widest uppercase text-zinc-500 print:text-zinc-600">{label}</p>
          <p className="text-[13px] font-medium text-zinc-100 print:text-zinc-900 leading-snug">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Zone damage card (with thumbnail) ───────────────────────────────────────

function ZoneRow({ zone }) {
  const style = DAMAGE_STYLES[zone.damage] ?? DAMAGE_STYLES.Low
  const pct   = zone.damage === 'Severe' ? 80 : zone.damage === 'Moderate' ? 45 : 15
  const thumb = zone.damage === 'Severe'   ? demoFlood1
              : zone.damage === 'Moderate' ? demoFlood2
              : demoZoneHealthy
  return (
    <div className="rounded-[12px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] print:rounded print:border-gray-200"
         style={{ borderTop: `3px solid ${style.topBorder}` }}>
      <div className="relative h-28 print:h-20">
        <img src={thumb} alt={zone.name} className="w-full h-full object-cover print:opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent print:hidden" />
        <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide print:hidden ${style.badge}`}>
          {zone.damage}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[13px] font-semibold text-zinc-100 print:text-zinc-900">{zone.name}</p>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${style.badge} print:border print:border-gray-300 print:text-zinc-700 print:bg-gray-100`}>
            {zone.damage}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2 text-[11px]">
          <span className="text-zinc-400 print:text-zinc-600">{zone.type}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500 print:text-zinc-600 uppercase text-[10px] tracking-wide">Est. Loss</span>
          <span className="ml-auto font-mono text-[15px] font-semibold print:text-zinc-900" style={{ color: style.topBorder }}>{zone.estLoss}</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 print:bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: style.bar }} />
        </div>
      </div>
    </div>
  )
}

// ─── Satellite / Weather panel ────────────────────────────────────────────────

function SatelliteWeatherPanel({ satellite }) {
  const mapImage = satellite?.map_image ?? NEXRAD_URL
  const precip   = satellite?.total_precip_mm
  const moisture = satellite?.avg_soil_moisture_m3m3
  const source   = satellite?.source ?? 'open-meteo'

  return (
    <div className="mt-3 relative rounded-xl overflow-hidden h-44 print:h-32 print:rounded"
         style={{ background: '#070d18' }}>
      <img
        src={mapImage}
        alt="NEXRAD Doppler radar"
        className="w-full h-full object-cover"
        onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = demoRadar }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none print:hidden" />

      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded px-1.5 py-0.5 print:hidden"
           style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="font-mono text-[8px] text-emerald-400 tracking-widest">
          NEXRAD · {source.toUpperCase()}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-end justify-between print:hidden">
        <div>
          <p className="font-mono text-[8px] text-zinc-400 tracking-wider mb-0.5">7-DAY PRECIP</p>
          {precip != null
            ? <p className="font-mono font-bold leading-none text-emerald-400">
                <span className="text-3xl">{typeof precip === 'number' ? precip.toFixed(1) : precip}</span>
                <span className="text-xs text-zinc-500 ml-1">mm</span>
              </p>
            : <p className="font-mono text-zinc-600 text-sm">—</p>}
        </div>
        {moisture != null && (
          <div className="text-right">
            <p className="font-mono text-[8px] text-zinc-400 tracking-wider mb-0.5">SOIL MOISTURE</p>
            <p className="font-mono text-xl font-bold text-blue-400 leading-none">
              {(moisture * 100).toFixed(0)}<span className="text-xs text-zinc-500">%</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Precipitation bar chart ──────────────────────────────────────────────────

const DEMO_DAYS = [
  { day: 'MON', mm: 2.1  },
  { day: 'TUE', mm: 8.4  },
  { day: 'WED', mm: 34.2 },
  { day: 'THU', mm: 18.6 },
  { day: 'FRI', mm: 5.3  },
  { day: 'SAT', mm: 1.8  },
  { day: 'SUN', mm: 0.4  },
]
const FLOOD_LINE = 25
const MAX_MM     = Math.max(...DEMO_DAYS.map(d => d.mm))

function PrecipChart({ satellite }) {
  const totalMm    = satellite?.total_precip_mm ?? DEMO_DAYS.reduce((s, d) => s + d.mm, 0).toFixed(1)
  const moisturePct = satellite?.avg_soil_moisture_m3m3 ? Math.round(satellite.avg_soil_moisture_m3m3 * 100) : 42
  const source     = satellite?.source ?? 'open-meteo (demo)'

  return (
    <Section icon={Satellite} title="7-Day Precipitation">
      <div className="flex flex-col gap-3 h-full">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
            <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 print:text-zinc-600 mb-1">Cumulative</p>
            <p className="font-mono font-bold leading-none text-blue-400 print:text-blue-800">
              <span className="text-3xl">{totalMm}</span>
              <span className="text-xs text-zinc-500 print:text-zinc-600 ml-1">mm</span>
            </p>
          </div>
          <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
            <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 print:text-zinc-600 mb-1">Soil Moisture</p>
            <p className="font-mono font-bold leading-none text-emerald-400 print:text-emerald-800">
              <span className="text-3xl">{moisturePct}</span>
              <span className="text-xs text-zinc-500 print:text-zinc-600 ml-1">%</span>
            </p>
          </div>
        </div>

        <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] print:bg-gray-50 print:rounded print:border-gray-200 flex-1">
          <p className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 print:text-zinc-600 mb-2">Daily Rainfall (mm)</p>
          <div className="relative" style={{ height: 88 }}>
            <div className="absolute left-0 right-0 border-t border-dashed border-red-500/40 pointer-events-none print:border-red-400"
                 style={{ bottom: `${(FLOOD_LINE / MAX_MM) * 88}px` }}>
              <span className="absolute right-0 -top-[9px] font-mono text-[7px] text-red-400 print:text-red-700 bg-[var(--bg-elevated)] print:bg-gray-50 px-0.5">FLOOD</span>
            </div>
            <div className="absolute inset-0 flex items-end gap-1">
              {DEMO_DAYS.map(({ day, mm }) => {
                const h   = Math.round((mm / MAX_MM) * 88)
                // Screen colors (blues); print colors are forced via className
                const col      = mm >= FLOOD_LINE ? '#1d4ed8' : mm >= 10 ? '#3b82f6' : mm >= 3 ? '#60a5fa' : '#93c5fd'
                const printCls = mm >= FLOOD_LINE ? 'print:bg-blue-900'
                               : mm >= 10         ? 'print:bg-blue-700'
                               : mm >= 3          ? 'print:bg-blue-500'
                               :                    'print:bg-blue-300'
                return (
                  <div key={day} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                    {mm >= 5 && <span className="font-mono text-[6px] text-zinc-500 print:text-zinc-800 mb-0.5">{mm}</span>}
                    <div className={`precip-bar w-full rounded-t-sm ${printCls}`}
                         style={{ height: h, background: col, minHeight: 2,
                                  boxShadow: mm >= FLOOD_LINE ? `0 0 6px ${col}80` : 'none' }} />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            {DEMO_DAYS.map(({ day }) => (
              <div key={day} className="flex-1 text-center font-mono text-[7px] text-zinc-500 print:text-zinc-600">{day}</div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[8px] text-zinc-600 mt-auto">↑ {source}</p>
      </div>
    </Section>
  )
}

// ─── Geotagged gallery ────────────────────────────────────────────────────────

function ExifHud({ img }) {
  const badge = SEV_BADGE[img.severity] ?? SEV_BADGE.low
  return (
    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 print:hidden"
         style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.5) 60%,transparent 100%)' }}>
      <div className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded"
           style={{ background: badge.bg, border: `1px solid ${badge.border}` }}>
        {img.severity === 'high' && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-75" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
        )}
        <span className="font-mono text-[8px] font-bold text-white tracking-widest">[ {badge.label} ]</span>
      </div>
      <div className="font-mono text-[8px] leading-relaxed text-emerald-400">
        LAT: {img.lat} | LNG: {img.lng}<br />
        <span className="text-zinc-400">GPS_ALT: {img.elev} · {img.time}</span>
      </div>
    </div>
  )
}

function GeotaggedGallery({ images }) {
  if (!images.length) return null
  return (
    <Section icon={Camera} title="Geotagged Field Evidence">
      <div className="grid grid-cols-2 gap-3 h-full">
        {images.map((img, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden print:rounded print:border print:border-gray-200"
               style={{ aspectRatio: '4/3', background: '#0d1220' }}>
            <img
              src={img.url}
              alt={img.caption ?? `Field evidence ${i + 1}`}
              className="w-full h-full object-cover print:opacity-80"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = i === 0 ? demoFlood1 : demoFlood2 }}
            />
            <ExifHud img={img} />
            <div className="absolute top-2 right-2 rounded px-1.5 py-0.5 print:hidden"
                 style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span className="font-mono text-[8px] text-zinc-400">PT-{String(i + 1).padStart(3, '0')}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── FCIC policy cards ────────────────────────────────────────────────────────

function FcicPolicyMatches({ matches }) {
  if (!matches.length) return null
  return (
    <Section icon={FileText} title="FCIC Policy Matches">
      <div className="flex flex-col gap-2.5 h-full overflow-y-auto">
        {matches.map((m, i) => (
          <div key={i} className="rounded-r-xl p-3.5 print:rounded print:border print:border-gray-200 print:mb-2"
               style={{ background: '#18181b', borderLeft: '3px solid #10b981' }}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold tracking-widest uppercase text-emerald-400 print:text-emerald-800"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                {m.policy}
              </span>
              {m.section && m.section !== m.policy && (
                <span className="font-mono text-[10px] text-zinc-500 print:text-zinc-700">
                  {m.section.slice(0, 70)}{m.section.length > 70 ? '…' : ''}
                </span>
              )}
              {m.similarity != null && (
                <span className="ml-auto font-mono text-[8px] text-zinc-600 print:text-zinc-500">
                  MATCH: {(m.similarity * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-200 print:text-zinc-800">{m.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── Action checklist ─────────────────────────────────────────────────────────

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

function ActionChecklist({ items }) {
  const [checked, setChecked] = useState(() => new Array(items.length).fill(false))
  const toggle    = i => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  const doneCount = checked.filter(Boolean).length

  return (
    <Section icon={ListChecks} title="Immediate Action Items">
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-center gap-3 mb-1 print:hidden">
          <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                 style={{ width: items.length ? `${(doneCount / items.length) * 100}%` : '0%' }} />
          </div>
          <span className="font-mono text-[9px] text-zinc-500 shrink-0">{doneCount}/{items.length}</span>
        </div>
        <ul className="flex flex-col gap-1.5 flex-1">
          {items.map((item, i) => (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all active:scale-[0.99] print:rounded print:border print:border-gray-200 print:mb-1"
                style={{
                  background: checked[i] ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)',
                  border:     `1px solid ${checked[i] ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                  opacity:    checked[i] ? 0.5 : 1,
                }}
              >
                <span className="mt-0.5 shrink-0 print:hidden"><CheckIcon checked={checked[i]} /></span>
                <span className="text-[12px] leading-snug text-zinc-300 print:text-zinc-800"
                      style={{ textDecoration: checked[i] ? 'line-through' : 'none' }}>
                  {item}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ClaimReport() {
  const { scenario, appData } = useDemo()

  const base      = buildReportData(scenario)
  const satellite = appData?.satellite ?? null
  const meta      = base.meta
  const weather   = base.weather

  const DEMO_SUMMARY =
    'This assessment identifies a Partial Damage flood pathway for the insured corn unit in Champaign County, IL. ' +
    'Scouting data confirms active inundation across ~18.4 acres in Zone A (basin elevation 218.0m ASL), with ' +
    'waterlogged conditions in Zone B and dry, optimal stand conditions on the west ridge (Zone C, 222.0m ASL). ' +
    'Seven-day cumulative precipitation of 70.8mm exceeded the 50.8mm flood-risk threshold. Soil moisture readings ' +
    'of 0.42 m³/m³ confirm full saturation. No stand mortality conflict detected between Vision and Environmental ' +
    'agents. Recommend immediate Notice of Loss filing and adjuster inspection before any replanting decision.'

  const agentFindings = appData?.synthesis?.executive_summary || base.agentFindings || DEMO_SUMMARY

  // Zones
  const sourcePoints = appData?.spatial?.data?.enrichedPoints
  const zones = sourcePoints?.length
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
    : base.zones.length
      ? base.zones
      : [
          { name: 'Zone A — Basin', damage: 'Severe',   type: 'Flood Inundation', estLoss: '~45%' },
          { name: 'Zone B — Slope', damage: 'Moderate', type: 'Waterlogging',     estLoss: '~11%' },
          { name: 'Zone C — Ridge', damage: 'Low',      type: 'Dry Runoff',       estLoss: '~3%'  },
        ]

  // Gallery — hardcoded demo URLs per demo requirements; local SVGs as onError fallback
  const galleryImages = [
    { url: FIELD_IMG_1, lat: '40.1098', lng: '-88.2410', elev: '218.0m', severity: 'high',     time: '10:15 AM', caption: 'Scouting pt 1 — basin inundation' },
    { url: FIELD_IMG_2, lat: '40.1112', lng: '-88.2395', elev: '219.8m', severity: 'moderate', time: '10:30 AM', caption: 'Scouting pt 2 — waterlogged rows'  },
  ]

  // FCIC matches
  const fcicPolicyMatches = (() => {
    const live = appData?.insurance?.matched_sections
    if (live?.length) return live.map(m => ({
      policy: m.reference ?? 'FCIC', section: m.title ?? '—',
      text: m.explanation ?? '', similarity: m.similarity ?? null,
    }))
    const raw = appData?._raw?.insurance_matches
    if (raw?.length) return raw
    if (base.fcicMatches?.length) return base.fcicMatches
    return [
      {
        policy: 'Coarse Grains Crop Provisions',
        section: 'Section 8 — Replant Payments',
        text: 'Replant payment is authorized if the acreage replanted is at least 20 acres or 20 percent of the insured planted acreage for the unit.',
        similarity: 0.91,
      },
      {
        policy: 'FCIC-25080',
        section: 'Exhibit 15 — Corn Defoliation Loss',
        text: 'Stand loss exceeding 50% of the insured unit at or before V6 growth stage qualifies for a full prevented-planting indemnity. Field evidence must include GPS-tagged photographs and a completed LA-12 stand-count form.',
        similarity: 0.87,
      },
      {
        policy: 'FCIC-11020',
        section: '§508(a)(3) — Prevented Planting Provisions',
        text: 'An insured is eligible for prevented-planting coverage when an insurable cause of loss prevents planting on acreage with a history of being planted. Notice of Loss must be filed within 72 hours of loss discovery.',
        similarity: 0.81,
      },
    ]
  })()

  // Actions
  const actions = appData?.insurance?.action_items?.length ? appData.insurance.action_items
    : appData?._raw?.action_items?.length ? appData._raw.action_items
    : base.actions?.length ? base.actions
    : [
        'File a Notice of Loss with your crop insurance agent within 72 hours of loss discovery — failure to report timely may void coverage.',
        'Do not replant or terminate the insured crop before the adjuster completes the stand-count inspection.',
        'Preserve all field evidence: GPS-tagged photos, yield records, and this pre-qualification report.',
        'Contact your AIP to schedule a joint field inspection and confirm your APH yield on record.',
      ]

  return (
    <>
      {/* ── Print stylesheet ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.75in 0.65in; size: letter; }
          body  { background: white !important; color: #111 !important; }
          .print-hide { display: none !important; }
          /* Flatten dark card/panel backgrounds — but NOT the precip bars */
          [style*="background"]:not(.precip-bar) { background: white !important; }
          /* Kill absolute/fixed overlays */
          .absolute, .fixed, .sticky { position: relative !important; }
          /* Remove shadows & glows */
          * { box-shadow: none !important; text-shadow: none !important; }
          /* Force text to dark */
          p, span, h1, h2, h3, li, div { color: #111 !important; }
          img { max-height: 120px !important; object-fit: cover; }
        }
      `}</style>

      <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)] print:bg-white print:text-black">

        {/* ── Sticky action bar ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] print-hide">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Claim Report</h1>
            <p className="font-mono text-[11px] text-zinc-500 mt-0.5">Unit 004 · {meta.date}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition-all active:scale-95"
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>

        {/* ── Print header (only in print) ─────────────────────────────────── */}
        <div className="hidden print:block px-0 pt-0 pb-4 mb-6 border-b-2 border-zinc-300">
          <h1 className="text-2xl font-bold text-zinc-900">Crop Insurance Claim Report</h1>
          <p className="text-sm text-zinc-500 mt-1">CropMindAI · Pre-Qualification · {meta.date} · Unit 004</p>
        </div>

        {/* ── Content container ────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5 print:max-w-none print:p-0 print:space-y-4">

          {/* ── Field info + banner (full width) ──────────────────────────── */}
          <div className={card}>
            <Section icon={MapPin} title="Field Information">
              <MetaGrid meta={meta} weather={weather} />
            </Section>
          </div>

          <div className="relative rounded-2xl overflow-hidden print:rounded print:h-24"
               style={{ height: 180, border: '1px solid var(--border-subtle)' }}>
            <img src={demoFieldBanner} alt="Aerial field overview" className="w-full h-full object-cover print:opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-transparent to-transparent pointer-events-none print:hidden" />
            <div className="absolute bottom-4 left-5 print:hidden">
              <p className="font-mono text-[8px] text-emerald-400 tracking-widest mb-1">FIELD UNIT 004 · CHAMPAIGN COUNTY, IL</p>
              <p className="text-lg font-bold text-white leading-tight">~149 Acres · Pre-Qualification Survey</p>
              <p className="font-mono text-[8px] text-zinc-400 mt-1">3 PARCELS · 5 SCOUTING POINTS · {meta.date}</p>
            </div>
          </div>

          {/* ── Row 1: Executive Summary (col-span-2) + Weather (col-span-1) ─ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-4">

            {/* Executive Summary — spans 2 cols */}
            <div className={`${card} md:col-span-2`}>
              <Section icon={Bot} title="Executive Summary">
                <div className="rounded-[10px] p-4 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                  <p className="text-[13px] leading-relaxed text-zinc-300 print:text-zinc-800">{agentFindings}</p>
                </div>
                {appData?.synthesis?.overall_confidence != null && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 print:text-zinc-600">AI Confidence</span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 print:bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500"
                           style={{ width: `${appData.synthesis.overall_confidence * 100}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-emerald-400 print:text-emerald-800">
                      {(appData.synthesis.overall_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </Section>
            </div>

            {/* Weather Event + Satellite radar — col-span-1 */}
            <div className={card}>
              <Section icon={CloudLightning} title="Weather Event">
                <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200">
                  <p className="text-[13px] font-medium text-zinc-100 print:text-zinc-900">{weather.event}</p>
                  <p className="font-mono text-[10px] text-zinc-500 print:text-zinc-600 mt-1">Date of Loss: {weather.dateOfLoss}</p>
                </div>
                <SatelliteWeatherPanel satellite={satellite} />
              </Section>
            </div>
          </div>

          {/* ── Row 2: Damage by Zone (full width) ───────────────────────────── */}
          <div className={card}>
            <Section icon={Layers} title="Damage by Zone">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map(z => <ZoneRow key={z.name} zone={z} />)}
              </div>
            </Section>
          </div>

          {/* ── Row 3: Geotagged Evidence (col-span-2) + Precip (col-span-1) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-4">
            <div className={`${card} md:col-span-2`}>
              <GeotaggedGallery images={galleryImages} />
            </div>
            <div className={card}>
              <PrecipChart satellite={satellite} />
            </div>
          </div>

          {/* ── Row 4: FCIC Matches + Action Checklist (2-col) ───────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:gap-4">
            <div className={card}>
              <FcicPolicyMatches matches={fcicPolicyMatches} />
            </div>
            <div className={card}>
              <ActionChecklist items={actions} />
            </div>
          </div>

          {/* ── Disclaimer ───────────────────────────────────────────────────── */}
          <div className="rounded-[8px] p-4 flex items-start gap-3 print:border print:border-amber-300 print:rounded"
               style={{ background: 'rgba(245,166,35,0.06)', borderLeft: '3px solid #f59e0b' }}>
            <AlertTriangle size={14} className="text-amber-400 print:text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed text-zinc-400 print:text-zinc-700">
              <span className="font-semibold text-zinc-200 print:text-zinc-900">Disclaimer: </span>
              Pre-qualification assessment only. Does not replace a licensed crop-insurance adjuster.
              All indemnity determinations are subject to AIP review and FCIC standards.
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
