import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DemoProvider } from './context/DemoContext'
import BottomNav from './components/BottomNav'
import ScoutPage from './pages/ScoutPage'
import AgentsPage from './pages/AgentsPage'
import MapPage from './pages/MapPage'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <DemoProvider>
    <BrowserRouter>
      <div
        className="flex flex-col min-h-screen"
        style={{ background: '#0a0e17', color: '#e2e8f0' }}
      >
        <main className="flex flex-col flex-1 pb-20">
          <Routes>
            <Route path="/" element={<Navigate to="/scout" replace />} />
            <Route path="/scout" element={<ScoutPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
    </DemoProvider>
  )
}
