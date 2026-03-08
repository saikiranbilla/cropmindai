import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  CloudRain,
  Grid3X3,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAssessment } from '../context/AssessmentContext'

/* ───────── agent definitions ───────── */
const AGENTS = [
  {
    id: 'vision',
    name: 'Vision Agent',
    icon: Eye,
    color: 'var(--accent-amber)',
    glowColor: 'rgba(245,166,35,0.35)',
    phase: 1,
  },
  {
    id: 'environmental',
    name: 'Environmental Agent',
    icon: CloudRain,
    color: 'var(--accent-blue)',
    glowColor: 'rgba(59,158,255,0.35)',
    phase: 1,
  },
  {
    id: 'spatial',
    name: 'Spatial Agent',
    icon: Grid3X3,
    color: 'var(--accent-primary)',
    glowColor: 'rgba(0,229,160,0.35)',
    phase: 2,
  },
  {
    id: 'insurance',
    name: 'Insurance RAG',
    icon: ShieldCheck,
    color: 'var(--accent-purple)',
    glowColor: 'rgba(167,139,250,0.35)',
    phase: 2,
  },
  {
    id: 'synthesis',
    name: 'Synthesis Agent',
    icon: Sparkles,
    color: 'var(--text-muted)',
    glowColor: 'rgba(74,96,112,0.25)',
    phase: 3,
  },
]

const CHAR_SPEED = 18 // ms per character

// Descriptions of what the backend agents are doing — drives the typewriter
const AGENT_TEXT = {
  vision: 'Analyzing field imagery using FCIC LASH protocols. Evaluating corn growth stage via horizontal leaf method. Detecting stand loss and defoliation percentage from scouting data.',
  environmental: 'Querying Open-Meteo archive for 7-day precipitation totals. Fetching field elevation from Open-Elevation API. Computing flood risk score and soil saturation classification.',
  spatial: 'Clustering scouting points into flood zones. Applying ponding contour thresholds to classify submerged, waterlogged, and dry areas. Estimating contiguous flooded acreage.',
  insurance: 'Cross-referencing FCIC policy sections against crop type and growth stage. Applying defoliation yield-loss tables from FCIC-25080 Exhibit 15. Identifying filing deadlines.',
  synthesis: 'Synthesizing Vision, Environmental, Spatial, and Insurance outputs. Checking for cross-agent conflicts. Generating executive summary and confidence score for adjuster review.',
}

/* ═══════════════════════════════════════
   AgentCouncil – main export
   ═══════════════════════════════════════ */
