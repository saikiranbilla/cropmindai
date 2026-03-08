import { useState, useMemo } from 'react'
import { X, Zap, BarChart2, Layers } from 'lucide-react'
import FieldTopography3D, { DEFAULT_TOPO_POINTS } from './FieldTopography3D'

// ─── Constants ──────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'damage',    label: 'Damage',    Icon: Zap },
  { id: 'elevation', label: 'Elevation', Icon: BarChart2 },
  { id: 'zones',     label: 'Zones',     Icon: Layers },
]

const SEVERITY_COLORS = {
  high: '#ef4444', moderate: '#f59e0b', medium: '#f59e0b', low: '#22c55e', none: '#22c55e',
}

const ZONE_COLORS = {
  A: '#8b5cf6', B: '#3b82f6', C: '#10b981', D: '#f59e0b', E: '#ef4444',
}

const LEGENDS = {
  damage:    [{ color: '#ef4444', label: 'High Severity' }, { color: '#f59e0b', label: 'Moderate' }, { color: '#22c55e', label: 'Low / Healthy' }],
  elevation: [{ color: '#1d4ed8', label: 'Submerged' }, { color: '#06b6d4', label: 'Waterlogged (+1m)' }, { color: '#84cc16', label: 'Marginal (+1.5m)' }, { color: '#10b981', label: 'Dry / Optimal' }],
  zones:     [{ color: '#10b981', label: 'Main Field' }, { color: '#06b6d4', label: 'Parcel Dividers' }, { color: '#22c55e', label: 'RIDGE' }, { color: '#3b82f6', label: 'POOL' }, { color: '#06b6d4', label: 'SENSOR' }],
}

const defaultPoints = [
  { id: 1, lat: '40.1105', lng: '-88.2401', severity: 'high',     elevation: 210, zone: 'A', time: '10:15 AM', status: 'Pending', summary: 'Visible leaf shredding on upper canopy. Est V10 stage.' },
  { id: 2, lat: '40.1112', lng: '-88.2395', severity: 'moderate', elevation: 215, zone: 'B', time: '10:22 AM', status: 'Pending', summary: 'Ponding in low elevation zone. Potential stand loss.' },
  { id: 3, lat: '40.1098', lng: '-88.2410', severity: 'moderate', elevation: 208, zone: 'A', time: '10:30 AM', status: 'Pending', summary: 'Stalk bruising detected. Node integrity intact.' },
  { id: 4, lat: '40.1120', lng: '-88.2380', severity: 'high',     elevation: 218, zone: 'C', time: '10:45 AM', status: 'Pending', summary: 'Severe defoliation. Horizontal leaf method indicates 12-leaf.' },
  { id: 5, lat: '40.1085', lng: '-88.2425', severity: 'low',      elevation: 205, zone: 'B', time: '11:00 AM', status: 'Pending', summary: 'Minor edge damage, likely wind-induced lodging.' },
  { id: 6, lat: '40.1130', lng: '-88.2370', severity: 'low',      elevation: 222, zone: 'C', time: '11:15 AM', status: 'Pending', summary: 'Healthy baseline check. No visible peril.' },
  { id: 7, lat: '40.1070', lng: '-88.2440', severity: 'high',     elevation: 203, zone: 'A', time: '11:30 AM', status: 'Pending', summary: 'Hail impact on main stem. Assessing cripple status.' },
  { id: 8, lat: '40.1145', lng: '-88.2355', severity: 'moderate', elevation: 225, zone: 'C', time: '11:45 AM', status: 'Pending', summary: 'Waterlogged soils, root mass unanchored.' },
]

// ─── PinSheet bottom drawer ──────────────────────────────────────────────────

