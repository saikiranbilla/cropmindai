import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'

export default function SplashScreen({ onComplete }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1400)
    const doneTimer = setTimeout(() => onComplete(), 1800)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: '#0a0e17',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Icon mark */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Pulse ring */}
        <div
          className="absolute w-20 h-20 rounded-2xl splash-ring"
          style={{ background: 'rgba(59,130,246,0.25)' }}
        />
        {/* Icon card */}
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            boxShadow: '0 0 40px rgba(59,130,246,0.5)',
          }}
        >
          <Leaf size={30} className="text-white" strokeWidth={1.8} />
        </div>
      </div>

      {/* App name */}
      <h1 className="text-2xl font-bold tracking-tight text-slate-100 mb-1">
        CropClaim AI
      </h1>
      <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em]">
        Field Intelligence System
      </p>

      {/* Loading dots */}
      <div className="flex gap-1.5 mt-8">
        {[0, 150, 300].map(delay => (
          <div
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-blue-500"
            style={{ animation: `bounce 1s ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.5; }
          50%       { transform: translateY(-6px); opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
