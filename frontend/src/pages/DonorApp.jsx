import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, CalendarCheck2, Check, Droplet, HandHeart, Heart, Home, MapPin, ShieldCheck, Siren, UserCog, Users, X } from 'lucide-react'
import { useState } from 'react'
import { api, fmtDate, fmtLong, timeAgo } from '../api.js'
import Shell from '../components/Shell.jsx'
import { AnimatedNumber, Avatar, Badge, Card, CardTitle, Empty, Loading, Modal, Status, useAction } from '../components/ui.jsx'
import { useData, useTab } from '../hooks.js'

function Toggle({ on, onChange, label, sub }) {
  return (
    <button className="row" onClick={() => onChange(!on)} style={{ border: 0, background: 'none', padding: '10px 0', width: '100%', textAlign: 'left', cursor: 'pointer' }} role="switch" aria-checked={on}>
      <div className="grow"><b>{label}</b><div className="faint">{sub}</div></div>
      <div style={{ width: 46, height: 28, borderRadius: 99, padding: 3, background: on ? 'var(--ok)' : 'var(--border-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s' }}>
        <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} style={{ width: 22, height: 22, borderRadius: 99, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
    </button>
  )
}

function AlertCard({ a, onAccept, onDecline, busy }) {
  const live = a.status === 'sent' && ['circle', 'broadcast'].includes(a.request_status)
  return (
    <motion.div layout className="card" style={{ borderColor: live ? 'var(--rose-300)' : undefined, overflow: 'hidden' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {live && <motion.div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 0%, rgba(244,63,94,.12), transparent 60%)' }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} />}
      <div className="row wrap" style={{ position: 'relative', alignItems: 'flex-start' }}>
        <div className="avatar lg" style={{ background: 'linear-gradient(135deg,#fb7185,#be123c)' }}>{a.blood_group}</div>
        <div className="grow">
          <div className="row wrap" style={{ gap: 8 }}>
            <b style={{ fontSize: 17 }}>{a.patient} needs {a.units} unit(s)</b>
            {a.in_circle ? <Badge tone="violet">Your circle</Badge> : <Badge tone="rose">Nearby request</Badge>}
          </div>
          <div className="row wrap" style={{ gap: 14, marginTop: 6 }}>
            <span className="row small" style={{ gap: 5, fontWeight: 700, color: 'var(--primary)' }}><MapPin size={15} /> {a.distance} from you</span>
            <span className="small muted">{a.blood_bank}</span>
            <span className="small muted">by {fmtLong(a.needed_by)}</span>
          </div>
          <div className="faint mt8">Sent {timeAgo(a.sent_at)} · first donor to accept is confirmed</div>
        </div>
        <div className="row">
          {live ? (
            <>
              <button className="btn" disabled={!!busy} onClick={onDecline}><X size={15} /> Can't</button>
              <motion.button className="btn ok" disabled={!!busy} onClick={onAccept} whileTap={{ scale: 0.94 }} animate={{ boxShadow: ['0 0 0 0 rgba(5,150,105,.5)', '0 0 0 10px rgba(5,150,105,0)'] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                <Check size={15} /> I can donate
              </motion.button>
            </>
          ) : <Status s={a.status === 'sent' ? a.request_status : a.status} />}
        </div>
      </div>
    </motion.div>
  )
}

export default function DonorApp() {
  const [tab, setTab] = useTab('home')
  const [data, reload] = useData('/api/donor/overview')
  const [busy, run] = useAction()
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')
  const [relation, setRelation] = useState('')

  const live = data?.alerts.filter(a => a.status === 'sent' && ['circle', 'broadcast'].includes(a.request_status)) || []
  const tabs = [
    { value: 'home', label: 'Home', icon: Home },
    { value: 'alerts', label: 'Alerts', icon: BellRing, count: live.length || undefined },
    { value: 'profile', label: 'Profile', icon: UserCog },
  ]
  const act = (key, path, msg, body) => run(key, () => api(path, { method: 'POST', body }), msg).then(r => { reload(); return r })
  const prefs = body => run('prefs', () => api('/api/donor/preferences', { method: 'PUT', body }), 'Preferences saved').then(reload)

  const e = data?.eligibility
  const first = data?.profile?.name?.split(' ')[0]

  return (
    <Shell title={first ? `Hi ${first} 👋` : 'Donor'} subtitle={data ? `${data.profile.blood_group} donor · ${data.profile.area || 'Location set'}` : ''} tabs={tabs} tab={tab} onTab={setTab} onNotification={reload}>
      {!data ? <Loading /> : (
        <>
          {tab === 'home' && (
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              <AnimatePresence>
                {live.length > 0 && (
                  <motion.button className="banner crit" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => setTab('alerts')}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 1 }} style={{ display: 'grid' }}><Siren size={20} color="var(--crit)" /></motion.span>
                    <div className="grow"><b>{live.length} urgent request{live.length > 1 ? 's' : ''} near you</b><div className="small">Closest: {live[0].blood_group} · {live[0].distance} from you</div></div>
                    <span className="btn sm">View</span>
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="grid g3">
                <Card className="hero-card">
                  <div className="row" style={{ gap: 8, opacity: 0.9 }}><Droplet size={16} /><b className="small" style={{ letterSpacing: '.08em' }}>ELIGIBILITY</b></div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, marginTop: 10 }}>{e.eligible ? 'Ready to donate' : e.next_eligible_date ? `From ${fmtDate(e.next_eligible_date)}` : 'Not eligible'}</div>
                  <div className="muted small" style={{ marginTop: 6 }}>{e.eligible ? 'All pre-checks pass. Final screening happens at the blood bank.' : e.reasons.join(' · ')}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
                    {Object.entries(e.checks).map(([k, v]) => <span key={k} className="badge" style={{ background: 'rgba(255,255,255,.16)', color: 'white' }}>{v ? '✓' : '✕'} {k}</span>)}
                  </div>
                </Card>
                <Card i={1}>
                  <div className="row"><div className="card-title" style={{ margin: 0 }}><div className="ico"><Heart size={18} /></div></div><b>Your impact</b></div>
                  <div className="row" style={{ marginTop: 16, gap: 24 }}>
                    <div><div className="stat-big"><AnimatedNumber value={data.stats.donations} /></div><div className="faint">donations</div></div>
                    <div><div className="stat-big grad-text"><AnimatedNumber value={data.stats.lives_supported} /></div><div className="faint">lives supported*</div></div>
                  </div>
                  <div className="tiny faint mt8">*One donation can be split into up to 3 components.</div>
                </Card>
                <Card i={2}>
                  <CardTitle icon={Users} title="Your circles" />
                  {data.circles.length === 0 ? <div className="faint">Join a patient's circle with their invite code (Profile tab).</div> : data.circles.map(c => (
                    <div key={c.patient} className="list-row"><Avatar name={c.patient} /><div className="grow"><b>{c.patient}</b><div className="faint">{c.relation} · {c.hospital}</div></div><span className="blood">{c.blood_group}</span></div>
                  ))}
                </Card>
              </div>
              <Card i={3}>
                <CardTitle icon={CalendarCheck2} title="Upcoming donations" sub="Confirm early – or cancel early so a backup can step in" />
                {data.upcoming.length === 0 ? <Empty icon={CalendarCheck2} title="Nothing scheduled" sub="Fair rotation will let you know when it's your turn." /> : (
                  <div className="list">
                    {data.upcoming.map(u => (
                      <motion.div key={u.assignment_id} className="list-row wrap" layout>
                        <div className="center" style={{ width: 58, padding: '8px 0', borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{new Date(u.date + 'T00:00').getDate()}</div>
                          <div className="tiny" style={{ fontWeight: 700 }}>{new Date(u.date + 'T00:00').toLocaleString('en', { month: 'short' }).toUpperCase()}</div>
                        </div>
                        <div className="grow">
                          <div className="row wrap" style={{ gap: 8 }}><b>For {u.patient}</b><Badge tone={u.slot === 'confirmed' ? 'rose' : 'violet'}>{u.slot === 'confirmed' ? 'Confirmed donor' : 'Backup (standby)'}</Badge><Status s={u.status} /></div>
                          <div className="faint">{u.blood_bank} · in {u.days_until} day{u.days_until === 1 ? '' : 's'}</div>
                        </div>
                        <div className="row">
                          {u.status === 'pending' && <button className="btn ok sm" disabled={!!busy} onClick={() => act('c' + u.assignment_id, `/api/donor/assignments/${u.assignment_id}/confirm`, 'Thank you – attendance confirmed')}><Check size={14} /> I'll be there</button>}
                          <button className="btn sm" disabled={!!busy} onClick={() => { setCancelling(u); setReason('') }}><X size={14} /> Cancel</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'alerts' && (
            <div className="col" style={{ gap: 14 }}>
              <div className="banner info small"><MapPin size={16} color="var(--info)" /><div>Alerts are ranked by distance to the blood bank. You only see the patient's name if you're in their circle.</div></div>
              {data.alerts.length === 0 ? <Card><Empty icon={BellRing} title="No urgent alerts" sub="We'll notify you when someone nearby needs your blood group." /></Card>
                : data.alerts.map(a => (
                  <AlertCard key={a.alert_id} a={a} busy={busy}
                    onAccept={() => act('a', `/api/donor/alerts/${a.alert_id}/accept`, r => r.message)}
                    onDecline={() => act('d', `/api/donor/alerts/${a.alert_id}/decline`, 'Thanks for letting us know')} />
                ))}
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <Card>
                <CardTitle icon={UserCog} title="Availability" />
                <Toggle on={data.profile.available} label="Available to donate" sub="Turn off while travelling or unwell" onChange={v => prefs({ available: v })} />
                <Toggle on={data.profile.open_to_urgent} label="Urgent alerts from strangers nearby" sub="Your circle can always reach you" onChange={v => prefs({ open_to_urgent: v })} />
                <button className="btn sm mt8" onClick={() => navigator.geolocation?.getCurrentPosition(p => prefs({ lat: p.coords.latitude, lng: p.coords.longitude }))}><MapPin size={14} /> Update my location</button>
                <div className="section-title mt24">Your details (only you & blood bank staff see these)</div>
                <div className="grid g2 small">
                  <div><div className="faint">Phone</div><b>{data.profile.phone}</b></div>
                  <div><div className="faint">Blood group</div><b>{data.profile.blood_group}</b></div>
                  <div><div className="faint">Last donation</div><b>{fmtDate(data.profile.last_donation_date)}</b></div>
                  <div><div className="faint">Verification</div>{data.profile.verified ? <Badge tone="ok"><ShieldCheck size={12} /> Verified by blood bank</Badge> : <Badge tone="warn">Pending verification</Badge>}</div>
                </div>
              </Card>
              <div className="col" style={{ gap: 18 }}>
                <Card i={1}>
                  <CardTitle icon={HandHeart} title="Join a circle" sub="Ask the family for their invite code" />
                  <div className="grid g2">
                    <input className="input" placeholder="AARAV-7Q2K" value={code} onChange={e => setCode(e.target.value)} />
                    <input className="input" placeholder="Relation (optional)" value={relation} onChange={e => setRelation(e.target.value)} />
                  </div>
                  <button className="btn primary mt16" disabled={!code || !!busy} onClick={() => act('join', '/api/donor/circles/join', r => `Joined ${r.patient}'s circle`, { code, relation }).then(r => r && setCode(''))}>Join circle</button>
                </Card>
                <Card i={2}>
                  <CardTitle icon={Droplet} title="Donation history" />
                  {data.history.length === 0 ? <div className="faint">No donations logged yet.</div> : (
                    <div className="timeline">{data.history.map((h, i) => <div key={i} className={`tl-item ${h.outcome === 'donated' ? 'done' : ''}`}><b className="small">{fmtDate(h.date)}</b> <Status s={h.outcome} /></div>)}</div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this donation?">
        {cancelling && (
          <div className="col">
            <p className="muted small">{cancelling.slot === 'confirmed' ? 'Your backup will be promoted automatically. If there is no backup, Urgent mode starts and the blood bank is alerted.' : 'A new backup will be picked from the circle.'}</p>
            <div className="field"><label>Reason (shared with blood bank only)</label><input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Fever, travelling" /></div>
            <div className="row">
              <button className="btn grow" onClick={() => setCancelling(null)}>Keep my slot</button>
              <button className="btn danger grow" disabled={!!busy} onClick={async () => {
                const r = await act('x', `/api/donor/assignments/${cancelling.assignment_id}/cancel`, r => r.promoted ? 'Cancelled – backup promoted' : r.urgent_request_id ? 'Cancelled – urgent mode started' : 'Cancelled', { reason })
                if (r) setCancelling(null)
              }}>Cancel donation</button>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  )
}
