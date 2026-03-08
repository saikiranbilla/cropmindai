/**
 * Field3D — procedural terrain "Digital Twin" using React Three Fiber.
 *
 * Scene layout (world space):
 *   - Terrain: 10×10 PlaneGeometry, rotated flat (-π/2 around X)
 *     → geometry Z values become world Y (height)
 *   - Basin: centred near world (-0.75, -2.2, 0)  — deep pooling hollow
 *   - Ridge: right side, world X ≈ 4–5, world Y ≈ +2.5  — elevated runoff zone
 *   - Water:  animated transparent disc sitting at basin floor
 *   - Border: CatmullRomCurve3 → TubeGeometry (neon-emerald glow)
 *   - Pins:   drei <Html> labels at basin and ridge
 */

import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ─── Terrain ─────────────────────────────────────────────────────────────────

function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(10, 10, 128, 128)
    const pos = g.attributes.position
    const count = pos.count
    const cols = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const x  = pos.getX(i)   // −5 … +5
      const y  = pos.getY(i)   // −5 … +5  (becomes world-Z after mesh rotation)
      const nx = x / 5         // normalised −1 … +1
      const ny = y / 5

      // ── Basin: smooth paraboloid centred at (nx≈−0.15, ny≈0) ──────────
      const distB = Math.sqrt((nx + 0.15) ** 2 + ny ** 2)
      let h = distB < 0.55 ? -2.5 * (1 - distB / 0.55) ** 2 : 0

      // ── Ridge: power-curve ramp on the positive-X flank ────────────────
      const rf = Math.max(0, nx - 0.25) / 0.75
      h += 2.8 * rf ** 1.15

      // ── Background undulation — subtle terrain texture ──────────────────
      h += Math.sin(nx * Math.PI * 1.6) * Math.cos(ny * Math.PI * 1.3) * 0.18

      // ── Micro-noise ─────────────────────────────────────────────────────
      h += (Math.random() - 0.5) * 0.22

      pos.setZ(i, h)

      // ── Vertex colours: deep blue (low) → dark forest green (high) ──────
      // low  #1e3a5f  →  high  #14532d
      const t = Math.min(Math.max((h + 2.5) / 5.5, 0), 1)
      cols[i * 3]     = 0.118 + t * (0.082 - 0.118)
      cols[i * 3 + 1] = 0.227 + t * (0.325 - 0.227)
      cols[i * 3 + 2] = 0.373 + t * (0.176 - 0.373)
    }

    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    pos.needsUpdate = true
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      {/* Solid vertex-coloured terrain */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0.05} />
      </mesh>

      {/* Wireframe overlay — the "scanning grid" look */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#22c55e"
          wireframe
          transparent
          opacity={0.11}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}

// ─── Animated water pool ─────────────────────────────────────────────────────

function WaterPool() {
  const matRef = useRef()
  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.38 + Math.sin(clock.getElapsedTime() * 1.8) * 0.1
  })

  return (
    <mesh position={[-0.75, -2.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1.55, 48]} />
      <meshStandardMaterial
        ref={matRef}
        color="#3b82f6"
        transparent
        opacity={0.42}
        roughness={0.05}
        metalness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ─── Neon-emerald field border ────────────────────────────────────────────────

function FieldBorder() {
  const tubeGeo = useMemo(() => {
    // Irregular perimeter (48 control points) at world Y = 0.4 to hover above terrain edges
    const raw = [
      [-5.00, 0.4, -5.00], [-4.55, 0.4, -5.18], [-3.90, 0.4, -5.02],
      [-3.20, 0.4, -5.22], [-2.40, 0.4, -5.05], [-1.60, 0.4, -5.20],
      [-0.70, 0.4, -5.00], [ 0.15, 0.4, -5.15], [ 1.00, 0.4, -5.02],
      [ 1.90, 0.4, -5.18], [ 2.70, 0.4, -5.00], [ 3.50, 0.4, -5.15],
      [ 4.30, 0.4, -5.02], [ 5.00, 0.4, -5.08],
      [ 5.18, 0.4, -4.30], [ 5.02, 0.4, -3.55], [ 5.20, 0.4, -2.75],
      [ 5.05, 0.4, -1.90], [ 5.18, 0.4, -1.00], [ 5.02, 0.4, -0.15],
      [ 5.15, 0.4,  0.70], [ 5.00, 0.4,  1.55], [ 5.18, 0.4,  2.35],
      [ 5.02, 0.4,  3.15], [ 5.15, 0.4,  4.00], [ 5.00, 0.4,  5.00],
      [ 4.25, 0.4,  5.15], [ 3.50, 0.4,  5.02], [ 2.65, 0.4,  5.18],
      [ 1.80, 0.4,  5.02], [ 0.95, 0.4,  5.15], [ 0.05, 0.4,  5.00],
      [-0.85, 0.4,  5.18], [-1.70, 0.4,  5.02], [-2.55, 0.4,  5.15],
      [-3.40, 0.4,  5.00], [-4.20, 0.4,  5.18], [-5.00, 0.4,  5.00],
      [-5.18, 0.4,  4.25], [-5.02, 0.4,  3.40], [-5.18, 0.4,  2.55],
      [-5.02, 0.4,  1.65], [-5.15, 0.4,  0.80], [-5.00, 0.4, -0.10],
      [-5.18, 0.4, -1.00], [-5.02, 0.4, -1.85], [-5.18, 0.4, -2.70],
      [-5.00, 0.4, -3.55], [-5.15, 0.4, -4.35],
    ]
    const pts = raw.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const curve = new THREE.CatmullRomCurve3(pts, /* closed */ true, 'catmullrom', 0.3)
    return new THREE.TubeGeometry(curve, 200, 0.045, 6, true)
  }, [])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial
        color="#10b981"
        emissive="#10b981"
        emissiveIntensity={2.2}
        roughness={0.1}
        metalness={0.5}
      />
    </mesh>
  )
}

