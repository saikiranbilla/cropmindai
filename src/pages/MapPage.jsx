import Map3D from '../components/Map3D'
import { useDemo } from '../context/DemoContext'

export default function MapPage() {
  const { demoMode, scenario, appData } = useDemo()

  // Prefer live spatial-enriched points; fall back to raw scenario points
  const activePoints = appData?.spatial?.data?.enrichedPoints ?? (demoMode ? scenario.scoutingPoints : undefined)

  function handlePinClick(point) {
    console.log('Pin clicked:', point)
  }

  return (
    <div style={{ height: 'calc(100dvh - 5rem)' }}>
      <Map3D
        scoutingPoints={activePoints}
        viewMode="damage"
        onPinClick={handlePinClick}
      />
    </div>
  )
}
