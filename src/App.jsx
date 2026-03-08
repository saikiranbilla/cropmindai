import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DemoProvider, useDemo } from './context/DemoContext'
import BottomNav from './components/BottomNav'
import SplashScreen from './components/SplashScreen'
import ScoutPage from './pages/ScoutPage'
import AgentsPage from './pages/AgentsPage'
import MapPage from './pages/MapPage'
import ReportPage from './pages/ReportPage'
import ApiTestPage from './pages/ApiTestPage'

function DebugPill() {
  const { appData } = useDemo()
  return (
    <div className="fixed top-0 right-0 m-2 z-50 bg-black/80 text-xs text-green-400 p-2 rounded pointer-events-none flex flex-col gap-1">
      <div>Source: {appData?.synthesis?.source || 'mock'}</div>
      <div>Zones: {appData?.spatial?.data?.enrichedPoints?.length > 0 ? 'Enriched' : 'Static'}</div>
      <div>Conflicts: {appData?.synthesis?.conflict_flags?.length || 0}</div>
    </div>
  )
}

// Applies page-enter animation on every route change
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <main key={location.pathname} className="page-enter flex flex-col flex-1 pb-20">
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/scout" replace />} />
        <Route path="/scout" element={<ScoutPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/test-api" element={<ApiTestPage />} />
      </Routes>
    </main>
  )
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const handleSplashComplete = useCallback(() => setSplashDone(true), [])

  return (
    <DemoProvider>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <BrowserRouter>
        <div
          className="flex flex-col min-h-screen relative overflow-x-hidden"
          style={{ background: '#0a0e17', color: '#e2e8f0' }}
        >
          <DebugPill />
          <AnimatedRoutes />
          <BottomNav />
        </div>
      </BrowserRouter>
    </DemoProvider>
  )
}
