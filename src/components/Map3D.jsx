import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { X, Zap, BarChart2, Layers } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────

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
  damage:    [{ color: '#ef4444', label: 'High Severity' }, { color: '#f59e0b', label: 'Moderate' },      { color: '#22c55e', label: 'Low / Healthy' }],
  elevation: [{ color: '#1d4ed8', label: 'Low Elevation' }, { color: '#60a5fa', label: 'Mid Elevation' }, { color: '#a5f3fc', label: 'High Elevation' }],
  zones:     [{ color: '#8b5cf6', label: 'Zone A' },         { color: '#3b82f6', label: 'Zone B' },        { color: '#10b981', label: 'Zone C' }],
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeBounds(points) {
  const lats  = points.map(p => parseFloat(p.lat))
  const lngs  = points.map(p => parseFloat(p.lng))
  const elevs = points.map(p => p.elevation).filter(Boolean)
  return {
    minLat: Math.min(...lats),  maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),  maxLng: Math.max(...lngs),
    minElev: elevs.length ? Math.min(...elevs) : 200,
    maxElev: elevs.length ? Math.max(...elevs) : 230,
  }
}

function toXZ(lat, lng, bounds) {
  const SIZE = 8.5
  const lr  = bounds.maxLat  - bounds.minLat  || 0.01
  const lgr = bounds.maxLng  - bounds.minLng  || 0.01
  return {
    x: ((parseFloat(lat) - bounds.minLat) / lr  - 0.5) * SIZE,
    z: ((parseFloat(lng) - bounds.minLng) / lgr - 0.5) * SIZE,
  }
}

function getPointColor(point, mode, bounds) {
  if (mode === 'damage')    return SEVERITY_COLORS[point.severity] ?? '#60a5fa'
  if (mode === 'zones')     return ZONE_COLORS[point.zone]         ?? '#60a5fa'
  if (mode === 'elevation' && bounds) {
    const t  = (point.elevation - bounds.minElev) / Math.max(bounds.maxElev - bounds.minElev, 1)
    const lo = new THREE.Color('#1d4ed8')
    const hi = new THREE.Color('#a5f3fc')
    return new THREE.Color().lerpColors(lo, hi, Math.min(Math.max(t, 0), 1)).getStyle()
  }
  return '#60a5fa'
}

// ─── Sub-components ────────────────────────────────────────────────────────

