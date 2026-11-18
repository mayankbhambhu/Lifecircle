import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Building2, HeartHandshake, Hospital, Inbox, Lock, Mail, MessageSquareText, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Logo from '../components/Logo.jsx'
import { Modal, useToast } from '../components/ui.jsx'

const DEMO = [
  { role: 'patient', label: 'Patient family', who: 'Neha · Aarav\'s mother', icon: UserRound, color: '#e11d48' },
  { role: 'donor', label: 'Donor', who: 'Priya · backup + urgent alert', icon: HeartHandshake, color: '#7c3aed' },
  { role: 'blood_bank', label: 'Blood bank', who: 'Dr. Meera · City Blood Centre', icon: Building2, color: '#2563eb' },
  { role: 'hospital', label: 'Hospital', who: 'Ravi · Sunrise Children\'s', icon: Hospital, color: '#059669' },
]

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}

function OtpBoxes({ value, onChange, onDone }) {
  const refs = useRef([])
  const set = (i, ch) => {
    const v = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6)
    onChange(v)
    if (ch && i < 5) refs.current[i + 1]?.focus()
    if (v.replace(/\D/g, '').length === 6) onDone?.(v)
  }
  return (
    <div className="otp-boxes" onPaste={e => { const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (d) { e.preventDefault(); onChange(d); if (d.length === 6) onDone?.(d) } }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={el => (refs.current[i] = el)} className="input" inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`}
          value={value[i] || ''} autoFocus={i === 0}
          onChange={e => set(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={e => { if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus() }} />
      ))}
    </div>
  )
}

export default function Login() {
  const [method, setMethod] = useState('otp')
  const [cfg, setCfg] = useState(null)
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(null)
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [googleOpen, setGoogleOpen] = useState(false)
  const [gEmail, setGEmail] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const gBtn = useRef(null)

  useEffect(() => { api('/api/auth/config').then(setCfg).catch(() => {}) }, [])
  useEffect(() => { if (cooldown > 0) { const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t) } }, [cooldown])

  const finish = res => {
    if (res.status === 'signed_in') {
      toast(`Welcome back, ${res.user.name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '').split(' ')[0]}`, { body: `Signed in as ${res.user.role.replace('_', ' ')}` })
      signIn(res)
    } else {
      sessionStorage.setItem('lc_onboarding', JSON.stringify(res))
      navigate('/onboarding')
    }
  }
  const go = async fn => {
    setBusy(true)
    try { await fn() } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) }
  }

  const sendOtp = () => go(async () => {
    const r = await api('/api/auth/otp/request', { method: 'POST', body: { phone } })
    setOtpSent(r); setCode(''); setCooldown(r.resend_in)
  })
  const verifyOtp = c => go(async () => finish(await api('/api/auth/otp/verify', { method: 'POST', body: { phone: otpSent.phone, code: c || code } })))
  const sendLink = () => go(async () => setLinkSent(await api('/api/auth/magic/request', { method: 'POST', body: { email } })))
  const demo = role => go(async () => finish(await api('/api/auth/demo-login', { method: 'POST', body: { role } })))
  const googleDemo = () => go(async () => { setGoogleOpen(false); finish(await api('/api/auth/google/demo', { method: 'POST', body: { email: gEmail } })) })

  // Real Google Identity Services button when a client id is configured.
  useEffect(() => {
    if (!cfg?.google_client_id || method !== 'google') return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: cfg.google_client_id,
        callback: ({ credential }) => go(async () => finish(await api('/api/auth/google', { method: 'POST', body: { credential } }))),
      })
      if (gBtn.current) window.google?.accounts.id.renderButton(gBtn.current, { theme: 'outline', size: 'large', width: 380, shape: 'pill' })
    }
    document.head.appendChild(s)
    return () => s.remove()
  }, [cfg, method]) // eslint-disable-line react-hooks/exhaustive-deps

  const methods = [
    { id: 'otp', label: 'Phone OTP', icon: Smartphone },
    { id: 'magic', label: 'Email link', icon: Mail },
    { id: 'google', label: 'Google', icon: GoogleG },
  ]

  return (
    <motion.div className="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="auth-art">
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="orb" style={{ width: 80 + i * 40, height: 80 + i * 40, left: `${(i * 37) % 80}%`, top: `${(i * 23) % 80}%`, background: 'rgba(255,255,255,.07)' }}
            animate={{ y: [0, -20, 0], x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6 + i, ease: 'easeInOut' }} />
        ))}
        <Link to="/" className="row" style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, position: 'relative' }}>
          <Logo size={34} light animated /> LifeCircle
        </Link>
        <div style={{ position: 'relative' }}>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ fontSize: 44, letterSpacing: '-.04em' }}>
            One login.<br />Every role.<br />No missed transfusion.
          </motion.h1>
          <p style={{ marginTop: 18, opacity: 0.85, maxWidth: 420, fontSize: 16 }}>
            Families, donors, blood banks and hospitals sign in here. We recognise who you are and take you straight to your workspace.
          </p>
          <div className="col" style={{ marginTop: 28, gap: 10 }}>
            {[['Passwordless', 'OTP, magic link or Google – nothing to forget'], ['Private by design', 'Donor phone numbers are only ever visible to blood bank staff'], ['Role-aware', 'Patient · Donor · Blood bank · Hospital']].map(([t, d], i) => (
              <motion.div key={t} className="row" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
                <ShieldCheck size={18} /><div><b>{t}</b> <span style={{ opacity: 0.8 }}>· {d}</span></div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="small" style={{ opacity: 0.7, position: 'relative' }}>Built for thalassemia and other regular-transfusion patients.</div>
      </div>

      <div className="auth-form">
        <motion.div className="auth-box" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="row only-sm" style={{ marginBottom: 18 }}><Logo size={30} animated /><b style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>LifeCircle</b></div>
          <h2 style={{ fontSize: 30 }}>Sign in</h2>
          <p className="muted" style={{ marginTop: 6, marginBottom: 22 }}>New here? Sign in the same way – we'll set up your account next.</p>

          <div className="method-tabs" role="tablist">
            {methods.map(m => (
              <button key={m.id} className={`method ${method === m.id ? 'active' : ''}`} onClick={() => setMethod(m.id)} role="tab" aria-selected={method === m.id}>
                <m.icon size={18} />{m.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, minHeight: 190 }}>
            <AnimatePresence mode="wait">
              {method === 'otp' && (
                <motion.div key={otpSent ? 'otp2' : 'otp1'} className="col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {!otpSent ? (
                    <>
                      <div className="field">
                        <label htmlFor="phone">Mobile number</label>
                        <div className="row" style={{ gap: 8 }}>
                          <div className="input" style={{ width: 70, textAlign: 'center', background: 'var(--bg-2)' }}>+91</div>
                          <input id="phone" className="input" inputMode="tel" placeholder="98000 00001" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOtp()} />
                        </div>
                      </div>
                      <button className="btn primary lg block" disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={sendOtp}>
                        Send code <ArrowRight size={16} />
                      </button>
                      <div className="faint">6-digit code · valid 5 minutes · 5 attempts</div>
                    </>
                  ) : (
                    <>
                      <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOtpSent(null)}><ArrowLeft size={14} /> {otpSent.phone}</button>
                      <label className="small" style={{ fontWeight: 600 }}>Enter the code we sent</label>
                      <OtpBoxes value={code} onChange={setCode} onDone={verifyOtp} />
                      {otpSent.dev_code && (
                        <motion.div className="inbox row" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                          <MessageSquareText size={18} color="var(--primary)" />
                          <div className="grow small"><b>Demo SMS:</b> your code is <b className="mono" style={{ letterSpacing: 2 }}>{otpSent.dev_code}</b></div>
                          <button className="btn sm" onClick={() => { setCode(otpSent.dev_code); verifyOtp(otpSent.dev_code) }}>Use</button>
                        </motion.div>
                      )}
                      <div className="row between">
                        <button className="btn primary" disabled={busy || code.length < 6} onClick={() => verifyOtp()}>Verify & continue</button>
                        <button className="btn ghost sm" disabled={cooldown > 0 || busy} onClick={sendOtp}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {method === 'magic' && (
                <motion.div key="magic" className="col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="field">
                    <label htmlFor="email">Email address</label>
                    <input id="email" className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendLink()} />
                  </div>
                  <button className="btn primary lg block" disabled={busy || !email.includes('@')} onClick={sendLink}><Mail size={16} /> Email me a sign-in link</button>
                  {linkSent && (
                    <motion.div className="inbox col" style={{ gap: 6 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="row"><Inbox size={18} color="var(--primary)" /><b className="small">Check {linkSent.email}</b></div>
                      <div className="faint">Single-use link, valid for 15 minutes.</div>
                      {linkSent.dev_link && <Link className="btn sm primary" style={{ alignSelf: 'flex-start' }} to={linkSent.dev_link}>Open demo inbox link <ArrowRight size={14} /></Link>}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {method === 'google' && (
                <motion.div key="google" className="col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {cfg?.google_client_id ? (
                    <div ref={gBtn} style={{ minHeight: 44 }} />
                  ) : (
                    <>
                      <button className="google-btn" onClick={() => setGoogleOpen(true)} disabled={busy}><GoogleG /> Continue with Google</button>
                      {cfg?.demo_mode && <div className="faint">Demo mode: no Google client ID configured, so a simulated account chooser is used. Set <code>GOOGLE_CLIENT_ID</code> to enable real Google sign-in.</div>}
                    </>
                  )}
                  <div className="faint row"><Lock size={13} /> We only read your name and verified email.</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {cfg?.demo_mode && (
            <>
              <div className="divider">PRESENTATION DEMO · ONE-TAP SIGN-IN</div>
              <div className="demo-grid">
                {DEMO.map((d, i) => (
                  <motion.button key={d.role} className="demo-btn" onClick={() => demo(d.role)} disabled={busy}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
                    <div className="avatar" style={{ background: d.color, width: 36, height: 36, borderRadius: 11 }}><d.icon size={17} /></div>
                    <div className="grow"><div style={{ fontWeight: 700, fontSize: 13 }}>{d.label}</div><div className="tiny" style={{ color: 'var(--text-3)' }}>{d.who}</div></div>
                  </motion.button>
                ))}
              </div>
              <div className="faint" style={{ marginTop: 10 }}>Or OTP-login with a seeded number, e.g. <b>98000 00002</b> (Amit, confirmed donor).</div>
            </>
          )}
        </motion.div>
      </div>

      <Modal open={googleOpen} onClose={() => setGoogleOpen(false)} title="Choose a Google account">
        <div className="col">
          {['neha@lifecircle.demo', 'priya@lifecircle.demo'].map(e => (
            <button key={e} className="demo-btn" onClick={() => { setGEmail(e); setTimeout(() => go(async () => { setGoogleOpen(false); finish(await api('/api/auth/google/demo', { method: 'POST', body: { email: e } })) }), 0) }}>
              <div className="avatar" style={{ background: '#4285F4', width: 36, height: 36 }}>{e[0].toUpperCase()}</div>
              <div><div style={{ fontWeight: 700 }}>{e.split('@')[0][0].toUpperCase() + e.split('@')[0].slice(1)}</div><div className="faint">{e}</div></div>
            </button>
          ))}
          <div className="field mt8">
            <label>Use another account</label>
            <input className="input" type="email" placeholder="new.person@gmail.com" value={gEmail} onChange={e => setGEmail(e.target.value)} />
          </div>
          <button className="btn primary" disabled={!gEmail.includes('@') || busy} onClick={googleDemo}>Continue</button>
          <div className="faint">Simulated chooser for the demo – no data leaves this server.</div>
        </div>
      </Modal>
    </motion.div>
  )
}
