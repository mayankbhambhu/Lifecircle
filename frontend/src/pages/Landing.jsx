import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BellRing, Building2, CalendarSync, CheckCircle2, HeartHandshake, Hospital, Lock, MapPinned, MessageCircleOff, Repeat, ShieldCheck, Siren, Timer, UserRound, Users, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Logo from '../components/Logo.jsx'
import { AnimatedNumber, Avatar } from '../components/ui.jsx'

const fade = { hidden: { opacity: 0, y: 24 }, show: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }) }
const In = ({ i = 0, children, className, style }) => (
  <motion.div className={className} style={style} variants={fade} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={i}>{children}</motion.div>
)

function HeroVisual() {
  const people = ['Amit S.', 'Priya M.', 'Rahul S.', 'Sneha G.', 'Vikram S.', 'Deepak J.']
  return (
    <div style={{ position: 'relative', aspectRatio: '1', maxWidth: 460, width: '100%', margin: '0 auto' }}>
      <motion.div style={{ position: 'absolute', inset: '8%', borderRadius: '50%', border: '2px dashed var(--rose-200)' }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: 'linear' }} />
      <motion.div style={{ position: 'absolute', inset: '24%', borderRadius: '50%', background: 'radial-gradient(circle, var(--rose-100), transparent 70%)' }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 3 }} />
      <div style={{ position: 'absolute', inset: '34%', display: 'grid', placeItems: 'center' }}>
        <motion.div className="card" style={{ padding: 16, textAlign: 'center', borderRadius: 24 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.3 }}>
          <div className="faint" style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.08em' }}>NEXT TRANSFUSION</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--primary)' }}>27 Nov</div>
          <div className="tiny faint">Aarav · B+ · every 21 days</div>
        </motion.div>
      </div>
      {people.map((p, i) => {
        const a = (i / people.length) * Math.PI * 2 - Math.PI / 2
        const x = 50 + 42 * Math.cos(a), y = 50 + 42 * Math.sin(a)
        const role = i === 0 ? 'Confirmed' : i === 1 ? 'Backup' : null
        return (
          <motion.div key={p} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
            transition={{ opacity: { delay: 0.5 + i * 0.1 }, scale: { delay: 0.5 + i * 0.1, type: 'spring' }, y: { repeat: Infinity, duration: 3 + i * 0.3, ease: 'easeInOut' } }}>
            <div className="card row" style={{ padding: '8px 12px 8px 8px', borderRadius: 16, gap: 8, borderColor: role === 'Confirmed' ? 'var(--ok)' : role ? 'var(--violet)' : undefined }}>
              <Avatar name={p} />
              <div style={{ whiteSpace: 'nowrap' }}><div style={{ fontWeight: 700, fontSize: 13 }}>{p}</div>{role && <div className="tiny" style={{ color: role === 'Confirmed' ? 'var(--ok)' : 'var(--violet)', fontWeight: 700 }}>{role}</div>}</div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function Landing() {
  const [impact, setImpact] = useState(null)
  const { scrollYProgress } = useScroll()
  const bar = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  useEffect(() => { api('/api/impact').then(setImpact).catch(() => {}) }, [])

  return (
    <motion.div className="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div style={{ position: 'fixed', top: 0, left: 0, height: 3, width: bar, background: 'var(--primary)', zIndex: 60 }} />
      <nav className="land-nav">
        <div className="container row between" style={{ padding: '14px 0' }}>
          <div className="row" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19 }}><Logo size={30} animated /> LifeCircle</div>
          <div className="row">
            <a className="btn ghost hide-sm" href="#how">How it works</a>
            <a className="btn ghost hide-sm" href="#scope">Scope</a>
            <Link className="btn primary" to="/login">Sign in <ArrowRight size={15} /></Link>
          </div>
        </div>
      </nav>

      <section className="container land-hero">
        <div>
          <In><span className="eyebrow"><Repeat size={14} /> For thalassemia & regular-transfusion patients</span></In>
          <In i={1}><h1 className="display" style={{ marginTop: 18 }}>Blood on time,<br /><span className="grad-text">every single cycle.</span></h1></In>
          <In i={2}><p className="muted" style={{ fontSize: 18, marginTop: 18, maxWidth: 540 }}>
            LifeCircle plans every transfusion ahead, rotates a family's donor circle fairly, reminds donors automatically, and – when someone cancels – finds the nearest eligible donor in minutes.
          </p></In>
          <In i={3} className="row wrap" style={{ marginTop: 28 }}>
            <Link className="btn primary lg" to="/login">Open the app <ArrowRight size={16} /></Link>
            <a className="btn lg" href="#problem">Why it matters</a>
          </In>
          <In i={4} className="row wrap" style={{ marginTop: 26, gap: 18 }}>
            {[['Planned mode', CalendarSync], ['Urgent mode', Siren], ['Private by design', Lock]].map(([t, I]) => <span key={t} className="row small muted" style={{ gap: 6 }}><I size={15} color="var(--primary)" /> {t}</span>)}
          </In>
        </div>
        <HeroVisual />
      </section>

      <section id="problem" className="land-section" style={{ background: 'var(--surface)', borderBlock: '1px solid var(--border)' }}>
        <div className="container">
          <In><div className="eyebrow">The real problem</div></In>
          <In i={1}><h2 style={{ marginTop: 14, maxWidth: 760 }}>A child with thalassemia major needs blood every 2–4 weeks. For life.</h2></In>
          <In i={2}><p className="muted" style={{ marginTop: 12, maxWidth: 760, fontSize: 17 }}>
            India has one of the world's largest populations of thalassemia major patients, and most depend on replacement donors arranged by their own families. Every cycle restarts the same scramble.
          </p></In>
          <div className="grid g3" style={{ marginTop: 32 }}>
            {[
              [MessageCircleOff, 'Manual messaging every cycle', 'Parents chase relatives on WhatsApp every few weeks, often the same few people – who burn out.'],
              [Timer, 'Donors forget eligibility', 'Nobody tracks the 90/120-day gap, so willing donors turn up ineligible or are asked too soon.'],
              [XCircle, 'Last-minute cancellations', 'One cancellation the night before turns a routine transfusion into an emergency hunt.'],
            ].map(([I, t, d], i) => (
              <In key={t} i={i} className="card feature">
                <div className="ico" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}><I size={22} /></div>
                <h3 style={{ fontSize: 18 }}>{t}</h3><p className="muted small" style={{ marginTop: 8 }}>{d}</p>
              </In>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="land-section">
        <div className="container">
          <In><div className="eyebrow">How LifeCircle solves it</div></In>
          <In i={1}><h2 style={{ marginTop: 14 }}>Two mechanics. One calm family.</h2></In>
          <div className="grid g2" style={{ marginTop: 32 }}>
            <In className="card feature" style={{ padding: 28 }}>
              <div className="ico" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><CalendarSync size={22} /></div>
              <h3 style={{ fontSize: 22 }}>Planned mode · the core loop</h3>
              <div className="timeline small" style={{ marginTop: 18 }}>
                {['Next date = last transfusion + cycle (e.g. 21 days)', 'Medical eligibility checked for every circle member on that date', 'Fair rotation picks a Confirmed and a Backup donor – with a visible "why"', 'Automated reminders at T-7, T-3, T-1; backup on standby', 'Blood bank logs Donated / Deferred / No-show / Excused → next cycle plans itself'].map(s => <div key={s} className="tl-item done">{s}</div>)}
              </div>
            </In>
            <In i={1} className="card feature" style={{ padding: 28 }}>
              <div className="ico" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}><Siren size={22} /></div>
              <h3 style={{ fontSize: 22 }}>Urgent mode · when plans break</h3>
              <div className="timeline small" style={{ marginTop: 18 }}>
                {['Donor cancels → backup is promoted instantly', 'No backup? The immediate circle is alerted first', 'Still unfilled → verified donors nearby, ring by ring (5 → 10 → 25 → 50 km)', 'Each donor sees "2.4 km from you"; first to accept is confirmed', 'Blood bank can broadcast now, re-route, or cover from stock'].map(s => <div key={s} className="tl-item">{s}</div>)}
              </div>
            </In>
          </div>
        </div>
      </section>

      <section className="land-section" style={{ background: 'var(--surface)', borderBlock: '1px solid var(--border)' }}>
        <div className="container">
          <In><div className="eyebrow">One login · four roles</div></In>
          <In i={1}><h2 style={{ marginTop: 14 }}>Everyone sees exactly what they need – nothing more.</h2></In>
          <div className="grid g4" style={{ marginTop: 32 }}>
            {[
              [UserRound, 'Patient family', 'Next date, confirmed + backup donor, cycle settings, one-tap urgent help.', '#e11d48'],
              [HeartHandshake, 'Donor', 'Upcoming slots to confirm or cancel, eligibility countdown, nearby urgent alerts.', '#7c3aed'],
              [Building2, 'Blood bank', 'Request queue, donor phones & verification, daily screening log, stock alerts.', '#2563eb'],
              [Hospital, 'Hospital', 'Patient coverage at a glance, linked bank stock, raise urgent requests.', '#059669'],
            ].map(([I, t, d, c], i) => (
              <In key={t} i={i} className="card feature">
                <div className="ico" style={{ background: c, color: 'white' }}><I size={22} /></div>
                <h3 style={{ fontSize: 17 }}>{t}</h3><p className="muted small" style={{ marginTop: 8 }}>{d}</p>
              </In>
            ))}
          </div>
          <In i={2} className="row wrap" style={{ marginTop: 24, gap: 10 }}>
            {['Phone OTP', 'Email magic link', 'Sign in with Google', 'Auto-routing by role', 'Staff accounts invite-only'].map(t => <span key={t} className="badge rose" style={{ padding: '6px 12px' }}><CheckCircle2 size={13} /> {t}</span>)}
          </In>
        </div>
      </section>

      <section className="land-section">
        <div className="container">
          <div className="grid g2" style={{ alignItems: 'center', gap: 40 }}>
            <div>
              <In><div className="eyebrow"><ShieldCheck size={14} /> Privacy</div></In>
              <In i={1}><h2 style={{ marginTop: 14 }}>Donor phone numbers never leave the blood bank.</h2></In>
              <In i={2}><p className="muted" style={{ marginTop: 12, fontSize: 16 }}>Families and hospitals see "Amit S. · Confirmed" – never a number or a medical reason. External donors answering an emergency don't learn the patient's name. Every time staff open contact details it's written to an audit log.</p></In>
            </div>
            <In i={1} className="card" style={{ padding: 22 }}>
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>Field</th><th>Family</th><th>Hospital</th><th>Blood bank</th></tr></thead>
                  <tbody>
                    {[['Donor short name', 1, 1, 1], ['Full name', 0, 0, 1], ['Phone number', 0, 0, 1], ['Deferral reasons', 0, 0, 1], ['Eligibility status', 1, 1, 1], ['Verification', 1, 1, 1]].map(([f, ...v]) => (
                      <tr key={f}><td><b className="small">{f}</b></td>{v.map((x, i) => <td key={i}>{x ? <CheckCircle2 size={17} color="var(--ok)" /> : <Lock size={15} color="var(--text-3)" />}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </In>
          </div>
        </div>
      </section>

      <section className="land-section" style={{ background: 'linear-gradient(135deg, #e11d48, #881337)', color: 'white' }}>
        <div className="container">
          <In><h2>Live in this demo right now</h2></In>
          <div className="grid g4" style={{ marginTop: 28 }}>
            {[['Patients on a plan', impact?.patients, Users], ['Donors in the network', impact?.donors, HeartHandshake], ['Donations logged', impact?.donations, CheckCircle2], ['Verified for urgent alerts', impact?.verified_donors, BellRing]].map(([t, v, I], i) => (
              <In key={t} i={i}>
                <I size={22} style={{ opacity: 0.8 }} />
                <div className="stat-big" style={{ fontSize: 46 }}>{v != null ? <AnimatedNumber value={v} /> : '—'}</div>
                <div style={{ opacity: 0.85 }}>{t}</div>
              </In>
            ))}
          </div>
        </div>
      </section>

      <section id="scope" className="land-section">
        <div className="container grid g2" style={{ gap: 28, alignItems: 'start' }}>
          <In className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 20 }} className="row"><CheckCircle2 color="var(--ok)" /> What LifeCircle does</h3>
            <ul className="scope muted">
              <li>Schedules recurring transfusions and plans donors ahead of time</li>
              <li>Pre-screens donor eligibility (age, weight, 90/120-day gap, deferrals, ABO/Rh)</li>
              <li>Rotates donors fairly with an explainable score</li>
              <li>Escalates emergencies: circle → nearby rings, first-accept-wins</li>
              <li>Gives blood banks a queue, a screening log and stock shortage alerts</li>
              <li>Keeps donor contact details private and audited</li>
            </ul>
          </In>
          <In i={1} className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 20 }} className="row"><XCircle color="var(--crit)" /> What it doesn't do</h3>
            <ul className="scope muted">
              <li>It is not a medical device and does not make the final medical call – staff screening on the day does</li>
              <li>No cross-matching, extended phenotype (Rh/Kell) matching or iron-chelation tracking</li>
              <li>Doesn't replace the blood bank's own inventory / LIS – stock levels are entered or synced</li>
              <li>No real SMS/WhatsApp gateway in the demo (codes and links appear in a demo inbox)</li>
              <li>Distance is straight-line, not travel time; no live traffic or routing</li>
              <li>Doesn't handle payments, transport, or inter-city blood movement</li>
            </ul>
          </In>
        </div>
        <div className="container center" style={{ marginTop: 48 }}>
          <In><Link className="btn primary lg" to="/login">Try the four dashboards <ArrowRight size={16} /></Link></In>
        </div>
      </section>

      <footer className="footer">
        <div className="container row between wrap">
          <div className="row"><Logo size={22} /> LifeCircle · capstone demo · all people and organisations are fictional</div>
          <a href="/docs" className="row" style={{ gap: 6 }}><MapPinned size={14} /> API docs</a>
        </div>
      </footer>
    </motion.div>
  )
}
