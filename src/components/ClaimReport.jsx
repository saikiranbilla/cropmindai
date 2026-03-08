import { useState } from 'react'
import {
  Download, MapPin, CloudLightning, Layers, Bot, BookOpen,
  ListChecks, AlertTriangle, CheckCircle, Clock, Satellite,
  Camera, FileText,
} from 'lucide-react'
import { useDemo } from '../context/AssessmentContext'

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
      event: weatherEvent.type ?? '—',
      dateOfLoss: weatherEvent.dateOfLoss ?? '—',
    },
    agentFindings: agentOutputs.synthesis ?? 'Pending assessment...',
    zones,
    fcicMatches: insuranceMatches.map(m => ({
      policy:  m.reference ?? 'FCIC',
      section: m.title ?? m.reference ?? '—',
      text:    m.explanation ?? '',
    })),
    actions: actionItems.map(a => a.text ?? String(a)),
  }
}

// ─── Style tokens ────────────────────────────────────────────────────────────

const card = 'rounded-[12px] p-[20px] transition-all duration-300 print:rounded-none print:border-0 print:p-0 print:mb-6 outline-none'
const cardDark = `${card} bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] print:bg-white`
const divider = 'border-t border-zinc-800/50 print:border-zinc-200 my-5'

const DAMAGE_STYLES = {
  Severe:   { topBorder: 'var(--accent-red)',   badge: 'bg-[rgba(255,77,77,0.12)] text-[var(--accent-red)] border border-[rgba(255,77,77,0.25)]',     bar: 'var(--accent-red)' },
  Moderate: { topBorder: 'var(--accent-amber)', badge: 'bg-[rgba(245,166,35,0.12)] text-[var(--accent-amber)] border border-[rgba(245,166,35,0.25)]', bar: 'var(--accent-amber)' },
  Low:      { topBorder: 'var(--accent-primary)',badge: 'bg-[rgba(0,229,160,0.10)] text-[var(--accent-primary)] border border-[rgba(0,229,160,0.20)]', bar: 'var(--accent-primary)' },
}

// ─── Satellite / Weather panel ───────────────────────────────────────────────
// Displayed inside the Weather Event card.
// Reads:  satellite_data.map_image         → <img> src (strict — no fallback image)
//         satellite_data.total_precip_mm   → big neon overlay number
//         satellite_data.avg_soil_moisture_m3m3 → secondary stat

function SatelliteWeatherPanel({ satellite }) {
  if (!satellite) return null

  // Strictly use assessment.satellite_data.map_image — no external fallback URL
  const mapImage = satellite.map_image ?? null
  const precip   = satellite.total_precip_mm
  const moisture = satellite.avg_soil_moisture_m3m3
  const source   = satellite.source ?? 'open-meteo'

  return (
    <div
      className="mt-4 relative rounded-xl overflow-hidden h-48 w-full print:h-32"
      style={{ border: '1px solid #27364f', background: '#070d18' }}
    >
      {mapImage ? (
        <img
          src={mapImage}
          alt="Satellite imagery"
          className="w-full h-full object-cover"
          style={{ border: 'none' }}
        />
      ) : (
        /* Dark grid placeholder — shown when map_image is not yet in the DB */
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-2"
          style={{
            background: 'repeating-linear-gradient(0deg,transparent,transparent 30px,rgba(30,61,90,0.15) 30px,rgba(30,61,90,0.15) 31px), repeating-linear-gradient(90deg,transparent,transparent 30px,rgba(30,61,90,0.15) 30px,rgba(30,61,90,0.15) 31px)',
          }}
        >
          <Satellite size={20} style={{ color: '#1e3a5f' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#1e3a5f', letterSpacing: '0.1em' }}>
            IMAGERY PENDING
          </p>
        </div>
      )}

      {/* Gradient vignette so stats stay legible over any image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

      {/* Top-left live source badge */}
      <div
        className="absolute top-2 left-2 flex items-center gap-1.5 rounded px-2 py-0.5"
        style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#4ade80', letterSpacing: '0.08em' }}>
          SATELLITE · {source.toUpperCase()}
        </span>
      </div>

      {/* Bottom — precipitation readout */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 flex items-end justify-between">
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: 2 }}>
            7-DAY CUMULATIVE PRECIP
          </p>
          {precip != null ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1, color: 'var(--accent-primary)' }}>
              <span style={{ fontSize: 36 }}>{typeof precip === 'number' ? precip.toFixed(1) : precip}</span>
              <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 4 }}>mm</span>
            </p>
          ) : (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#3f3f46' }}>—</p>
          )}
        </div>

        {moisture != null && (
          <div className="text-right">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: 2 }}>
              SOIL MOISTURE
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#60a5fa', lineHeight: 1 }}>
              {(moisture * 100).toFixed(0)}<span style={{ fontSize: 11, color: '#94a3b8' }}>%</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