function PinSheet({ point, onClose }) {
  const sevColor    = SEVERITY_COLORS[point.severity] ?? '#60a5fa'
  const displayZone = point.assignedZone ?? (point.zone ? `Zone ${point.zone}` : '—')
  const zoneColor   = ZONE_COLORS[point.zone] ?? '#60a5fa'
  const elevDisplay = point.elevation_est
    ? `${point.elevation_est}m (est.)`
    : point.elevation
      ? `${point.elevation}m`
      : '—'

  const cells = [
    { label: 'Severity',  value: point.severity  ?? '—', color: sevColor },
    { label: 'Elevation', value: elevDisplay },
    { label: 'Zone',      value: displayZone,             color: zoneColor },
    { label: 'Lat',       value: point.lat,               mono: true },
    { label: 'Lng',       value: point.lng,               mono: true },
    { label: 'Status',    value: point.status ?? 'Pending', color: '#f59e0b' },
  ]

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 rounded-t-2xl p-4"
      style={{
        background:   '#0d1220',
        border:       '1px solid #1e2d4a',
        borderBottom: 'none',
        boxShadow:    '0 -8px 40px rgba(0,0,0,0.7)',
        animation:    'slideUp 0.25s cubic-bezier(0.4,0,0.2,1) both',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center mb-3">
        <div className="w-8 h-1 rounded-full bg-slate-700" />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Scouting Point {point.id}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Champaign County, IL{point.time ? ` · ${point.time}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-slate-800">
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      {point.reasoning && (
        <div className="mb-2 rounded-xl p-3" style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}>
          <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-1">Spatial Analysis</p>
          <p className="text-xs text-slate-200 leading-relaxed">{point.reasoning}</p>
        </div>
      )}

      {point.summary && (
        <div className="mb-3 rounded-xl p-3" style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}>
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Field Notes</p>
          <p className="text-xs text-slate-200 leading-relaxed">{point.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {cells.map(({ label, value, color, mono }) => (
          <div key={label} className="rounded-lg p-2" style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}>
            <p className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</p>
            <p
              className={`text-[11px] font-semibold mt-0.5 capitalize ${mono ? 'font-mono text-[9px]' : ''}`}
              style={{ color: color ?? '#e2e8f0' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

// Transform scoutingPoints → fieldTopographyPoints shape
function toTopoPoints(scoutingPoints) {
  return scoutingPoints.map(pt => {
    let elev = pt.elevation_m ?? pt.elevation ?? 220.0
    // Reject implausible elevations (e.g. mock data using arbitrary integers)
    if (elev < 210 || elev > 240) elev = 220.0
    return {
      id:        pt.id ?? `pt-${pt.lat}-${pt.lng}`,
      type:      pt.severity === 'high' ? 'POOL' : pt.severity === 'low' ? 'RIDGE' : 'INTERMEDIATE',
      lat:       parseFloat(pt.lat),
      lng:       parseFloat(pt.lng),
      elevation: elev,
      status:    pt.status ?? (pt.severity === 'high' ? 'High Severity' : 'Monitoring'),
      severity:  pt.severity,
      zone:      pt.zone,
      summary:   pt.summary,
      time:      pt.time,
    }
  })
}

export default function Map3D({
  scoutingPoints = defaultPoints,
  viewMode: initialViewMode = 'damage',
  onPinClick,
}) {
  const [viewMode,      setViewMode]      = useState(initialViewMode)
  const [selectedPin,   setSelectedPin]   = useState(null)
  const [floodThreshold, setFloodThreshold] = useState(219.5)

  // Derive topography points; fall back to built-in mock if all elevations were implausible
  const fieldTopographyPoints = useMemo(() => {
    const mapped = toTopoPoints(scoutingPoints)
    const hasRealElev = mapped.some(p => p.elevation !== 220.0)
    return hasRealElev ? mapped : DEFAULT_TOPO_POINTS
  }, [scoutingPoints])

  function handlePinClick(point) {
    setSelectedPin(point)
    onPinClick?.(point)
  }

  return (
    <>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div className="relative w-full h-full overflow-hidden" style={{ background: '#070d18' }}>

        {/* ── 3-D Terrain Canvas — fills the entire container ──────────── */}
        <div className="absolute inset-0">
          <FieldTopography3D
            fieldTopographyPoints={fieldTopographyPoints}
            floodElevationThreshold={floodThreshold}
            viewMode={viewMode}
            onPinClick={handlePinClick}
          />
        </div>

        {/* ── View mode toggle — top centre ─────────────────────────────── */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 p-1 rounded-xl"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a', backdropFilter: 'blur(10px)' }}
        >
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                viewMode === id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Point count badge — top right ─────────────────────────────── */}
        <div
          className="absolute top-3 right-3 z-20 text-[10px] font-mono text-slate-400 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a' }}
        >
          {scoutingPoints.length} pts · Champaign Co.
        </div>

        {/* ── Severity legend — bottom left (damage view only) ──────────── */}
        <div
          className="absolute bottom-4 left-3 z-20 rounded-xl p-3 min-w-[110px]"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a', backdropFilter: 'blur(10px)' }}
        >
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pin Severity</p>
          {[
            { color: '#ef4444', label: 'High / Pool' },
            { color: '#f59e0b', label: 'Moderate' },
            { color: '#22c55e', label: 'Low / Ridge' },
            { color: '#06b6d4', label: 'Sensor' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}99` }} />
              <span className="text-[11px] text-slate-300">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#10b98133', border: '1.5px solid #10b981' }} />
            <span className="text-[11px] text-slate-300">Field Border</span>
          </div>
          <p className="text-[8px] text-slate-600 mt-2">drag · pinch · tap pin</p>
        </div>

        {/* ── Flood threshold slider — bottom right ─────────────────────── */}
        <div
          className="absolute bottom-4 right-3 z-20 rounded-xl p-3 min-w-[170px]"
          style={{ background: 'rgba(10,14,23,0.92)', border: '1px solid #1e2d4a', backdropFilter: 'blur(10px)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Flood Level</p>
            <span className="text-[11px] font-mono text-blue-400 font-bold">{floodThreshold.toFixed(1)}m</span>
          </div>
          <input
            type="range"
            min="217.5" max="222.5" step="0.1"
            value={floodThreshold}
            onChange={e => setFloodThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right,#3b82f6 0%,#3b82f6 ${((floodThreshold - 217.5) / 5) * 100}%,#1e293b ${((floodThreshold - 217.5) / 5) * 100}%,#1e293b 100%)`,
              outline: 'none',
            }}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] font-mono text-slate-600">217.5m</span>
            <span className="text-[8px] font-mono text-slate-400 text-center">drag to flood</span>
            <span className="text-[8px] font-mono text-slate-600">222.5m</span>
          </div>
          {/* Zone legend inline */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-col gap-1">
            {[
              { color: '#1d4ed8', label: 'Submerged' },
              { color: '#06b6d4', label: 'Waterlogged +1m' },
              { color: '#84cc16', label: 'Marginal +1.5m' },
              { color: '#10b981', label: 'Dry / Optimal' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}99` }} />
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Field scale / acreage panel — bottom centre ───────────────── */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 rounded-xl px-3 py-2"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}
        >
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 text-center">Field Scale</p>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ background: '#a855f7', boxShadow: '0 0 4px #a855f799' }} />
              <p className="text-[8px] text-slate-500">North</p>
              <p className="text-[11px] font-mono text-purple-400 font-bold">~49 ac</p>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="text-center">
              <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ background: '#10b981', boxShadow: '0 0 4px #10b98199' }} />
              <p className="text-[8px] text-slate-500">Centre</p>
              <p className="text-[11px] font-mono text-emerald-400 font-bold">~55 ac</p>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="text-center">
              <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ background: '#f59e0b', boxShadow: '0 0 4px #f59e0b99' }} />
              <p className="text-[8px] text-slate-500">South</p>
              <p className="text-[11px] font-mono text-amber-400 font-bold">~45 ac</p>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="text-center">
              <p className="text-[8px] text-slate-500">Total</p>
              <p className="text-[11px] font-mono text-slate-200 font-bold">~149 ac</p>
              <p className="text-[8px] text-slate-600">≈888×680m</p>
            </div>
          </div>
        </div>

        {/* ── PinSheet — slides up from bottom on pin click ──────────────── */}
        {selectedPin && (
          <PinSheet point={selectedPin} onClose={() => setSelectedPin(null)} />
        )}
      </div>
    </>
  )
}
