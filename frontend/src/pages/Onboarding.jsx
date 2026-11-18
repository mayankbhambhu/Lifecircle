import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Building2, Check, HeartHandshake, Hospital, Lock, LocateFixed, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Logo from '../components/Logo.jsx'
import { useToast } from '../components/ui.jsx'

const ROLES = [
  { id: 'patient', title: 'I need blood', sub: 'Patient or family member managing regular transfusions', icon: UserRound, color: '#e11d48' },
  { id: 'donor', title: 'I want to donate', sub: 'Join a patient\'s circle and get urgent alerts nearby', icon: HeartHandshake, color: '#7c3aed' },
  { id: 'blood_bank', title: 'Blood bank staff', sub: 'Invite only – ask your administrator', icon: Building2, color: '#2563eb', locked: true },
  { id: 'hospital', title: 'Hospital staff', sub: 'Invite only – ask your administrator', icon: Hospital, color: '#059669', locked: true },
]

function readOnboarding() {
  try { return JSON.parse(sessionStorage.getItem('lc_onboarding') || 'null') } catch { return null }
}

export default function Onboarding() {
  const [ob] = useState(readOnboarding)
  const [role, setRole] = useState(null)
  const [meta, setMeta] = useState(null)
  const [f, setF] = useState({ cycle_days: 21, sex: 'M' })
  const [busy, setBusy] = useState(false)
  const { signIn } = useAuth()
  const toast = useToast()

  useEffect(() => { api('/api/meta').then(setMeta).catch(() => {}) }, [])
  useEffect(() => { if (ob?.identity?.name) setF(x => ({ ...x, name: ob.identity.name })) }, [ob])
  if (!ob) return <Navigate to="/login" replace />

  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const locate = () => navigator.geolocation?.getCurrentPosition(
    p => { setF(x => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude })); toast('Location added', { body: 'Used only to rank you for nearby urgent requests.' }) },
    () => toast('Location unavailable', { tone: 'warning', body: 'You can add it later.' }))

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { onboarding_token: ob.onboarding_token, role, ...f, cycle_days: Number(f.cycle_days), hospital_id: f.hospital_id ? Number(f.hospital_id) : undefined, weight_kg: f.weight_kg ? Number(f.weight_kg) : undefined }
      Object.keys(body).forEach(k => (body[k] === '' || body[k] === undefined) && delete body[k])
      const res = await api('/api/auth/onboard', { method: 'POST', body })
      sessionStorage.removeItem('lc_onboarding')
      toast('Welcome to LifeCircle', { body: role === 'patient' ? 'Your first cycle is planned – invite your circle next.' : 'A blood bank will verify your profile.' })
      signIn(res)
    } catch (err) { toast(err.message, { tone: 'error' }) } finally { setBusy(false) }
  }

  const groups = meta?.blood_groups || ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
  const verifiedVia = ob.identity?.phone || ob.identity?.email

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px', display: 'grid', placeItems: 'start center' }}>
      <div style={{ width: 'min(720px, 100%)' }}>
        <div className="row" style={{ marginBottom: 24 }}><Logo size={32} animated /><b style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>LifeCircle</b></div>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {[0, 1].map(i => <motion.div key={i} style={{ height: 5, borderRadius: 4, flex: 1, background: (role ? 1 : 0) >= i ? 'var(--primary)' : 'var(--border)' }} layout />)}
        </div>
        <AnimatePresence mode="wait">
          {!role ? (
            <motion.div key="pick" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 style={{ fontSize: 30, marginTop: 14 }}>How will you use LifeCircle?</h2>
              <p className="muted" style={{ margin: '6px 0 22px' }}>Verified as <b>{verifiedVia}</b>. You'll land on the dashboard for your role every time you sign in.</p>
              <div className="grid g2">
                {ROLES.map((r, i) => (
                  <motion.button key={r.id} className="card" disabled={r.locked} onClick={() => setRole(r.id)}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    whileHover={r.locked ? {} : { y: -4, boxShadow: 'var(--shadow-lg)' }}
                    style={{ textAlign: 'left', cursor: r.locked ? 'not-allowed' : 'pointer', opacity: r.locked ? 0.6 : 1 }}>
                    <div className="row between">
                      <div className="avatar" style={{ background: r.color }}><r.icon size={19} /></div>
                      {r.locked && <span className="badge"><Lock size={12} /> Invite only</span>}
                    </div>
                    <h3 style={{ marginTop: 14, fontSize: 18 }}>{r.title}</h3>
                    <p className="faint" style={{ marginTop: 4 }}>{r.sub}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} className="card col" style={{ gap: 16, marginTop: 14 }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRole(null)}><ArrowLeft size={14} /> Change role</button>
              <h2 style={{ fontSize: 24 }}>{role === 'patient' ? 'Set up your patient\'s plan' : 'Your donor profile'}</h2>
              <div className="grid g2">
                <div className="field"><label>Your name</label><input className="input" required value={f.name || ''} onChange={set('name')} /></div>
                {!ob.identity?.phone && <div className="field"><label>Mobile number {role === 'donor' ? '' : '(optional)'}</label><input className="input" required={role === 'donor'} inputMode="tel" value={f.phone || ''} onChange={set('phone')} placeholder="98xxxxxxxx" /></div>}
              </div>
              {role === 'patient' ? (
                <>
                  <div className="grid g2">
                    <div className="field"><label>Patient's name</label><input className="input" required value={f.patient_name || ''} onChange={set('patient_name')} /></div>
                    <div className="field"><label>Patient's blood group</label>
                      <select className="input" required value={f.patient_blood_group || ''} onChange={set('patient_blood_group')}><option value="">Select</option>{groups.map(g => <option key={g}>{g}</option>)}</select></div>
                    <div className="field"><label>Transfusion every (days)</label><input className="input" type="number" min={7} max={90} required value={f.cycle_days} onChange={set('cycle_days')} /></div>
                    <div className="field"><label>Last transfusion date</label><input className="input" type="date" value={f.last_transfusion_date || ''} onChange={set('last_transfusion_date')} /></div>
                  </div>
                  <div className="field"><label>Hospital / day-care centre</label>
                    <select className="input" required value={f.hospital_id || ''} onChange={set('hospital_id')}><option value="">Select</option>{meta?.hospitals.map(h => <option key={h.id} value={h.id}>{h.name} · {h.city}</option>)}</select></div>
                </>
              ) : (
                <>
                  <div className="grid g3">
                    <div className="field"><label>Blood group</label><select className="input" required value={f.blood_group || ''} onChange={set('blood_group')}><option value="">Select</option>{groups.map(g => <option key={g}>{g}</option>)}</select></div>
                    <div className="field"><label>Sex</label><select className="input" value={f.sex} onChange={set('sex')}><option value="M">Male</option><option value="F">Female</option></select></div>
                    <div className="field"><label>Weight (kg)</label><input className="input" type="number" min={30} max={250} required value={f.weight_kg || ''} onChange={set('weight_kg')} /></div>
                    <div className="field"><label>Date of birth</label><input className="input" type="date" required value={f.date_of_birth || ''} onChange={set('date_of_birth')} /></div>
                    <div className="field"><label>Area</label><input className="input" placeholder="e.g. Malviya Nagar" value={f.area || ''} onChange={set('area')} /></div>
                    <div className="field"><label>Location</label><button type="button" className="btn" onClick={locate}>{f.lat ? <><Check size={14} /> Added</> : <><LocateFixed size={14} /> Use my location</>}</button></div>
                  </div>
                  <div className="grid g2">
                    <div className="field"><label>Circle invite code (optional)</label><input className="input" placeholder="AARAV-7Q2K" value={f.invite_code || ''} onChange={set('invite_code')} /></div>
                    <div className="field"><label>Relation to patient</label><input className="input" placeholder="Cousin, friend…" value={f.relation || ''} onChange={set('relation')} /></div>
                  </div>
                  <div className="banner info small"><Lock size={16} color="var(--info)" /><div>Your phone number is visible <b>only to blood bank staff</b>. Families see your first name and status – never your number.</div></div>
                </>
              )}
              <button className="btn primary lg" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
