import Map3D from '../components/Map3D'
import { useDemo } from '../context/DemoContext'

export default function MapPage() {
  const { demoMode, scenario } = useDemo()

  function handlePinClick(point) {
    console.log('Pin clicked:', point)
  }

  return (
    <div style={{ height: 'calc(100dvh - 5rem)' }}>
      <Map3D
        scoutingPoints={demoMode ? scenario.scoutingPoints : undefined}
        viewMode="damage"
        onPinClick={handlePinClick}
      />
    </div>
  )
}
