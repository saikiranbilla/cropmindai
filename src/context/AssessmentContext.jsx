import { createContext, useContext, useState, useEffect } from 'react'
import { submitAssessment, pollAssessmentStatus, getAssessment } from '../api/client'

const AssessmentContext = createContext(null)

// ─── Static fallback scouting points (shown before any assessment runs) ────────
const FALLBACK_POINTS = [
  { id: 1, lat: 40.1105, lng: -88.2401, severity: 'high',     zone: 'A', damageType: 'Flood Inundation' },
  { id: 2, lat: 40.1112, lng: -88.2395, severity: 'moderate', zone: 'A', damageType: 'Waterlogging'     },
  { id: 3, lat: 40.1098, lng: -88.2410, severity: 'low',      zone: 'B', damageType: 'Wind Lodging'     },
]

// ─── Shape adapter ────────────────────────────────────────────────────────────
// Maps the flat Supabase assessment row to the nested shape existing components
// expect (MapPage, InsuranceReport, ClaimReport).
function adaptBackendRow(row) {
  return {
    synthesis: {
      executive_summary:  row.executive_summary  ?? '',
      conflict_flags:     row.conflict_flags      ?? [],
      overall_confidence: row.confidence          ?? 0,
      disclaimer: 'Pre-qualification assessment, does not replace licensed adjuster.',
      source: 'live',
    },
    spatial: {
      data: {
        enrichedPoints: row.photo_metadata?.scouting_points ?? [],
        zoneSummaries:  row.zone_summaries ?? '',
      },
    },
    insurance: {
      // insurance_matches is a JSONB object: { matched_sections, action_items, deadlines, ... }
      matched_sections:    row.insurance_matches?.matched_sections    ?? [],
      action_items:        row.insurance_matches?.action_items        ?? [],
      deadlines:           row.insurance_matches?.deadlines           ?? [],
      yield_loss_estimate: row.insurance_matches?.yield_loss_estimate ?? row.yield_loss_estimate ?? 'Pending',
      source:              row.insurance_matches?.source              ?? 'live',
    },
    flood_pathway: row.flood_pathway,
    satellite: row.satellite_data ?? null,
    _raw: row,
  }
}

const LS_KEY = 'cropmind_assessment_id'

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AssessmentProvider({ children }) {
  const [assessmentId,   setAssessmentId]   = useState(null)
  const [status,         setStatus]         = useState('idle')
  // 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  const [assessmentData, setAssessmentData] = useState(null)
  const [errorMessage,   setErrorMessage]   = useState(null)

  // ── Restore last session on mount ──────────────────────────────────────────
  // If the user refreshes mid-pipeline or after completion, pick up where we
  // left off instead of showing the idle/fallback state.
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (!stored) return

    pollAssessmentStatus(stored)
      .then(async (poll) => {
        setAssessmentId(stored)
        if (poll.status === 'completed') {
          const full = await getAssessment(stored)
          setAssessmentData(adaptBackendRow(full))
          setStatus('completed')
        } else if (poll.status === 'failed') {
          setStatus('failed')
        } else {
          // Still running — let the polling useEffect take over
          setStatus(poll.status)
        }
      })
      .catch((err) => {
        // Only remove the stored ID if the assessment definitively doesn't
        // exist (404). A network error or 5xx means the backend is temporarily
        // unavailable — keep the ID so the next page load can retry.
        if (err?.message?.startsWith('API 404')) {
          localStorage.removeItem(LS_KEY)
        }
        // else: silently ignore — backend may still be starting up
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── startAssessment ────────────────────────────────────────────────────────
  // Builds the multipart FormData, POSTs to backend, stores the returned ID.
  // Returns the assessment_id so callers can navigate immediately.
  async function startAssessment(photos = [], metadata = {}) {
    setStatus('pending')
    setAssessmentData(null)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('crop_type',          metadata.crop_type          ?? 'corn')
    formData.append('weather_event_date', metadata.weather_event_date ?? new Date().toISOString())
    formData.append('photo_metadata', JSON.stringify({
      scouting_points: metadata.scouting_points ?? [],
      county_fips:     metadata.county_fips     ?? '17019',
    }))
    if (photos.length > 0) {
      formData.append('photo', photos[0])
    }

    const result = await submitAssessment(formData)
    localStorage.setItem(LS_KEY, result.assessment_id)
    setAssessmentId(result.assessment_id)
    setStatus('processing')
    return result.assessment_id
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  // While the backend pipeline is running, poll /status every 2 seconds.
  // On completion, fetch the full row and adapt it for downstream components.
  useEffect(() => {
    if ((status !== 'processing' && status !== 'pending') || !assessmentId) return

    const interval = setInterval(async () => {
      try {
        const poll = await pollAssessmentStatus(assessmentId)

        if (poll.status === 'completed') {
          clearInterval(interval)
          const full = await getAssessment(assessmentId)
          setAssessmentData(adaptBackendRow(full))
          setStatus('completed')
        } else if (poll.status === 'failed') {
          clearInterval(interval)
          setStatus('failed')
          setErrorMessage(poll.pipeline_errors?.[0] ?? 'Pipeline failed — check server logs.')
        }
        // 'pending' / 'processing' → keep polling
      } catch (err) {
        console.error('Assessment polling error:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [status, assessmentId])

  // ── Backward-compat shims ──────────────────────────────────────────────────
  // Components that still read `appData`, `scenario`, and `demoMode` from the
  // old DemoContext continue to work without modification.
  const appData  = assessmentData                // null until completed
  const scenario = {
    scoutingPoints: assessmentData?._raw?.photo_metadata?.scouting_points ?? FALLBACK_POINTS,
    agentOutputs:   { vision: '', environmental: '', spatial: '', insurance: '', synthesis: '' },
    weatherEvent:   {
      type:       assessmentData?._raw?.crop_type ? 'Severe Convective Storm' : '',
      dateOfLoss: assessmentData?._raw?.weather_event_date ?? '',
    },
  }

  return (
    <AssessmentContext.Provider value={{
      // New API
      assessmentId,
      status,
      assessmentData,
      errorMessage,
      startAssessment,
      // Backward-compat (DemoContext interface)
      demoMode: false,
      appData,
      scenario,
      updateAssessmentData: setAssessmentData,
    }}>
      {children}
    </AssessmentContext.Provider>
  )
}

export function useAssessment() {
  const ctx = useContext(AssessmentContext)
  if (!ctx) throw new Error('useAssessment must be used inside <AssessmentProvider>')
  return ctx
}

// Backward-compat alias so existing components don't need import changes
export const useDemo = useAssessment