export default function AgentCouncil() {
  const navigate = useNavigate()
  const { status } = useAssessment()

  const agentTextRef = useRef(AGENT_TEXT)

  // per-agent streaming state
  const [streams, setStreams] = useState(() =>
    Object.fromEntries(
      AGENTS.map((a) => [a.id, { text: '', done: false, started: false }])
    )
  )
  const [allDone, setAllDone] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const timerRefs = useRef({})
  const didReveal = useRef(false)

  // Reveal the button exactly once when BOTH the animation AND the backend are done
  const revealResults = useCallback(() => {
    if (didReveal.current) return
    didReveal.current = true
    setTimeout(() => setShowButton(true), 400)
  }, [])

  // Gate: backend polling lives in AssessmentContext — we just watch status here.
  // 'idle' fallback lets the screen work when navigated to directly without an assessment.
  useEffect(() => {
    if (allDone && ['completed', 'failed', 'idle'].includes(status)) {
      revealResults()
    }
  }, [allDone, status, revealResults])

  /* ── typewriter engine ── */
  const startStreaming = useCallback((agentId) => {
    const fullText = agentTextRef.current[agentId] ?? ''
    let idx = 0

    setStreams((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], started: true },
    }))

    const tick = () => {
      idx++
      setStreams((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          text: fullText.slice(0, idx),
          done: idx >= fullText.length,
        },
      }))
      if (idx < fullText.length) {
        timerRefs.current[agentId] = setTimeout(tick, CHAR_SPEED)
      }
    }
    timerRefs.current[agentId] = setTimeout(tick, CHAR_SPEED)
  }, [])

  /* ── orchestration phases ── */
  useEffect(() => {
    // Phase 1 – kick off immediately
    AGENTS.filter((a) => a.phase === 1).forEach((a) => startStreaming(a.id))
    return () =>
      Object.values(timerRefs.current).forEach((t) => clearTimeout(t))
  }, [startStreaming])

  // watch for phase transitions
  useEffect(() => {
    const phase1Agents = AGENTS.filter((a) => a.phase === 1)
    const phase2Agents = AGENTS.filter((a) => a.phase === 2)
    const phase3Agents = AGENTS.filter((a) => a.phase === 3)

    const phase1Done = phase1Agents.every((a) => streams[a.id].done)
    const phase2Done = phase2Agents.every((a) => streams[a.id].done)

    // Start phase 2
    if (phase1Done) {
      phase2Agents.forEach((a) => {
        if (!streams[a.id].started) startStreaming(a.id)
      })
    }
    // Start phase 3
    if (phase1Done && phase2Done) {
      phase3Agents.forEach((a) => {
        if (!streams[a.id].started) startStreaming(a.id)
      })
    }
    // All done — reveal is gated on pipelineDone via the separate effect above
    const every = AGENTS.every((a) => streams[a.id].done)
    if (every && !allDone) {
      setAllDone(true)
    }
  }, [streams, startStreaming, allDone])

  /* ── progress calc ── */
  const totalChars = AGENTS.reduce(
    (s, a) => s + (agentTextRef.current[a.id]?.length ?? 0),
    0
  )
  const doneChars = AGENTS.reduce(
    (s, a) => s + streams[a.id].text.length,
    0
  )
  const progress = Math.round((doneChars / totalChars) * 100)

  /* ── render ── */
  return (
    <div className="flex flex-col gap-5 px-4 py-6 pb-28 max-w-2xl mx-auto w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* ───── pipeline status banner ───── */}
      {status === 'completed' && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-emerald-300">Pipeline complete — results ready</p>
          <button
            onClick={() => navigate('/report')}
            className="ml-auto text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            View Report →
          </button>
        </div>
      )}
      {status === 'failed' && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-red-500/10 border border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs font-semibold text-red-300">Pipeline failed — check server logs</p>
        </div>
      )}

      {/* ───── header ───── */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-sans)' }}>
          Agent Council
        </h2>
        <span
          className="text-xs tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: progress === 100 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
        >
          {progress}%
        </span>
      </div>

      {/* ───── global progress bar ───── */}
      <div className="flex gap-1 w-full h-2">
        {AGENTS.map((a, idx) => {
          const l = agentTextRef.current[a.id]?.length || 1;
          const p = streams[a.id].done ? 100 : (streams[a.id].started ? (streams[a.id].text.length / l) * 100 : 0);
          return (
            <div key={idx} className="flex-1 h-full rounded-[3px] bg-[var(--bg-elevated)] overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{
                  width: `${p}%`,
                  background: a.color,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* ───── agent cards ───── */}
      <div className="flex flex-col gap-4 mt-2">
        {AGENTS.map((agent) => {
          const s = streams[agent.id]
          const Icon = agent.icon
          const isActive = s.started && !s.done
          const isComplete = s.done
          const isWaiting = !s.started

          return (
            <div
              key={agent.id}
              className="relative p-4 transition-all duration-500 bg-[var(--bg-card)]"
              style={{
                borderRadius: '10px',
                borderLeft: `4px solid ${isActive || isComplete ? agent.color : 'var(--bg-elevated)'}`,
                borderTop: '1px solid var(--border-subtle)',
                borderRight: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                boxShadow: isActive
                  ? `0 0 20px ${agent.glowColor}, inset 0 0 20px ${agent.glowColor.replace(
                    /[\d.]+\)$/,
                    '0.08)'
                  )}`
                  : 'none',
                opacity: isWaiting ? 0.45 : 1,
              }}
            >
              {/* card header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{
                    background: agent.color + '18',
                  }}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    style={{ color: agent.color }}
                  />
                </div>

                <span
                  className="text-[14px] font-semibold tracking-wide"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
                >
                  {agent.name}
                </span>

                {/* status dot & badge */}
                <span className="ml-auto flex items-center gap-2">
                  {isComplete && (
                    <span
                      className="px-2 py-0.5 rounded-full uppercase"
                      style={{
                        color: agent.color,
                        background: agent.glowColor.replace(/[\d.]+\)$/, '0.12)'),
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px'
                      }}
                    >
                      Complete
                    </span>
                  )}
                  <span
                    className="relative inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background: isActive ? agent.color : (isComplete ? agent.color : 'var(--text-muted)'),
                      animation: isActive ? 'customPulse 1.5s ease-in-out infinite' : 'none',
                    }}
                  >
                  </span>
                </span>
              </div>

              {/* streaming text area */}
              <div
                className="relative rounded-lg px-3 py-2.5 min-h-[56px] leading-[1.8]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {isWaiting ? (
                  <span className="italic" style={{ color: 'var(--text-muted)' }}>
                    Awaiting upstream agents...
                  </span>
                ) : (
                  <>
                    {s.text}
                    {isActive && (
                      <span
                        className="inline-block w-[2px] h-3 ml-0.5 align-text-bottom rounded-sm"
                        style={{
                          background: agent.color,
                          animation: 'cursorBlink 0.8s steps(2) infinite',
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ───── View Results button ───── */}
      <div
        className="flex justify-center mt-4 transition-all duration-700"
        style={{
          opacity: showButton ? 1 : 0,
          transform: showButton ? 'translateY(0)' : 'translateY(16px)',
          pointerEvents: showButton ? 'auto' : 'none',
        }}
      >
        <button
          onClick={() => navigate('/map')}
          className="group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--bg-base)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.02em',
            boxShadow: '0 0 24px rgba(0,229,160,0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 32px rgba(0,229,160,0.45)'
            e.currentTarget.style.transform = 'scale(1.03)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 24px rgba(0,229,160,0.25)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          View Results
          <ArrowRight
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </button>
      </div>

      {/* keyframes for blinking cursor */}
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes customPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
