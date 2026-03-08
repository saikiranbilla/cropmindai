import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, MapPin, Clock, X, ChevronRight,
  Leaf, Droplets, Wind, AlertTriangle, CheckCircle, CloudRain, Image,
} from 'lucide-react'
import { useAssessment } from '../context/AssessmentContext'
import { filesToScoutingPoints } from '../utils/exif'

// ─── Icon palette for non-photo cards ────────────────────────────────────────
const CARD_ICONS = [Leaf, Droplets, AlertTriangle, Leaf, Wind, CheckCircle, AlertTriangle, CloudRain]
const CARD_COLORS = ['text-yellow-400', 'text-blue-400', 'text-orange-400', 'text-red-400', 'text-purple-400', 'text-green-400', 'text-red-500', 'text-cyan-400']
const CARD_BG = ['bg-yellow-400/10', 'bg-blue-400/10', 'bg-orange-400/10', 'bg-red-400/10', 'bg-purple-400/10', 'bg-green-400/10', 'bg-red-500/10', 'bg-cyan-400/10']

const POINT_TIMES = ['10:15 AM', '10:22 AM', '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM']

function derivePointDisplay(pt, idx) {
  const sevLabel = { high: 'Severe', medium: 'Moderate', moderate: 'Moderate', low: 'Minor' }[pt.severity] ?? 'Observable'
  return {
    ...pt,
    lat: String(pt.lat),
    lng: String(pt.lng),
    time: pt.capturedAt
      ? new Date(pt.capturedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : (POINT_TIMES[idx] ?? '—'),
    status: 'Pending',
    summary: pt.summary ?? `${sevLabel} ${(pt.damageType ?? 'damage').toLowerCase()} detected. Point ${idx + 1}.`,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] border border-[var(--accent-amber)]/30">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
      Pending
    </span>
  )
}

