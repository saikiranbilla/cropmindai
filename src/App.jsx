import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AssessmentProvider, useAssessment } from './context/AssessmentContext'
import BottomNav from './components/BottomNav'
import SplashScreen from './components/SplashScreen'
import Map3D from './components/Map3D'
import ScoutPage from './pages/ScoutPage'
import AgentsPage from './pages/AgentsPage'
import ReportPage from './pages/ReportPage'

// ─── Debug pill (dev only) ────────────────────────────────────────────────────

function DebugPill() {
  const { status, assessmentId, assessmentData } = useAssessment()
  if (import.meta.env.PROD) return null
  return (
    <div className="fixed top-0 right-0 m-2 z-50 bg-black/80 text-xs text-green-400 p-2 rounded pointer-events-none flex flex-col gap-1">
      <div>Status: {status}</div>
      <div>ID: {assessmentId ? assessmentId.slice(0, 8) + '…' : 'none'}</div>
      <div>Confidence: {assessmentData?.synthesis?.overall_confidence ?? '—'}</div>
    </div>
  )
}

// ─── Persistent Map3D layer ───────────────────────────────────────────────────
// Lives OUTSIDE <Routes> so Three.js never unmounts on navigation.
// Toggled with display:none / display:block — saves the ~300ms reinit cost
// and avoids GPU memory churn on every visit to /map.

function PersistentMap() {
  const location = useLocation()
  const { appData, scenario } = useAssessment()
  const isMapRoute = location.pathname === '/map'

  const activePoints =
    appData?.spatial?.data?.enrichedPoints ??
    scenario.scoutingPoints

  return (
    <div
      style={{
        display: isMapRoute ? 'block' : 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: '5rem',   // above bottom nav (pb-20 = 5rem)
        zIndex: 10,
      }}
    >
      <Map3D scoutingPoints={activePoints} viewMode="damage" />
    </div>
  )
}

// ─── Routes with page-enter animation ────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <main key={location.pathname} className="page-enter flex flex-col flex-1 pb-20">
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/scout" replace />} />
        <Route path="/scout" element={<ScoutPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/map" element={<div />} />  {/* Map is rendered by PersistentMap */}
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </main>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const handleSplashComplete = useCallback(() => setSplashDone(true), [])

  return (
    <AssessmentProvider>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <BrowserRouter>
        <div
          className="flex flex-col min-h-screen relative overflow-x-hidden bg-zinc-950 text-zinc-400"
        >
          <DebugPill />
          <PersistentMap />
          <AnimatedRoutes />
          <BottomNav />
        </div>
      </BrowserRouter>
    </AssessmentProvider>
  )
}