function PinSheet({ point, onClose }) {
  const sevColor  = SEVERITY_COLORS[point.severity] ?? '#60a5fa'
  // assignedZone (from spatial agent) takes priority over raw zone letter
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
    { label: 'Lat',       value: point.lat,   mono: true },
    { label: 'Lng',       value: point.lng,   mono: true },
    { label: 'Status',    value: point.status ?? 'Pending', color: '#f59e0b' },
  ]

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 rounded-t-2xl p-4"
      style={{
        background: '#0d1220',
        border: '1px solid #1e2d4a',
        borderBottom: 'none',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
        animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1) both',
      }}
    >
      {/* Handle bar */}
      <div className="flex justify-center mb-3">
        <div className="w-8 h-1 rounded-full bg-slate-700" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Scouting Point {point.id}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Champaign County, IL{point.time ? ` · ${point.time}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-slate-800"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      {/* Spatial agent reasoning (when enriched) */}
      {point.reasoning && (
        <div
          className="mb-2 rounded-xl p-3"
          style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
        >
          <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-1">Spatial Analysis</p>
          <p className="text-xs text-slate-200 leading-relaxed">{point.reasoning}</p>
        </div>
      )}

      {/* AI summary / field notes */}
      {point.summary && (
        <div
          className="mb-3 rounded-xl p-3"
          style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
        >
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Field Notes</p>
          <p className="text-xs text-slate-200 leading-relaxed">{point.summary}</p>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {cells.map(({ label, value, color, mono }) => (
          <div
            key={label}
            className="rounded-lg p-2"
            style={{ background: '#0a0e17', border: '1px solid #1e2d4a' }}
          >
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

// ─── Main Component ────────────────────────────────────────────────────────

export default function Map3D({
  scoutingPoints = defaultPoints,
  viewMode: initialViewMode = 'damage',
  onPinClick,
}) {
  const containerRef = useRef(null)
  const threeRef     = useRef(null)   // { scene, camera, renderer, controls }
  const pinsRef      = useRef([])     // [{ group, head, headMat, stemMat, ringMat, point }]
  const boundsRef    = useRef(null)
  const animRef      = useRef(null)
  const raycaster    = useRef(new THREE.Raycaster())
  const mouse        = useRef(new THREE.Vector2())

  const [viewMode,     setViewMode]     = useState(initialViewMode)
  const [selectedPin,  setSelectedPin]  = useState(null)

  // ── Scene setup (once) ─────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0e17')
    scene.fog = new THREE.FogExp2('#0a0e17', 0.038)

    // Camera
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.set(0, 11, 13)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    // Controls (touch + mouse, pinch + drag)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping    = true
    controls.dampingFactor    = 0.07
    controls.maxPolarAngle    = Math.PI / 2.1
    controls.minDistance      = 4
    controls.maxDistance      = 22
    controls.autoRotate       = true
    controls.autoRotateSpeed  = 0.35

    let rotTimer
    controls.addEventListener('start', () => {
      controls.autoRotate = false
      clearTimeout(rotTimer)
    })
    controls.addEventListener('end', () => {
      rotTimer = setTimeout(() => { controls.autoRotate = true }, 4000)
    })

    // Lighting
    const ambient = new THREE.AmbientLight('#1a3050', 3.5)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight('#6ea8d0', 4)
    sun.position.set(8, 12, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)

    const fill = new THREE.DirectionalLight('#0d3a5f', 1.8)
    fill.position.set(-6, 5, -8)
    scene.add(fill)

    // ── Terrain ──────────────────────────────────────────────────────────
    const tGeo = new THREE.PlaneGeometry(13, 13, 30, 30)
    tGeo.rotateX(-Math.PI / 2)
    const tPos = tGeo.attributes.position
    for (let i = 0; i < tPos.count; i++) {
      const nx = tPos.getX(i) / 6.5
      const nz = tPos.getZ(i) / 6.5
      tPos.setY(i, Math.sin(nx * 2.2) * Math.cos(nz * 2.2) * 0.13 + (Math.random() - 0.5) * 0.22)
    }
    tPos.needsUpdate = true
    tGeo.computeVertexNormals()

    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({
      color: '#0b2317', flatShading: true, roughness: 1, metalness: 0,
    }))
    terrain.receiveShadow = true
    scene.add(terrain)

    // Field border glow
    const borderEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(13.1, 0.02, 13.1))
    const border = new THREE.LineSegments(borderEdges, new THREE.LineBasicMaterial({
      color: '#1a5c35', transparent: true, opacity: 0.5,
    }))
    scene.add(border)

    // Grid overlay
    const grid = new THREE.GridHelper(13, 13, '#0d3825', '#0d3825')
    grid.position.y = 0.02
    grid.material.transparent = true
    grid.material.opacity = 0.22
    scene.add(grid)

    // Animate
    const animate = () => {
      animRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize — use ResizeObserver so any parent height change triggers a redraw
    const onResize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    threeRef.current = { scene, camera, renderer, controls }

    return () => {
      clearTimeout(rotTimer)
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      threeRef.current = null
    }
  }, [])

  // ── Build pins when scoutingPoints changes ─────────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three) return

    // Remove existing pins from scene
    pinsRef.current.forEach(({ group }) => three.scene.remove(group))
    pinsRef.current = []

    if (!scoutingPoints.length) return

    const bounds = computeBounds(scoutingPoints)
    boundsRef.current = bounds

    scoutingPoints.forEach(point => {
      const { x, z }   = toXZ(point.lat, point.lng, bounds)
      const colorStr    = getPointColor(point, viewMode, bounds)

      const group = new THREE.Group()
      group.userData.point = point

      // Stem
      const stemMat = new THREE.MeshStandardMaterial({ color: colorStr, metalness: 0.2, roughness: 0.8 })
      const stem    = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.65, 8), stemMat)
      stem.position.y = 0.42
      stem.castShadow = true
      group.add(stem)

      // Sphere head (raycasting target)
      const headMat = new THREE.MeshStandardMaterial({
        color: colorStr, emissive: colorStr, emissiveIntensity: 0.5,
        metalness: 0.35, roughness: 0.15,
      })
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), headMat)
      head.position.y   = 0.95
      head.userData.point = point
      head.castShadow   = true
      group.add(head)

      // Glow ring on ground
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorStr, transparent: true, opacity: 0.18, side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.46, 32), ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.025
      group.add(ring)

      group.position.set(x, 0, z)
      three.scene.add(group)
      pinsRef.current.push({ group, head, headMat, stemMat, ringMat, point })
    })
    // Note: viewMode intentionally not in deps — color sync handled by effect below
  }, [scoutingPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync pin colors when viewMode changes (no mesh rebuild) ───────────
  useEffect(() => {
    const bounds = boundsRef.current
    pinsRef.current.forEach(({ headMat, stemMat, ringMat, point }) => {
      const c = new THREE.Color(getPointColor(point, viewMode, bounds))
      headMat.color.copy(c);  headMat.emissive.copy(c)
      stemMat.color.copy(c)
      ringMat.color.copy(c)
    })
  }, [viewMode])

  // ── Raycasting ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    const el    = containerRef.current
    const three = threeRef.current
    if (!el || !three) return

    const rect = el.getBoundingClientRect()
    const cx   = e.clientX
    const cy   = e.clientY

    mouse.current.set(
      ((cx - rect.left) / rect.width)  *  2 - 1,
      -((cy - rect.top) / rect.height) *  2 + 1,
    )
    raycaster.current.setFromCamera(mouse.current, three.camera)

    const heads = pinsRef.current.map(p => p.head)
    const hits  = raycaster.current.intersectObjects(heads)

    if (hits.length) {
      const point = hits[0].object.userData.point
      setSelectedPin(point)
      onPinClick?.(point)
    } else {
      setSelectedPin(null)
    }
  }, [onPinClick])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Inject slide-up keyframe once */}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div className="relative w-full h-full overflow-hidden" style={{ background: '#0a0e17' }}>

        {/* Three.js mount point */}
        <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" onClick={handleClick} />

        {/* ── View mode toggle ───────────────────────────────────────────── */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-0.5 p-1 rounded-xl z-10"
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

        {/* ── Point count badge ──────────────────────────────────────────── */}
        <div
          className="absolute top-3 right-3 z-10 text-[10px] font-mono text-slate-400 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a' }}
        >
          {scoutingPoints.length} pts · Champaign Co.
        </div>

        {/* ── Legend ────────────────────────────────────────────────────── */}
        <div
          className="absolute bottom-4 left-3 z-10 rounded-xl p-3 min-w-[110px]"
          style={{ background: 'rgba(10,14,23,0.88)', border: '1px solid #1e2d4a', backdropFilter: 'blur(10px)' }}
        >
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {viewMode === 'damage' ? 'Severity' : viewMode === 'elevation' ? 'Elevation' : 'Field Zone'}
          </p>
          {LEGENDS[viewMode].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 5px ${color}99` }}
              />
              <span className="text-[11px] text-slate-300">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Interaction hint ───────────────────────────────────────────── */}
        <div
          className="absolute bottom-4 right-3 z-10 text-[9px] text-slate-600 px-2 py-1 rounded-lg text-center"
          style={{ background: 'rgba(10,14,23,0.7)', border: '1px solid #1e2d4a' }}
        >
          drag · pinch · tap pin
        </div>

        {/* ── Bottom sheet ──────────────────────────────────────────────── */}
        {selectedPin && (
          <PinSheet point={selectedPin} onClose={() => setSelectedPin(null)} />
        )}
      </div>
    </>
  )
}