// ─── 3-D Pin with drei Html label ────────────────────────────────────────────

function Pin({ position, label, sublabel, color, point, onPinClick }) {
  return (
    <group position={position}>
      {/* Stem */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.06, 0.9, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.14, 14, 14]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={1.2}
          roughness={0.1} metalness={0.3}
        />
      </mesh>

      {/* Html label — rendered as a DOM element floating over the canvas */}
      <Html position={[0.3, 1.15, 0]} distanceFactor={10} occlude={false}>
        <div
          onClick={() => onPinClick?.(point)}
          style={{
            cursor:          'pointer',
            background:      'rgba(10,14,23,0.93)',
            border:          `1px solid ${color}`,
            borderRadius:    8,
            padding:         '4px 10px',
            whiteSpace:      'nowrap',
            boxShadow:       `0 0 16px ${color}55, 0 2px 10px rgba(0,0,0,0.65)`,
            userSelect:      'none',
            pointerEvents:   'auto',
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

// ─── Scene ───────────────────────────────────────────────────────────────────

const BASIN_POINT = {
  id: 1, lat: '40.1105', lng: '-88.2401', severity: 'high', elevation: 218,
  zone: 'A', time: '10:15 AM', status: 'Pending',
  summary: 'Active pooling at basin centre. Pre-V6 corn — growing point still underground. Standing water detected >72 hrs. Monitor for anaerobic conditions.',
}

const RIDGE_POINT = {
  id: 6, lat: '40.1130', lng: '-88.2370', severity: 'low', elevation: 222,
  zone: 'C', time: '11:15 AM', status: 'Pending',
  summary: 'Healthy baseline on elevated ridge. Water drained within 6 hrs of event. No stand loss expected. Good comparison reference for APH.',
}

function Scene({ onPinClick }) {
  return (
    <>
      <color attach="background" args={['#070d18']} />
      <fog attach="fog" args={['#070d18', 22, 42]} />

      {/* ── Lighting ─────────────────────────────────────────────────── */}
      <ambientLight intensity={0.55} color="#1a3050" />
      <directionalLight
        position={[8, 14, 6]} intensity={3.2} color="#8bb8d8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={30} shadow-camera-near={0.5}
        shadow-camera-left={-8} shadow-camera-right={8}
        shadow-camera-top={8}  shadow-camera-bottom={-8}
      />
      <directionalLight position={[-5, 6, -8]} intensity={0.9} color="#0d3a5f" />

      {/* Point lights for glow effects */}
      <pointLight position={[-0.75, -0.4, 0]} intensity={4}   color="#3b82f6" distance={5}  decay={2} />
      <pointLight position={[0, 1.5, 0]}       intensity={1.2} color="#10b981" distance={14} decay={1.5} />

      {/* ── Geometry ─────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <Terrain />
        <WaterPool />
        <FieldBorder />

        <Pin
          position={[-0.75, -2.15, 0.6]}
          label="218m — Severe Pooling"
          sublabel="Standing water · Zone A"
          color="#3b82f6"
          point={BASIN_POINT}
          onPinClick={onPinClick}
        />
        <Pin
          position={[4.2, 2.1, 0.5]}
          label="222m — Dry Runoff"
          sublabel="Elevated ridge · Zone C"
          color="#22c55e"
          point={RIDGE_POINT}
          onPinClick={onPinClick}
        />
      </Suspense>

      {/* ── Camera controls ───────────────────────────────────────────── */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={28}
        autoRotate
        autoRotateSpeed={0.28}
        target={[0, 0, 0]}
      />
    </>
  )
}

// ─── Exported component ───────────────────────────────────────────────────────

export default function Field3D({ onPinClick }) {
  return (
    <div className="relative w-full h-full" style={{ background: '#070d18' }}>

      <Canvas
        shadows
        camera={{ position: [10, 10, 10], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene onPinClick={onPinClick} />
      </Canvas>

      {/* ── Monospace telemetry HUD ─────────────────────────────────────── */}
      <div
        className="absolute top-3 left-3 pointer-events-none z-10 rounded-lg px-3 py-2"
        style={{
          background:     'rgba(0,0,0,0.76)',
          border:         '1px solid rgba(16,185,129,0.35)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <p style={{ fontFamily: 'monospace', fontSize: 9, lineHeight: 1.75, color: '#4ade80', margin: 0 }}>
          LAT: 40.1105 | LNG: -88.2401<br />
          TERRAIN_MESH: ACTIVE<br />
          CONFIDENCE: 92%
        </p>
      </div>
    </div>
  )
}
