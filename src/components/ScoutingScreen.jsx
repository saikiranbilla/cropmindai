import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  MapPin,
  Clock,
  X,
  ChevronRight,
  Leaf,
  Droplets,
  Wind,
  AlertTriangle,
  CheckCircle,
  CloudRain,
} from 'lucide-react'
import { useDemo } from '../context/DemoContext'

const POINT_TIMES = ['10:15 AM', '10:22 AM', '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM']

function derivePointDisplay(pt, idx) {
  const sevLabel = { high: 'Severe', medium: 'Moderate', low: 'Minor' }[pt.severity] ?? 'Observable'
  return {
    ...pt,
    lat: String(pt.lat),
    lng: String(pt.lng),
    time: POINT_TIMES[idx] ?? '—',
    status: 'Pending',
    summary: `${sevLabel} ${pt.damageType.toLowerCase()} detected in Zone ${pt.zone}. Scouting point ${idx + 1} of field unit.`,
  }
}

const CARD_ICONS = [Leaf, Droplets, AlertTriangle, Leaf, Wind, CheckCircle, AlertTriangle, CloudRain]
const CARD_COLORS = [
  'text-yellow-400', 'text-blue-400', 'text-orange-400', 'text-red-400',
  'text-purple-400', 'text-green-400', 'text-red-500', 'text-cyan-400',
]
const CARD_BG = [
  'bg-yellow-400/10', 'bg-blue-400/10', 'bg-orange-400/10', 'bg-red-400/10',
  'bg-purple-400/10', 'bg-green-400/10', 'bg-red-500/10', 'bg-cyan-400/10',
]

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      Pending
    </span>
  )
}

function PhotoCard({ point, index, onClick }) {
  const Icon = CARD_ICONS[index]
  const iconColor = CARD_COLORS[index]
  const iconBg = CARD_BG[index]

  return (
    <button
      onClick={() => onClick(point, index)}
      className="group relative flex flex-col rounded-xl overflow-hidden text-left transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ background: '#111827', border: '1px solid #1e2d4a' }}
    >
      {/* Thumbnail */}
      <div className={`relative w-full aspect-square flex items-center justify-center ${iconBg}`}>
        <Icon size={36} className={`${iconColor} opacity-80`} strokeWidth={1.5} />
        <div className="absolute top-2 right-2">
          <StatusBadge />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-300 bg-black/50 px-1.5 py-0.5 rounded">
          PT-{String(index + 1).padStart(2, '0')}
        </div>
      </div>

      {/* Meta */}
      <div className="p-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <MapPin size={9} className="text-blue-400 shrink-0" />
          <span className="font-mono truncate">{point.lat}, {point.lng}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={9} className="shrink-0" />
          <span>{point.time}</span>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-blue-500/90 rounded-full p-0.5">
          <ChevronRight size={10} className="text-white" />
        </div>
      </div>
    </button>
  )
}

function Modal({ point, index, onClose }) {
  const Icon = CARD_ICONS[index]
  const iconColor = CARD_COLORS[index]
  const iconBg = CARD_BG[index]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0d1220', border: '1px solid #1e2d4a' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal thumbnail */}
        <div className={`relative w-full h-40 flex items-center justify-center ${iconBg}`}>
          <Icon size={56} className={`${iconColor} opacity-75`} strokeWidth={1.2} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 rounded-full p-1.5 transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-3">
            <StatusBadge />
          </div>
        </div>

        {/* Modal content */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-0.5">
              Scouting Point {index + 1} — Mini Diagnosis
            </h3>
            <p className="text-xs text-slate-400">Champaign County, IL · June 14, 2025</p>
          </div>

          <div
            className="rounded-xl p-3.5 flex flex-col gap-2"
            style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
          >
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">AI Summary</p>
            <p className="text-sm text-slate-200 leading-relaxed">{point.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className="rounded-lg p-2.5 flex flex-col gap-0.5"
              style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
            >
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Latitude</span>
              <span className="font-mono text-slate-200">{point.lat}</span>
            </div>
            <div
              className="rounded-lg p-2.5 flex flex-col gap-0.5"
              style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
            >
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Longitude</span>
              <span className="font-mono text-slate-200">{point.lng}</span>
            </div>
            <div
              className="rounded-lg p-2.5 flex flex-col gap-0.5 col-span-2"
              style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
            >
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Captured</span>
              <span className="text-slate-200">{point.time} · 06/14/2025</span>
            </div>
          </div>

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

export default function ScoutingScreen() {
  const navigate = useNavigate()
  const { demoMode, scenario } = useDemo()
  const scoutingData = demoMode
    ? scenario.scoutingPoints.map(derivePointDisplay)
    : []

  const [selected, setSelected] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)

  function openModal(point, index) {
    setSelected(point)
    setSelectedIndex(index)
  }

  function closeModal() {
    setSelected(null)
    setSelectedIndex(null)
  }

  return (
    <div className="flex flex-col min-h-full" style={{ background: '#0a0e17' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d4a' }}
      >
        <div>
          <h1 className="text-base font-bold text-slate-100 leading-tight">Field Scouting</h1>
          <p className="text-[11px] text-slate-500">{scoutingData.length} points · Champaign Co., IL</p>
        </div>
        <button
          className="flex items-center gap-1.5 min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold text-blue-400 transition-colors duration-150 hover:text-blue-300"
          style={{ background: '#0d1f3c', border: '1px solid #1e3a5f' }}
        >
          <Camera size={14} />
          Capture New
        </button>
      </header>

      {/* Grid */}
      <div className="flex-1 p-4 pb-28">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {scoutingData.map((point, i) => (
            <PhotoCard key={point.id} point={point} index={i} onClick={openModal} />
          ))}
        </div>
      </div>

      {/* Floating Run Assessment button */}
      <div
        className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40"
        style={{ pointerEvents: 'none' }}
      >
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold text-white shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
            boxShadow: '0 0 24px rgba(59,130,246,0.4), 0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
          }}
        >
          <span className="text-base">Run Assessment</span>
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
