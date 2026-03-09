/**
 * @module ClaimReport
 * @description Production-grade Claim Report — the "Bento Box" layout
 * orchestrator. This component is a thin layout shell that:
 *
 * 1. Reads assessment data from AssessmentContext
 * 2. Normalizes / adapts backend payloads via pure utility functions
 * 3. Mounts single-responsibility child components in a responsive CSS Grid
 *
 * **No business logic lives here.** All data formatting is delegated to
 * `src/utils/formatters.js`. All visual rendering is delegated to the
 * child components in `src/components/report/`.
 *
 * **No hardcoded fallback data.** If the backend payload is missing fields,
 * each child component renders its own production-quality empty state.
 *
 * @see {@link module:ExecutiveSummaryCard}
 * @see {@link module:WeatherTelemetryCard}
 * @see {@link module:ZoneDamageBreakdown}
 * @see {@link module:GeotaggedGallery}
 * @see {@link module:FCICPolicyList}
 * @see {@link module:ActionChecklist}
 */

import { Download, MapPin, AlertTriangle } from 'lucide-react'
import { useDemo } from '../context/AssessmentContext'
import {
  formatDate,
  buildZoneSummaries,
  normalizeFcicMatches,
} from '../utils/formatters'
import { SectionHeader } from './report'
import { ExecutiveSummaryCard } from './report'
import { WeatherTelemetryCard } from './report'
import { ZoneDamageBreakdown } from './report'
import { GeotaggedGallery } from './report'
import { FCICPolicyList } from './report'
import { ActionChecklist } from './report'

// ─── Style tokens ─────────────────────────────────────────────────────────────

/** Shared card class for the Bento grid tiles. */
const card =
  'rounded-[12px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)] ' +
  'print:rounded-none print:border print:border-gray-200 print:bg-white print:p-4 print:mb-4'

// ─── Field Information Meta Grid ──────────────────────────────────────────────

/**
 * Compact 2×3 grid showing date, location, crop, growth stage, and weather info.
 *
 * @param {Object} props
 * @param {Object} props.meta - Field metadata object.
 * @param {string} [props.meta.date] - Report date string.
 * @param {string} [props.meta.location] - County / location string.
 * @param {string} [props.meta.crop] - Crop type.
 * @param {string} [props.meta.growthStage] - Adjuster growth stage.
 * @param {Object} props.weather - Weather event metadata.
 * @param {string} [props.weather.event] - Peril type.
 * @param {string} [props.weather.dateOfLoss] - Date of loss.
 */
