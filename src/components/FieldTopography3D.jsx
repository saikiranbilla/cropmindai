/**
 * FieldTopography3D — Field-Scale Digital Twin
 *
 * Props:
 *   fieldTopographyPoints   – GPS+elevation scouting points array
 *   floodElevationThreshold – float, metres ASL — drives live zone coloring
 *   viewMode                – 'damage' | 'elevation' | 'zones'
 *   onPinClick              – callback(point)
 *
 * Scale reference (WORLD_SCALE = 2500 deg/WU):
 *   1 WU lat  ≈ 111,000 / 2500 = 44.4 m
 *   1 WU lng  ≈  85,000 / 2500 = 34.0 m  (at 40°N)
 *   Field grid: 20×20 WU ≈ 888 m × 680 m ≈ 149 acres total
 */

import { Suspense, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ── Projection constants ───────────────────────────────────────────────────────
const BASE_ELEV   = 220.0   // metres ASL → world Y = 0
const ELEV_SCALE  = 1.0     // 1 m = 1 world unit
const LAT_CTR     = 40.110
const LNG_CTR     = -88.240
const WORLD_SCALE = 2500    // degrees → world units

function gpsToWorld(lat, lng, elev = BASE_ELEV) {
  return [
    (parseFloat(lng) - LNG_CTR) * WORLD_SCALE,
    (parseFloat(elev) - BASE_ELEV) * ELEV_SCALE,
    -(parseFloat(lat) - LAT_CTR) * WORLD_SCALE,
  ]
}

// Query terrain height at WORLD (x, z) — applies rotation inverse
// PlaneGeometry rotated -π/2 on X: geometry-Y → world -Z
// So geometry-Y = -world_Z when sampling
function heightAt(wx, wz) {
  return computeHeight(wx, -wz)
}

// ── Deterministic noise ────────────────────────────────────────────────────────
function dn(x, y, fx, fy, amp) {
  return Math.sin(x * fx + y * fy) * Math.cos(x * fy * 0.7 - y * fx * 0.4) * amp
}

// ── Procedural heightmap (geometry coords: gx, gy ∈ [-10, +10]) ───────────────
function computeHeight(gx, gy) {
  const nx = gx / 10
  const ny = gy / 10
  let h = 0

  // ── Central basin  (basin_1 GPS → world (-2.5, +2.5) → geo (-2.5, +2.5) → nx=-0.25, ny=+0.25)
  //    Note: heightAt() negates wz before passing here, so world_wz=+2.5 → gy=-2.5 → ny=-0.25
  //    Basin center at (nx=-0.25, ny=-0.25) matches basin_1 after coord transform
  const dB = Math.sqrt((nx + 0.25) ** 2 + (ny + 0.25) ** 2)
  h -= dB < 0.52 ? 2.4 * (1 - dB / 0.52) ** 1.7 : 0

  // ── Secondary pool SE ─────────────────────────────────────────────────────────
  const dP2 = Math.sqrt((nx - 0.35) ** 2 + (ny + 0.08) ** 2)
  h -= dP2 < 0.22 ? 1.05 * (1 - dP2 / 0.22) ** 2 : 0

  // ── NW hollow ────────────────────────────────────────────────────────────────
  const dP3 = Math.sqrt((nx + 0.62) ** 2 + (ny - 0.42) ** 2)
  h -= dP3 < 0.19 ? 0.80 * (1 - dP3 / 0.19) ** 2 : 0

  // ── Drainage gully south from basin (gy < -2.5) ───────────────────────────────
  const gd = Math.abs(gx + 2.5)
  if (gd < 0.88 && gy < -2.5) h -= 0.85 * (1 - gd / 0.88) * Math.min(1, (-gy - 2.5) / 5.0)

  // ── Secondary NE drainage gully ───────────────────────────────────────────────
  const gd2 = Math.abs(gx - 3.2 - ny * 0.4)
  if (gd2 < 0.55 && gy > 1.5) h -= 0.45 * (1 - gd2 / 0.55) * Math.min(1, (gy - 1.5) / 4.0)

  // ── West ridge (ridge_1 GPS → world(-5,-2.5) → geo(-5,+2.5) → nx=-0.5, ny=+0.25) ─
  const rf  = Math.max(0, -nx - 0.08) / 0.92
  const rny = Math.exp(-((ny - 0.25) ** 2) / 0.11)
  h += 2.65 * rf ** 1.05 * rny

  // ── East rolling hills ────────────────────────────────────────────────────────
  const ef = Math.max(0, nx - 0.05) ** 0.72
  h += 1.35 * ef * (0.5 + 0.5 * Math.cos(ny * Math.PI * 2.3))

  // ── Background undulation (3 octaves) ─────────────────────────────────────────
  h += dn(nx, ny, 19.8, 29.3, 0.27)
  h += dn(nx + 0.73, ny + 0.31, 41.5, 58.7, 0.12)
  h += dn(nx + 1.17, ny - 0.59, 83.1, 107.3, 0.05)

  return h
}

// ── Zone vertex colour based on flood threshold ────────────────────────────────
function zoneRGB(worldY, threshold) {
  const elev = worldY + BASE_ELEV
  if (elev < threshold) {
    // Submerged — deep navy → royal blue
    const t = Math.min(1, (threshold - elev) / 2.5)
    return [0.04 + t * 0.06, 0.12 + t * 0.10, 0.60 + t * 0.28]
  }
  if (elev < threshold + 1.0) {
    // Waterlogged — teal-cyan
    const t = (elev - threshold)
    return [0.02, 0.50 + t * 0.20, 0.70 - t * 0.08]
  }
  if (elev < threshold + 1.5) {
    // Marginal — lime yellow
    const t = (elev - threshold - 1.0) / 0.5
    return [0.28 + t * 0.12, 0.60 + t * 0.12, 0.10]
  }
  // Dry / Optimal — neon emerald
  const t = Math.min(1, (elev - threshold - 1.5) / 2.5)
  return [0.03, 0.28 + t * 0.25, 0.16 + t * 0.14]
}

// ── Terrain mesh ──────────────────────────────────────────────────────────────
function Terrain({ floodElevationThreshold, viewMode }) {
  const heightsRef = useRef(null)
  const gyArrRef   = useRef(null) // geometry-Y per vertex — needed for zone parcel detection

  const geometry = useMemo(() => {
    const SEGS = 180
    const g    = new THREE.PlaneGeometry(20, 20, SEGS, SEGS)
    const pos  = g.attributes.position
    const n    = pos.count
    const ht   = new Float32Array(n)
    const gy   = new Float32Array(n)
    const col  = new Float32Array(n * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    for (let i = 0; i < n; i++) {
      const gyVal = pos.getY(i)
      const h     = computeHeight(pos.getX(i), gyVal)
      pos.setZ(i, h)
      ht[i] = h
      gy[i] = gyVal
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    heightsRef.current = ht
    gyArrRef.current   = gy
    return g
  }, [])

  // Reactive colour update — reruns on threshold OR viewMode change
  useEffect(() => {
    if (!geometry || !heightsRef.current || !gyArrRef.current) return
    const col = geometry.attributes.color
    const ht  = heightsRef.current
    const gy  = gyArrRef.current

    for (let i = 0, n = ht.length; i < n; i++) {
      let r, g, b

      if (viewMode === 'elevation') {
        // ── Hypsometric: absolute elevation bands, threshold-independent ──
        const elev = ht[i] + BASE_ELEV
        if      (elev < 218.5) { r = 0.05; g = 0.14; b = 0.68 } // deep navy
        else if (elev < 219.5) { r = 0.10; g = 0.40; b = 0.72 } // mid blue
        else if (elev < 220.5) { r = 0.16; g = 0.52; b = 0.28 } // forest green
        else if (elev < 221.5) { r = 0.52; g = 0.40; b = 0.16 } // brown
        else                   { r = 0.72; g = 0.64; b = 0.48 } // sandy peak

      } else if (viewMode === 'zones') {
        // ── Parcel zones: north / centre / south based on geometry-Y ──────
        // geometry-Y > +3.5  →  world-Z < -3.5  →  north parcel
        // geometry-Y < -3.8  →  world-Z > +3.8  →  south parcel
        if      (gy[i] > 3.5)  { r = 0.50; g = 0.18; b = 0.84 } // purple — north
        else if (gy[i] < -3.8) { r = 0.88; g = 0.52; b = 0.08 } // amber  — south
        else                   { r = 0.06; g = 0.50; b = 0.28 } // emerald — centre

      } else {
        // ── Damage / flood-zone: threshold-reactive (default) ─────────────
        ;[r, g, b] = zoneRGB(ht[i], floodElevationThreshold)
      }

      col.setXYZ(i, r, g, b)
    }
    col.needsUpdate = true
  }, [floodElevationThreshold, viewMode, geometry])

  return (
    <group>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.80} metalness={0.07} />
      </mesh>
      {/* Faint emerald scan-grid wireframe */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#10b981" wireframe transparent opacity={0.055}
          polygonOffset polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}

// ── Animated flood water plane ─────────────────────────────────────────────────
function FloodSurface({ floodElevationThreshold }) {
  const matRef = useRef()
  const worldY = (floodElevationThreshold - BASE_ELEV) * ELEV_SCALE - 0.07

  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.28 + Math.sin(clock.getElapsedTime() * 1.5) * 0.09
  })

  return (
    <mesh position={[0, worldY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[22, 22]} />
      <meshStandardMaterial
        ref={matRef}
        color="#1d4ed8"
        transparent opacity={0.32}
        roughness={0.0} metalness={0.70}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Scale bar (3D scene — 100 m reference line, bottom-right corner) ──────────
// 100 m in world units: 100 / 44.4 ≈ 2.25 WU (using lat-direction metre/WU)
const SCALE_WU = 2.25

function ScaleLine() {
  const wx = 6.8, wz = 8.5
  const y  = heightAt(wx, wz) + 0.55
  const hw = SCALE_WU / 2
  return (
    <group position={[wx, y, wz]}>
      {/* Horizontal bar */}
      <mesh><boxGeometry args={[SCALE_WU, 0.04, 0.04]} />
        <meshStandardMaterial color="#f1f5f9" emissive="#f1f5f9" emissiveIntensity={2.2} />
      </mesh>
      {/* Left cap */}
      <mesh position={[-hw, 0, 0]}><boxGeometry args={[0.04, 0.24, 0.04]} />
        <meshStandardMaterial color="#f1f5f9" emissive="#f1f5f9" emissiveIntensity={2.2} />
      </mesh>
      {/* Right cap */}
      <mesh position={[hw, 0, 0]}><boxGeometry args={[0.04, 0.24, 0.04]} />
        <meshStandardMaterial color="#f1f5f9" emissive="#f1f5f9" emissiveIntensity={2.2} />
      </mesh>
      <Html position={[0, 0.36, 0]} center distanceFactor={10} occlude={false}>
        <div style={{
          color: '#f1f5f9', fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.70)', padding: '2px 6px', borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.18)',
        }}>≈ 100 m</div>
      </Html>
    </group>
  )
}

// ── Neon field boundary tubes ──────────────────────────────────────────────────
function FieldBorders() {
  const geos = useMemo(() => {
    // All coords are [world_x, world_z] — heightAt() lifts them onto terrain
    const outer = [
      [-9.5, -9.5], [-8.0, -10.1], [-6.1, -9.5], [-4.4, -9.9],
      [-2.2, -9.3], [-0.3, -9.7], [1.7, -9.2], [4.0, -9.6],
      [6.3, -9.1], [8.5, -9.5], [10.1, -9.0],
      [10.2, -6.7], [9.8, -4.1], [10.3, -1.4],
      [9.9, 1.3], [10.4, 4.1], [10.0, 6.9], [10.2, 9.3],
      [7.6, 10.2], [4.9, 9.7], [2.3, 10.1],
      [-0.5, 9.6], [-3.0, 10.0], [-5.7, 9.5], [-8.1, 9.9], [-9.7, 9.3],
      [-10.2, 6.6], [-9.8, 3.9], [-10.3, 1.1],
      [-9.9, -1.7], [-10.4, -4.4], [-10.0, -7.1],
    ]

    // North parcel divider (world_z ≈ -3.5 — separates north and central parcels)
    const northDiv = [
      [-9.9, -3.2], [-7.1, -3.9], [-4.7, -3.4],
      [-2.0, -3.8], [0.5, -3.1], [3.0, -3.6],
      [5.5, -3.3], [7.9, -3.9], [9.9, -3.1],
    ]

    // SW parcel divider (world_z ≈ +3.8)
    const swDiv = [
      [-9.9, 3.6], [-7.4, 4.3], [-5.2, 3.9],
      [-3.1, 4.4], [-1.0, 4.0], [0.6, 4.6],
    ]

    function makeTube(raw, closed, r, color) {
      const pts = raw.map(([wx, wz]) =>
        new THREE.Vector3(wx, heightAt(wx, wz) + 0.42, wz)
      )
      const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.25)
      const segs  = closed ? 280 : pts.length * 24
      return { geo: new THREE.TubeGeometry(curve, segs, r, 6, closed), color }
    }

    return [
      makeTube(outer,    true,  0.065, '#10b981'),
      makeTube(northDiv, false, 0.042, '#06b6d4'),
      makeTube(swDiv,    false, 0.042, '#06b6d4'),
    ]
  }, [])

  return (
    <>
      {geos.map(({ geo, color }, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial
            color={color} emissive={color} emissiveIntensity={2.3}
            roughness={0.08} metalness={0.4}
          />
        </mesh>
      ))}
    </>
  )
}

// ── Scouting pin ──────────────────────────────────────────────────────────────
function Pin({ wx, wz, elevation, label, sublabel, color, point, onPinClick }) {
  const pinY = heightAt(wx, wz) + 0.12

  return (
    <group position={[wx, pinY, wz]}>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.19, 0.28, 24]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={2.2}
          transparent opacity={0.65} side={THREE.DoubleSide}
        />
      </mesh>

      {/* Stem */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.028, 0.052, 1.15, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.20, 0]}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={1.5}
          roughness={0.04} metalness={0.45}
        />
      </mesh>

      {/* Label */}
      <Html position={[0.30, 1.35, 0]} distanceFactor={10} occlude={false}>
        <div
          onClick={() => onPinClick?.(point)}
          style={{
            cursor: 'pointer',
            background: 'rgba(4,8,18,0.95)',
            border: `1px solid ${color}`,
            borderRadius: 7,
            padding: '3px 9px',
            whiteSpace: 'nowrap',
            boxShadow: `0 0 16px ${color}55, 0 2px 10px rgba(0,0,0,0.75)`,
            userSelect: 'none',
          }}
        >
          <p style={{ color, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', margin: 0 }}>
            {label}
          </p>
          {sublabel && (
            <p style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace', margin: 0 }}>
              {sublabel}
            </p>
          )}
        </div>
      </Html>
    </group>
  )
}

// ── Pin colour by type / severity ─────────────────────────────────────────────
const TYPE_COLOR = {
  RIDGE: '#22c55e', INTERMEDIATE: '#f59e0b',
  POOL: '#3b82f6',  SENSOR: '#06b6d4',
  high: '#ef4444',  moderate: '#f59e0b', low: '#22c55e',
}
function pinColor(pt) {
  return TYPE_COLOR[pt.type] ?? TYPE_COLOR[pt.severity] ?? '#60a5fa'
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ fieldTopographyPoints, floodElevationThreshold, viewMode, onPinClick }) {
  return (
    <>
      <color attach="background" args={['#060c18']} />
      <fog attach="fog" args={['#060c18', 32, 58]} />

      <ambientLight intensity={0.48} color="#19304a" />
      <directionalLight
        position={[11, 19, 9]} intensity={3.5} color="#9dc2d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={42} shadow-camera-near={0.5}
        shadow-camera-left={-14} shadow-camera-right={14}
        shadow-camera-top={14}  shadow-camera-bottom={-14}
      />
      <directionalLight position={[-9, 9, -13]} intensity={0.85} color="#0c3858" />
      {/* Blue glow over flooded area */}
      <pointLight position={[0, (floodElevationThreshold - BASE_ELEV) + 1, 0]}
        intensity={7} color="#1d4ed8" distance={9} decay={2} />
      <pointLight position={[-5, 1.5, -2]} intensity={2.8} color="#10b981" distance={20} decay={1.5} />

      <Suspense fallback={null}>
        <Terrain floodElevationThreshold={floodElevationThreshold} viewMode={viewMode} />
        <FloodSurface floodElevationThreshold={floodElevationThreshold} />
        <FieldBorders />
        <ScaleLine />

        {fieldTopographyPoints.map((pt) => {
          const [wx, , wz] = gpsToWorld(pt.lat, pt.lng, pt.elevation)
          const color      = pinColor(pt)
          const elevStr    = pt.elevation != null ? `${Number(pt.elevation).toFixed(1)}m` : '—'
          const typeStr    = pt.type ?? (pt.zone ? `Zone ${pt.zone}` : '')
          return (
            <Pin
              key={pt.id}
              wx={wx} wz={wz}
              elevation={pt.elevation ?? BASE_ELEV}
              label={`${elevStr} — ${pt.status ?? 'Unknown'}`}
              sublabel={typeStr}
              color={color}
              point={pt}
              onPinClick={onPinClick}
            />
          )
        })}
      </Suspense>

      <OrbitControls
        makeDefault enableDamping dampingFactor={0.07}
        maxPolarAngle={Math.PI / 2.08}
        minDistance={6} maxDistance={42}
        autoRotate autoRotateSpeed={0.20}
        target={[0, 0, 0]}
      />
    </>
  )
}

// ── Default mock data ─────────────────────────────────────────────────────────
export const DEFAULT_TOPO_POINTS = [
  { id: 'ridge_1',  type: 'RIDGE',        lat: 40.111, lng: -88.242, elevation: 222.0, status: 'Dry Runoff',        severity: 'low'      },
  { id: 'slope_1',  type: 'INTERMEDIATE', lat: 40.110, lng: -88.240, elevation: 220.5, status: 'Optimal',          severity: 'low'      },
  { id: 'basin_1',  type: 'POOL',         lat: 40.109, lng: -88.241, elevation: 218.0, status: 'Severe Pooling',   severity: 'high'     },
  { id: 'sensor_1', type: 'SENSOR',       lat: 40.108, lng: -88.239, elevation: 219.8, status: 'Mod. Moisture',    severity: 'moderate' },
  { id: 'sensor_2', type: 'SENSOR',       lat: 40.112, lng: -88.238, elevation: 221.0, status: 'Low Moisture',     severity: 'low'      },
]

// ── Main export ───────────────────────────────────────────────────────────────
export default function FieldTopography3D({
  fieldTopographyPoints = DEFAULT_TOPO_POINTS,
  floodElevationThreshold = 219.5,
  viewMode = 'damage',
  onPinClick,
}) {
  const centroid = useMemo(() => {
    if (!fieldTopographyPoints.length) return { lat: LAT_CTR.toFixed(4), lng: LNG_CTR.toFixed(4) }
    const lat = fieldTopographyPoints.reduce((s, p) => s + parseFloat(p.lat), 0) / fieldTopographyPoints.length
    const lng = fieldTopographyPoints.reduce((s, p) => s + parseFloat(p.lng), 0) / fieldTopographyPoints.length
    return { lat: lat.toFixed(4), lng: lng.toFixed(4) }
  }, [fieldTopographyPoints])

  return (
    <div className="relative w-full h-full" style={{ background: '#060c18' }}>
      <Canvas
        shadows
        camera={{ position: [15, 13, 15], fov: 47 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene
          fieldTopographyPoints={fieldTopographyPoints}
          floodElevationThreshold={floodElevationThreshold}
          viewMode={viewMode}
          onPinClick={onPinClick}
        />
      </Canvas>

      {/* Telemetry HUD */}
      <div
        className="absolute top-3 left-3 pointer-events-none z-10 rounded-lg px-3 py-2"
        style={{ background: 'rgba(0,0,0,0.78)', border: '1px solid rgba(16,185,129,0.38)', backdropFilter: 'blur(8px)' }}
      >
        <p style={{ fontFamily: 'monospace', fontSize: 9, lineHeight: 1.85, color: '#4ade80', margin: 0 }}>
          LAT: {centroid.lat} | LNG: {centroid.lng}<br />
          THRESHOLD: {Number(floodElevationThreshold).toFixed(1)}m ASL | MODE: {viewMode.toUpperCase()}<br />
          POINTS: {fieldTopographyPoints.length} | TERRAIN_MESH: ACTIVE
        </p>
      </div>
    </div>
  )
}
