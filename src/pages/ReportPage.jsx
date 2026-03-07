import { useState } from 'react'
import { FileText, ArrowLeft, ChevronRight } from 'lucide-react'
import InsuranceReport from '../components/InsuranceReport'
import ClaimReport from '../components/ClaimReport'

export default function ReportPage() {
  const [showClaim, setShowClaim] = useState(false)

  return (
    <div className="flex flex-col flex-1" style={{ background: '#0a0e17' }}>
      {showClaim ? (
        <>
          {/* Back bar — injected above ClaimReport's own sticky header */}
          <div
            className="flex items-center gap-2 px-4 py-2 print:hidden"
            style={{ background: '#0a0e17', borderBottom: '1px solid #1e2d4a' }}
          >
            <button
              onClick={() => setShowClaim(false)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Dashboard
            </button>
          </div>

          <ClaimReport />
        </>
      ) : (
        <>
          <InsuranceReport />

          {/* Floating Generate button — above bottom nav */}
          <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40 pointer-events-none">
            <button
              onClick={() => setShowClaim(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)',
                boxShadow: '0 0 28px rgba(59,130,246,0.45), 0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <FileText size={16} />
              Generate Official Claim Report
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
