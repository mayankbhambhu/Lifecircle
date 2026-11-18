const KEY = 'lc_session'

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}
export function saveSession(s) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* private mode */ }
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const t = token ?? loadSession()?.token
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    let msg = data?.detail
    if (Array.isArray(msg)) msg = msg.map(d => d.msg).join(', ')
    if (res.status === 401 && t) window.dispatchEvent(new Event('lc:unauthorized'))
    throw new ApiError(res.status, msg || `Request failed (${res.status})`)
  }
  return data
}

export const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', opts) : '—'

export const fmtLong = iso => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const ROLE_LABEL = { patient: 'Patient family', donor: 'Donor', blood_bank: 'Blood bank', hospital: 'Hospital' }