function GpsBadge({ gpsSource }) {
  if (!gpsSource) return null
  const isFallback = gpsSource === 'fallback'
  return (
    <span
      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isFallback
        ? 'bg-orange-500/20 text-orange-300'
        : 'bg-green-500/20 text-green-300'
        }`}
    >
      {isFallback ? 'GPS fallback' : 'GPS lock'}
    </span>
  )
}

function PhotoCard({ point, index, onClick }) {
  const isPending = point.status === 'Pending' || !point.status;
  const latStr = parseFloat(point.lat).toFixed(4)
  const lngStr = parseFloat(point.lng).toFixed(4)

  return (
    <button
      onClick={() => onClick(point, index)}
      className="group relative flex flex-col rounded-[12px] overflow-hidden text-left transition-all duration-200 hover:scale-[1.02] hover:border-[var(--border-strong)] active:scale-95 border border-[var(--border-subtle)] bg-[var(--bg-card)]"
      style={{
        boxShadow: isPending ? 'inset 0 0 20px rgba(245,166,35,0.06)' : 'inset 0 0 20px rgba(0,229,160,0.06)'
      }}
    >
      {/* Thumbnail */}
      <div className={`relative w-full aspect-square flex items-center justify-center ${point.thumbnailUrl ? '' : 'animate-shimmer'}`}>
        {point.thumbnailUrl && (
          <img src={point.thumbnailUrl} alt={`Point ${index + 1}`} className="w-full h-full object-cover" />
        )}
        <div className="absolute top-2 right-2"><StatusBadge /></div>

        {/* Bottom Frosted Strip */}
        <div
          className="absolute inset-x-0 bottom-0 py-1.5 px-2.5 flex flex-col justify-center border-t border-[var(--border-subtle)]"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex justify-between items-end mb-0.5">
            <span className="font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
              PT-{String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {point.time}
            </span>
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
              {latStr}, {lngStr}
            </span>
            <GpsBadge gpsSource={point.gps_source} />
          </div>
        </div>
      </div>
    </button>
  )
}

function Modal({ point, index, onClose }) {
  const Icon = CARD_ICONS[index % CARD_ICONS.length]
  const iconColor = CARD_COLORS[index % CARD_COLORS.length]
  const iconBg = CARD_BG[index % CARD_BG.length]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-zinc-900/50 border border-zinc-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Hero image / icon */}
        <div className={`relative w-full h-44 flex items-center justify-center ${point.thumbnailUrl ? '' : iconBg}`}>
          {point.thumbnailUrl ? (
            <img src={point.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon size={56} className={`${iconColor} opacity-75`} strokeWidth={1.2} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 rounded-full p-1.5 transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <StatusBadge />
            <GpsBadge gpsSource={point.gps_source} />
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-0.5">Scouting Point {index + 1}</h3>
            <p className="text-xs text-slate-400">
              {point.capturedAt ? new Date(point.capturedAt).toLocaleString() : 'Champaign County, IL'}
            </p>
          </div>

          {/* EXIF data grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Latitude', value: parseFloat(point.lat).toFixed(5), mono: true },
              { label: 'Longitude', value: parseFloat(point.lng).toFixed(5), mono: true },
              { label: 'Elevation', value: point.elevation_m ? `${point.elevation_m}m` : '213.0m (est.)' },
              {
                label: 'GPS Source', value: point.gps_source ?? '—',
                color: point.gps_source === 'exif' ? '#22c55e' : '#f59e0b'
              },
            ].map(({ label, value, mono, color }) => (
              <div key={label} className="rounded-lg p-2.5 flex flex-col gap-0.5" style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}>
                <span className="text-slate-500 uppercase tracking-wider text-[9px]">{label}</span>
                <span className={`text-slate-200 text-[11px] font-semibold ${mono ? 'font-mono' : ''}`}
                  style={color ? { color } : {}}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {point.summary && (
            <div className="rounded-xl p-3" style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Field Notes</p>
              <p className="text-xs text-slate-200 leading-relaxed">{point.summary}</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:text-slate-200"
            style={{ background: '#111827', border: '1px solid #1e2d4a' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScoutingScreen() {
  const navigate = useNavigate()
  const { scenario, startAssessment, status, assessmentData } = useAssessment()

  const [capturedPoints, setCapturedPoints] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const cameraInputRef = useRef(null)

  // Supabase Storage URL from the completed assessment — used as thumbnail
  // fallback when the local blob URL is gone (e.g. after a page refresh).
  const persistedPhotoUrl = assessmentData?._raw?.photo_url ?? null

  // Show captured photos first; fall back to scenario / fallback points.
  // Inject the persisted Supabase URL as the first point's thumbnail when
  // we no longer have a local blob URL (post-refresh scenario).
  const displayPoints = (capturedPoints.length > 0 ? capturedPoints : scenario.scoutingPoints)
    .map((pt, i) => ({
      ...derivePointDisplay(pt, i),
      thumbnailUrl: pt.thumbnailUrl ?? (i === 0 && persistedPhotoUrl ? persistedPhotoUrl : undefined),
    }))

  // ── Camera capture ─────────────────────────────────────────────────────────
  const handleCapture = useCallback(async (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newPoints = await filesToScoutingPoints(files)
    setCapturedPoints(prev => [...prev, ...newPoints])
    e.target.value = ''   // allow re-selecting the same file
  }, [])

  // ── Run Assessment ─────────────────────────────────────────────────────────
  async function handleRunAssessment() {
    if (isCompleted) { navigate('/report'); return }
    setSubmitting(true)
    setSubmitError(null)

    try {
      const sourcePoints = capturedPoints.length > 0
        ? capturedPoints
        : scenario.scoutingPoints

      // Strip non-serialisable fields before sending to backend
      const serialisablePoints = sourcePoints.map(({ _file, thumbnailUrl, ...rest }) => rest)

      // Real File objects for the photo upload (first file only — backend accepts one)
      const photos = capturedPoints.map(p => p._file).filter(Boolean)

      const id = await startAssessment(photos, {
        crop_type: 'corn',
        weather_event_date: new Date().toISOString(),
        county_fips: '17019',
        scouting_points: serialisablePoints,
      })

      // startAssessment returns the assessment_id on success
      if (id) {
        navigate('/agents')
      }
    } catch (err) {
      console.error('Assessment submission failed:', err)
      setSubmitError('Failed to submit — check your connection and try again.')
      setSubmitting(false)
    }
  }

  function openModal(point, index) { setSelected(point); setSelectedIndex(index) }
  function closeModal() { setSelected(null); setSelectedIndex(null) }

  const isProcessing = status === 'processing' || status === 'pending'
  const isCompleted = status === 'completed'

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg-base)] text-[var(--text-primary)] relative">
      {/* Hidden camera file input */}
      <input
        ref={cameraInputRef}
        id="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCapture}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d4a' }}
      >
        <div>
          <h1 className="text-base font-bold text-slate-100 leading-tight">Field Scouting</h1>
          <p className="text-[11px] text-slate-500">
            {displayPoints.length} point{displayPoints.length !== 1 ? 's' : ''} · Champaign Co., IL
            {capturedPoints.length > 0 &&
              <span className="text-blue-400 ml-1">· {capturedPoints.length} captured</span>
            }
          </p>
        </div>

        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-full px-6 py-2.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 border border-[var(--border-strong)]"
        >
          <Camera size={14} />
          Take Photo
        </button>
      </header>

      {/* Grid */}
      <div className="flex-1 p-4 pb-28">
        {displayPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-600">
            <Image size={32} strokeWidth={1.2} />
            <p className="text-sm">Tap "Take Photo" to capture field damage</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {displayPoints.map((point, i) => (
              <PhotoCard key={point.id} point={point} index={i} onClick={openModal} />
            ))}
          </div>
        )}

        {/* Submission error */}
        {submitError && (
          <div className="mt-4 rounded-xl p-3 text-xs text-red-400 text-center"
            style={{ background: '#1a0a0a', border: '1px solid #ef444430' }}>
            {submitError}
          </div>
        )}
      </div>

      {/* Floating Run Assessment button */}
      <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40" style={{ pointerEvents: 'none' }}>
        <button
          onClick={handleRunAssessment}
          disabled={submitting || isProcessing}
          className="group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-[var(--bg-base)] bg-[var(--accent-primary)] transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:scale-100"
          style={{
            pointerEvents: 'auto',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.02em',
            boxShadow: '0 0 24px rgba(0,229,160,0.25)',
          }}
          onMouseEnter={(e) => {
            if (!submitting && !isProcessing) {
              e.currentTarget.style.boxShadow = '0 0 32px rgba(0,229,160,0.45)'
              e.currentTarget.style.transform = 'scale(1.03)'
            }
          }}
          onMouseLeave={(e) => {
            if (!submitting && !isProcessing) {
              e.currentTarget.style.boxShadow = '0 0 24px rgba(0,229,160,0.25)'
              e.currentTarget.style.transform = 'scale(1)'
            }
          }}
        >
          <span className="text-base">
            {submitting ? 'Submitting…'
              : isProcessing ? 'Assessment Running…'
                : isCompleted ? 'View Results →'
                  : 'Run Flood Assessment'}
          </span>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Modal */}
      {selected && (
        <Modal point={selected} index={selectedIndex} onClose={closeModal} />
      )}
    </div>
  )
}
