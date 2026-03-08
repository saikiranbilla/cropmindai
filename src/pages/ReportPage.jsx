import { useState } from 'react'
import { FileText, ArrowLeft, ChevronRight } from 'lucide-react'
import InsuranceReport from '../components/InsuranceReport'
import ClaimReport from '../components/ClaimReport'

export default function ReportPage() {
  const [showClaim, setShowClaim] = useState(false)

  return (
    <div className="flex flex-col flex-1 bg-[var(--bg-base)]">
      {showClaim ? (
        <>
          {/* Back bar — injected above ClaimReport's own sticky header */}
          <div
            className="flex items-center gap-2 px-4 py-2 print:hidden bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]"
          >
            <button
              onClick={() => setShowClaim(false)}
              className="flex items-center gap-1.5 min-h-[44px] hover:text-[var(--text-primary)] transition-colors duration-150"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-muted)' }}
            >
              <ArrowLeft size={16} />
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
            <style>{`
              @keyframes pulseBorder {
                0% { box-shadow: 0 0 0 0 rgba(0,229,160,0.4); }
                70% { box-shadow: 0 0 0 10px rgba(0,229,160,0); }
                100% { box-shadow: 0 0 0 0 rgba(0,229,160,0); }
              }
            `}</style>
            <button
              onClick={() => setShowClaim(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-all duration-200 active:scale-95"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--bg-base)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                letterSpacing: '0.02em',
                animation: 'pulseBorder 2s infinite',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <FileText size={16} />
              Generate Official Claim Report
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
