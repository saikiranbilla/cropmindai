// Dynamically resolve the API host so the phone on the same WiFi network
// hits the laptop's IP (e.g. 192.168.x.x:8000) instead of localhost.
const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * POST /api/assessments
 * @param {FormData} formData  — multipart payload with photo + metadata fields
 * @returns {{ assessment_id: string, photo_url: string|null, message: string }}
 */
export function submitAssessment(formData) {
  return request('/api/assessments', { method: 'POST', body: formData })
}

/**
 * GET /api/assessments/{id}/status
 * @returns {{ assessment_id: string, status: string }}
 */
export function pollAssessmentStatus(id) {
  return request(`/api/assessments/${id}/status`)
}

/**
 * GET /api/assessments/{id}
 * @returns {object} Full assessment row from Supabase
 */
export function getAssessment(id) {
  return request(`/api/assessments/${id}`)
}