const SEV_BADGE = {
  high:     { label: 'STATUS: SEVERE DAMAGE',  bg: 'rgba(239,68,68,0.88)',   border: '#ef4444' },
  moderate: { label: 'STATUS: WATERLOGGED',     bg: 'rgba(245,158,11,0.88)', border: '#f59e0b' },
  low:      { label: 'STATUS: NOMINAL',         bg: 'rgba(34,197,94,0.88)',  border: '#22c55e' },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Icon size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {title}
        </h2>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>
      {children}
    </section>
  )
}

function MetaGrid({ meta, weather }) {
  const cells = [
    { label: 'Report Date', value: meta.date },
    { label: 'Date of Loss', value: weather.dateOfLoss },
    { label: 'Location', value: meta.location },
    { label: 'Crop', value: meta.crop },
    { label: 'Growth Stage', value: meta.growthStage },
    { label: 'Peril', value: weather.event },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map(({ label, value }) => (
        <div key={label} className="rounded-[8px] p-3 bg-[var(--bg-elevated)]">
          <p className="mb-1" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
          <p className="leading-snug" style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function ZoneRow({ zone }) {
  const style = DAMAGE_STYLES[zone.damage] ?? DAMAGE_STYLES.Low
  const pct = zone.damage === 'Severe' ? 80 : zone.damage === 'Moderate' ? 45 : 15
  return (
    <div
      className="rounded-[12px] p-4 bg-[var(--bg-card)] shadow-sm border border-[var(--border-subtle)]"
      style={{ borderTop: `4px solid ${style.topBorder}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{zone.name}</p>
        <span className={`px-2 py-0.5 rounded-full ${style.badge}`} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {zone.damage}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }}>{zone.type}</p>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. Loss</p>
        <p className="ml-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 500, color: style.topBorder }}>{zone.estLoss}</p>
      </div>
      <div className="h-2 rounded-md bg-[var(--bg-elevated)] overflow-hidden">
        <div className="h-full rounded-md" style={{ width: `${pct}%`, background: style.bar, boxShadow: `0 0 8px ${style.bar}80` }} />
      </div>
    </div>
  )
}

// ── 1. Geotagged Evidence Gallery ────────────────────────────────────────────

function ExifHud({ img }) {
  const badge = SEV_BADGE[img.severity] ?? SEV_BADGE.low
  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-3 py-2.5"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)' }}
    >
      {/* Severity badge */}
      <div
        className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded"
        style={{ background: badge.bg, border: `1px solid ${badge.border}`, backdropFilter: 'blur(4px)' }}
      >
        {/* Blinking red dot for severe */}
        {img.severity === 'high' && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
          [ {badge.label} ]
        </span>
      </div>

      {/* EXIF telemetry lines */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8.5px', lineHeight: 1.65, color: '#4ade80' }}>
        <span>LAT: {img.lat} | LNG: {img.lng}</span><br />
        <span style={{ color: '#94a3b8' }}>GPS_ALT: {img.elev} · {img.time}</span>
      </div>
    </div>
  )
}

function GeotaggedGallery({ images }) {
  const [failed, setFailed] = useState({})
  if (!images.length) return null

  return (
    <div className={cardDark}>
      <Section icon={Camera} title="Geotagged Field Evidence">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden"
              style={{
                aspectRatio: '4/3',
                border: '1px solid var(--border-subtle)',
                background: '#0d1220',
              }}
            >
              {!failed[i] ? (
                <img
                  src={img.url}
                  alt={img.caption ?? `Field evidence ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => setFailed(f => ({ ...f, [i]: true }))}
                />
              ) : (
                /* Fallback placeholder when image fails to load */
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#0d1220' }}>
                  <Camera size={24} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}

              {/* HUD overlay */}
              <ExifHud img={img} />

              {/* Top-right point index badge */}
              <div
                className="absolute top-2 right-2 rounded px-1.5 py-0.5"
                style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#94a3b8' }}
              >
                PT-{String(i + 1).padStart(3, '0')}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── 2. FCIC Policy Matches — "Legal Document" cards ──────────────────────────

function FcicPolicyMatches({ matches }) {
  if (!matches.length) return null

  return (
    <div className={cardDark}>
      <Section icon={FileText} title="FCIC Policy Matches">
        <div className="flex flex-col gap-3">
          {matches.map((m, i) => (
            <div
              key={i}
              className="rounded-r-xl p-4"
              style={{
                background:  '#18181b',          // zinc-900
                borderLeft:  '4px solid #10b981', // emerald-500
              }}
            >
              {/* Policy reference header */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'var(--font-mono)' }}
                >
                  {m.policy}
                </span>
                {m.section && m.section !== m.policy && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#71717a' }}>
                    {m.section.slice(0, 80)}{m.section.length > 80 ? '…' : ''}
                  </span>
                )}
                {m.similarity != null && (
                  <span className="ml-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#52525b' }}>
                    MATCH: {(m.similarity * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Policy text body */}
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.7, color: '#f4f4f5' }}>
                {m.text}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── 3. Action Items Checklist ─────────────────────────────────────────────────

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

  // Keep length in sync if items prop changes
  const toggle = (i) => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))

  const doneCount = checked.filter(Boolean).length

  return (
    <div className={cardDark}>
      <Section icon={ListChecks} title="Immediate Action Items">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: items.length ? `${(doneCount / items.length) * 100}%` : '0%',
                background: 'var(--accent-primary)',
                boxShadow: '0 0 8px rgba(0,229,160,0.4)',
              }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {doneCount}/{items.length} complete
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all duration-200 active:scale-[0.99]"
                style={{
                  background:  checked[i] ? 'rgba(16,185,129,0.06)' : 'var(--bg-elevated)',
                  border:      `1px solid ${checked[i] ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                  opacity:     checked[i] ? 0.55 : 1,
                }}
              >
                <span className="mt-0.5 shrink-0">
                  <CheckIcon checked={checked[i]} />
                </span>
                <span
                  className="leading-snug"
                  style={{
                    fontFamily:     'var(--font-sans)',
                    fontSize:       '13px',
                    color:          checked[i] ? 'var(--text-muted)' : 'var(--text-secondary)',
                    textDecoration: checked[i] ? 'line-through' : 'none',
                  }}
                >
                  {item}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

// ── Reused sub-components (satellite bento, bullet list) ─────────────────────

function BulletList({ items, icon: Icon, iconClass }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <Icon size={14} className={`${iconClass} shrink-0 mt-0.5`} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)' }} className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ClaimReport() {
  const { scenario, appData } = useDemo()

  const base     = buildReportData(scenario)
  const satellite = appData?.satellite ?? null

  const meta    = base.meta
  const weather = base.weather

  const agentFindings = appData?.synthesis?.executive_summary ?? base.agentFindings

  // Zones from enriched spatial points
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

  // ── Image gallery ─────────────────────────────────────────────────────────
  // Resolution order:
  //  1. assessment.image_urls          — flat string[] column added to DB
  //  2. enriched spatial points        — photo_url on each point
  //  3. single legacy _raw.photo_url
  //  4. demo mock images
  const galleryImages = (() => {
    // 1. Direct image_urls array from assessment row
    const directUrls = appData?._raw?.image_urls
    if (directUrls?.length) {
      return directUrls.map((url, i) => ({
        url,
        lat:      '40.1105',
        lng:      '-88.2401',
        elev:     '—',
        severity: i === 0 ? 'high' : i === 1 ? 'moderate' : 'low',
        time:     '—',
        caption:  `Field evidence ${i + 1}`,
      }))
    }

    // 2. Enriched scouting points with individual photo_url
    const pts = appData?.spatial?.data?.enrichedPoints ?? []
    const live = pts
      .filter(p => p.photo_url)
      .slice(0, 6)
      .map((p, i) => ({
        url:      p.photo_url,
        lat:      String(p.lat ?? p.latitude ?? '40.1105'),
        lng:      String(p.lon ?? p.longitude ?? '-88.2401'),
        elev:     p.elevation_m != null ? `${p.elevation_m}m` : '—',
        severity: p.severity ?? 'low',
        time:     p.captured_at ? new Date(p.captured_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
        caption:  `Scouting point ${i + 1}`,
      }))
    if (live.length > 0) return live

    // 3. Single legacy photo
    const single = appData?._raw?.photo_url
    if (single) return [{ url: single, lat: '40.1105', lng: '-88.2401', elev: '—', severity: 'high', time: '—', caption: 'Scouting photo' }]

    // No real images available — gallery hides itself
    return []
  })()

  // ── FCIC policy matches ───────────────────────────────────────────────────
  // Priority:
  //  1. adapted pipeline output  (insurance.matched_sections, shape from insurance.py)
  //  2. raw DB column            (_raw.insurance_matches, shape: {policy,section,text})
  //  3. scenario demo fallback
  const fcicPolicyMatches = (() => {
    const live = appData?.insurance?.matched_sections
    if (live?.length) {
      return live.map(m => ({
        policy:     m.reference    ?? 'FCIC',
        section:    m.title        ?? m.reference ?? '—',
        text:       m.explanation  ?? '',
        similarity: m.similarity   ?? null,
      }))
    }
    const raw = appData?._raw?.insurance_matches
    if (raw?.length) return raw   // already in {policy, section, text} shape
    return base.fcicMatches
  })()

  // ── Action items ──────────────────────────────────────────────────────────
  // Priority: pipeline output → raw DB column → scenario fallback
  const actions =
    appData?.insurance?.action_items?.length ? appData.insurance.action_items :
    appData?._raw?.action_items?.length      ? appData._raw.action_items :
    base.actions

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          @page { margin: 1.25in 1in; }
        }
      `}</style>

      <div className="min-h-full pb-36 print:pb-0 bg-[var(--bg-base)] text-[var(--text-primary)]">

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 print:hidden bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.2 }}>Claim Report</h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Unit 004 · {meta.date}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full px-5 py-2 transition-all hover:bg-[var(--bg-elevated)] active:scale-95"
            style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '13px' }}
          >
            <Download size={14} />
            Download
          </button>
        </div>

        {/* ── Document ────────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto p-8 print:px-0 print:pt-0 print:max-w-none">

          <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-300">
            <h1 className="text-2xl font-bold text-slate-900">Crop Insurance Claim Report</h1>
            <p className="text-sm text-slate-500 mt-1">CropMind AI · Pre-Qualification Assessment · {meta.date}</p>
          </div>

          <div className="flex flex-col gap-8 print:gap-0">

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
                <div className="rounded-[8px] p-4 bg-[var(--bg-elevated)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-full p-1.5" style={{ background: 'rgba(245,166,35,0.15)' }}>
                      <CloudLightning size={14} style={{ color: 'var(--accent-amber)' }} />
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{weather.event}</p>
                      <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>Date of Loss: {weather.dateOfLoss}</p>
                    </div>
                  </div>
                </div>
                {/* Satellite radar snapshot + precipitation readout */}
                <SatelliteWeatherPanel satellite={satellite} />
              </Section>
            </div>

            <hr className={divider} />

            {/* 3 — Damage by Zone */}
            <div className={cardDark}>
              <Section icon={Layers} title="Damage by Zone">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {zones.map(z => <ZoneRow key={z.name} zone={z} />)}
                </div>
              </Section>
            </div>

            {/* 4 — Geotagged Evidence Gallery ────────────────────────────── */}
            <GeotaggedGallery images={galleryImages} />

            {/* 5 — Bento: Executive Summary + Satellite + Insurance summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* Executive Summary */}
              <div className={cardDark}>
                <Section icon={Bot} title="Executive Summary">
                  <div className="rounded-[12px] p-4 bg-[var(--bg-elevated)]">
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                      {agentFindings}
                    </p>
                  </div>
                </Section>
              </div>

              {/* Satellite data */}
              {satellite ? (
                <div className={cardDark}>
                  <Section icon={Satellite} title="Satellite Data">
                    <div className="rounded-[12px] p-4 flex flex-col gap-3 bg-[var(--bg-elevated)]">
                      {satellite.summary && (
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>{satellite.summary}</p>
                      )}
                      {satellite.total_precip_mm != null && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[8px] p-3">
                          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>7-Day Precip</p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--accent-primary)', marginTop: '4px' }}>
                            {satellite.total_precip_mm} <span style={{ fontSize: '14px' }}>mm</span>
                          </p>
                          <div className="flex items-end gap-1 mt-2 h-6">
                            {[0.2, 0.4, 1.0, 0.6, 0.3].map((val, i) => (
                              <div key={i} className="flex-1 rounded-sm" style={{ background: 'var(--accent-primary)', height: `${val * 100}%`, opacity: val === 1.0 ? 1 : 0.4 }} />
                            ))}
                          </div>
                        </div>
                      )}
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        Source: {satellite.source ?? 'open-meteo'}
                      </p>
                    </div>
                  </Section>
                </div>
              ) : (
                <div className={cardDark}>
                  <Section icon={Satellite} title="Satellite Data">
                    <div className="rounded-[12px] p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>No satellite data available.</p>
                    </div>
                  </Section>
                </div>
              )}

              {/* Insurance quick-view (summary counts) */}
              <div className={cardDark}>
                <Section icon={BookOpen} title="Insurance Policy">
                  {fcicPolicyMatches.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-[8px] p-3 bg-[var(--bg-elevated)] flex items-center justify-between">
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>Matched sections</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, color: '#10b981' }}>{fcicPolicyMatches.length}</span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {fcicPolicyMatches[0]?.policy}
                      </p>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {fcicPolicyMatches[0]?.text?.slice(0, 90)}…
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#4ade80', marginTop: '4px' }}>↓ See full matches below</p>
                    </div>
                  ) : (
                    <div className="h-full border border-dashed border-[var(--border-subtle)] rounded-[12px] flex flex-col items-center justify-center p-6 bg-[var(--bg-card)]">
                      <BookOpen size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>No policy linked</p>
                    </div>
                  )}
                </Section>
              </div>
            </div>

            {/* 6 — FCIC Policy Matches — full-width legal cards ────────────── */}
            <FcicPolicyMatches matches={fcicPolicyMatches} />

            {/* 7 — Action Items Checklist ──────────────────────────────────── */}
            {actions.length > 0 && <ActionChecklist items={actions} />}

            {/* ── Disclaimer ──────────────────────────────────────────────── */}
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
      </div>
    </>
  )
}
