const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseDay(iso) {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const fmtDate = iso => { const d = parseDay(iso); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—' }
export const fmtLong = iso => { const d = parseDay(iso); return d ? `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—' }
export const monthShort = iso => { const d = parseDay(iso); return d ? MONTHS[d.getMonth()].toUpperCase() : '' }
export const dayNum = iso => parseDay(iso)?.getDate() ?? ''
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const ROLE_LABEL = { patient: 'Patient family', donor: 'Donor', blood_bank: 'Blood bank', hospital: 'Hospital' }
export const ROLE_HOME = { patient: '/patient', donor: '/donor', blood_bank: '/bank', hospital: '/hospital' }
export const firstName = n => (n || '').replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '').split(' ')[0]
