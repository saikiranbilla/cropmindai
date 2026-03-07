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
import { useDemo } from '../context/DemoContext'

/* ───────── agent definitions ───────── */
const AGENTS = [
  {
    id: 'vision',
    name: 'Vision Agent',
    icon: Eye,
    color: '#f97316',      // orange-500
    glowColor: 'rgba(249,115,22,0.35)',
    phase: 1,
  },
  {
    id: 'environmental',
    name: 'Environmental Agent',
    icon: CloudRain,
    color: '#3b82f6',      // blue-500
    glowColor: 'rgba(59,130,246,0.35)',
    phase: 1,
  },
  {
    id: 'spatial',
    name: 'Spatial Agent',
    icon: Grid3X3,
    color: '#22c55e',      // green-500
    glowColor: 'rgba(34,197,94,0.35)',
    phase: 2,
  },
  {
    id: 'insurance',
    name: 'Insurance RAG',
    icon: ShieldCheck,
    color: '#a855f7',      // purple-500
    glowColor: 'rgba(168,85,247,0.35)',
    phase: 2,
  },
  {
    id: 'synthesis',
    name: 'Synthesis Agent',
    icon: Sparkles,
    color: '#e2e8f0',      // slate-200
    glowColor: 'rgba(226,232,240,0.25)',
    phase: 3,
  },
]

const CHAR_SPEED = 18 // ms per character

/* ═══════════════════════════════════════
   AgentCouncil – main export
   ═══════════════════════════════════════ */
export default function AgentCouncil() {
  const navigate = useNavigate()
  const { demoMode, scenario } = useDemo()

  const agentTextRef = useRef(
    demoMode ? scenario.agentOutputs : { vision: '', environmental: '', spatial: '', insurance: '', synthesis: '' }
  )

  // per-agent streaming state
  const [streams, setStreams] = useState(() =>
    Object.fromEntries(
      AGENTS.map((a) => [a.id, { text: '', done: false, started: false }])
    )
  )
  const [allDone, setAllDone] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const timerRefs = useRef({})

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
    // All done
    const every = AGENTS.every((a) => streams[a.id].done)
    if (every && !allDone) {
      setAllDone(true)
      setTimeout(() => setShowButton(true), 400)
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
    <div className="flex flex-col gap-5 px-4 py-6 max-w-2xl mx-auto w-full">
      {/* ───── header ───── */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Agent Council
        </h2>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: progress === 100 ? '#22c55e' : '#94a3b8' }}
        >
          {progress}%
        </span>
      </div>

      {/* ───── global progress bar ───── */}
      <div
        className="relative w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: '#1e293b' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${progress}%`,
            background:
              progress === 100
                ? '#22c55e'
                : 'linear-gradient(90deg, #3b82f6, #a855f7)',
            transition: 'width 0.3s ease',
            boxShadow:
              progress < 100
                ? '0 0 12px rgba(99,102,241,0.6)'
                : '0 0 12px rgba(34,197,94,0.6)',
          }}
        />
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
              className="relative rounded-xl p-4 transition-all duration-500"
              style={{
                background: '#0f172a',
                border: `1px solid ${
                  isActive
                    ? agent.color
                    : isComplete
                    ? agent.color + '66'
                    : '#1e293b'
                }`,
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
                  className="text-sm font-semibold tracking-wide"
                  style={{ color: agent.color }}
                >
                  {agent.name}
                </span>

                {/* status dot */}
                <span className="ml-auto flex items-center gap-2">
                  {isComplete && (
                    <span
                      className="text-[10px] font-medium uppercase tracking-widest"
                      style={{ color: agent.color + 'cc' }}
                    >
                      Complete
                    </span>
                  )}
                  <span
                    className="relative inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background: isActive
                        ? agent.color
                        : isComplete
                        ? agent.color
                        : '#334155',
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{
                          background: agent.color,
                          opacity: 0.6,
                        }}
                      />
                    )}
                  </span>
                </span>
              </div>

              {/* streaming text area */}
              <div
                className="relative rounded-lg px-3 py-2.5 min-h-[56px] font-mono text-xs leading-relaxed overflow-hidden"
                style={{
                  background: '#0a0e17',
                  color: '#cbd5e1',
                  border: '1px solid #1e293b',
                }}
              >
                {isWaiting ? (
                  <span className="text-slate-600 italic">
                    Awaiting upstream agents…
                  </span>
                ) : (
                  <>
                    {s.text}
                    {isActive && (
                      <span
                        className="inline-block w-[2px] h-3.5 ml-0.5 align-text-bottom rounded-sm"
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
          className="group flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              '0 0 32px rgba(99,102,241,0.65)'
            e.currentTarget.style.transform = 'scale(1.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              '0 0 24px rgba(99,102,241,0.4)'
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
      `}</style>
    </div>
  )
}