function MetaGrid({ meta, weather }) {
  const cells = [
    { label: 'Report Date', value: meta?.date ?? '—' },
    { label: 'Date of Loss', value: weather?.dateOfLoss ?? '—' },
    { label: 'Location', value: meta?.location ?? '—' },
    { label: 'Crop', value: meta?.crop ?? '—' },
    { label: 'Growth Stage', value: meta?.growthStage ?? '—' },
    { label: 'Peril', value: weather?.event ?? '—' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-[8px] p-3 bg-[var(--bg-elevated)] print:bg-gray-50 print:rounded print:border print:border-gray-200"
        >
          <p className="mb-0.5 text-[9px] font-semibold tracking-widest uppercase text-zinc-500 print:text-zinc-600">
            {label}
          </p>
          <p className="text-[13px] font-medium text-zinc-100 print:text-zinc-900 leading-snug">
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClaimReport() {
  const { scenario, appData } = useDemo()

  // ── Derive field metadata (defensive, all optional-chained) ──────────────
  const rawRow = appData?._raw ?? {}
  const fieldInfo = scenario?.fieldInfo ?? {}
  const weatherEvt = scenario?.weatherEvent ?? {}

  const meta = {
    date: formatDate(rawRow.created_at) !== '—'
      ? formatDate(rawRow.created_at)
      : formatDate(new Date().toISOString()),
    location: fieldInfo.location ?? rawRow.location ?? null,
    crop: fieldInfo.crop ?? rawRow.crop_type ?? null,
    growthStage: fieldInfo.adjusterStage ?? null,
  }

  const weather = {
    event: weatherEvt.type ?? null,
    dateOfLoss: weatherEvt.dateOfLoss ?? rawRow.weather_event_date ?? null,
  }

  // ── Satellite data (strict mapping) ──────────────────────────────────────
  const satellite = appData?.satellite ?? null

  // ── Executive summary (strict mapping) ───────────────────────────────────
  const executiveSummary = appData?.synthesis?.executive_summary ?? null
  const confidence = appData?.synthesis?.overall_confidence ?? null

  // ── Zone damage (built from scouting points via utility) ─────────────────
  const sourcePoints = appData?.spatial?.data?.enrichedPoints
    ?? scenario?.scoutingPoints
    ?? []
  const zones = buildZoneSummaries(sourcePoints)

  // ── Geotagged gallery images (strict mapping from backend) ───────────────
  const galleryImages = (() => {
    // Prefer photo metadata with URLs from the backend
    const photoMeta = rawRow.photo_metadata?.scouting_points ?? []
    const withUrls = photoMeta.filter(pt => pt?.thumbnailUrl || pt?.url)
    if (withUrls.length > 0) {
      return withUrls.map(pt => ({
        url: pt.thumbnailUrl ?? pt.url,
        lat: pt.lat ?? '—',
        lng: pt.lng ?? '—',
        elev: pt.elevation_m ? `${pt.elevation_m}m` : '—',
        severity: pt.severity ?? 'low',
        time: pt.capturedAt ?? '—',
        caption: pt.damageType ?? `Scouting point`,
      }))
    }

    // Fall back to assessment image_urls if present
    const imageUrls = rawRow.image_urls ?? appData?.image_urls ?? []
    if (imageUrls.length > 0) {
      return imageUrls.map((url, i) => ({
        url,
        lat: '—', lng: '—', elev: '—',
        severity: 'low', time: '—',
        caption: `Field evidence ${i + 1}`,
      }))
    }

    return []
  })()

  // ── FCIC policy matches (strict mapping, no hardcoded fallbacks) ─────────
  const fcicMatches = (() => {
    const live = appData?.insurance?.matched_sections
    if (Array.isArray(live) && live.length > 0) return normalizeFcicMatches(live)

    const raw = rawRow.insurance_matches
    if (Array.isArray(raw) && raw.length > 0) return normalizeFcicMatches(raw)

    return []
  })()

  // ── Action items (strict mapping, no hardcoded fallbacks) ────────────────
  const actionItems = (() => {
    const liveActions = appData?.insurance?.action_items
    if (Array.isArray(liveActions) && liveActions.length > 0) return liveActions

    const rawActions = rawRow.action_items
    if (Array.isArray(rawActions) && rawActions.length > 0) return rawActions

    return []
  })()

  // ── Disclaimer text (from synthesis agent or static) ─────────────────────
  const disclaimer = appData?.synthesis?.disclaimer ?? null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Print stylesheet ────────────────────────────────────────────── */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0.75in 0.65in; size: letter; }
          body  { background: white !important; color: #111 !important; }
          .print-hide { display: none !important; }
          [style*="background"]:not(.precip-bar) { background: white !important; }
          .absolute, .fixed, .sticky { position: relative !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
          p, span, h1, h2, h3, li, div { color: #111 !important; }
          img { max-height: 120px !important; object-fit: cover; }
        }
      `}</style>

      <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)] print:bg-white print:text-black">

        {/* ── Sticky action bar ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] print-hide">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Claim Report</h1>
            <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
              Unit 004 · {meta.date}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition-all active:scale-95"
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>

        {/* ── Print header ───────────────────────────────────────────────── */}
        <div className="hidden print:block px-0 pt-0 pb-4 mb-6 border-b-2 border-zinc-300">
          <h1 className="text-2xl font-bold text-zinc-900">Crop Insurance Claim Report</h1>
          <p className="text-sm text-zinc-500 mt-1">
            CropMindAI · Pre-Qualification · {meta.date} · Unit 004
          </p>
        </div>

        {/* ── Bento Grid Content ─────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5 print:max-w-none print:p-0 print:space-y-4">

          {/* ── Field Information (full width) ───────────────────────────── */}
          <div className={card}>
            <SectionHeader icon={MapPin} title="Field Information">
              <MetaGrid meta={meta} weather={weather} />
            </SectionHeader>
          </div>

          {/* ── Row 1: Executive Summary (2/3) + Weather (1/3) ───────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-4">
            <div className={`${card} md:col-span-2`}>
              <ExecutiveSummaryCard
                summary={executiveSummary}
                confidence={confidence}
              />
            </div>
            <div className={card}>
              <WeatherTelemetryCard
                satellite={satellite}
                weather={weather}
              />
            </div>
          </div>

          {/* ── Row 2: Damage by Zone (full width) ───────────────────────── */}
          <div className={card}>
            <ZoneDamageBreakdown zones={zones} />
          </div>

          {/* ── Row 3: Gallery (2/3) + Policy Matches (1/3) ──────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-4">
            <div className={`${card} md:col-span-2`}>
              <GeotaggedGallery images={galleryImages} />
            </div>
            <div className={card}>
              <FCICPolicyList matches={fcicMatches} />
            </div>
          </div>

          {/* ── Row 4: Action Checklist (full width) ─────────────────────── */}
          <div className={card}>
            <ActionChecklist items={actionItems} />
          </div>

          {/* ── Disclaimer ───────────────────────────────────────────────── */}
          <div
            className="rounded-[8px] p-4 flex items-start gap-3 print:border print:border-amber-300 print:rounded"
            style={{ background: 'rgba(245,166,35,0.06)', borderLeft: '3px solid #f59e0b' }}
          >
            <AlertTriangle size={14} className="text-amber-400 print:text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[12px] leading-relaxed text-zinc-400 print:text-zinc-700">
              <span className="font-semibold text-zinc-200 print:text-zinc-900">Disclaimer: </span>
              {disclaimer
                ?? 'Pre-qualification assessment only. Does not replace a licensed crop-insurance adjuster. All indemnity determinations are subject to AIP review and FCIC standards.'}
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
