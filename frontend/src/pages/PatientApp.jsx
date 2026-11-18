import { motion } from 'framer-motion'
import { CalendarClock, CalendarDays, Copy, HeartPulse, History, Info, LayoutDashboard, Lock, RefreshCcw, Repeat, Settings2, ShieldCheck, Siren, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, fmtDate, fmtLong } from '../api.js'
import Shell from '../components/Shell.jsx'
import { Avatar, Badge, Card, CardTitle, Empty, Loading, Modal, Status, useAction } from '../components/ui.jsx'
import { useData, useTab } from '../hooks.js'

function Countdown({ days, cycle }) {
  const pct = Math.max(0, Math.min(1, 1 - days / Math.max(cycle, 1)))
  const r = 44, c = 2 * Math.PI * r
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-label={`${days} days to go`}>
      <circle cx="56" cy="56" r={r} stroke="rgba(255,255,255,.2)" strokeWidth="9" fill="none" />
      <motion.circle cx="56" cy="56" r={r} stroke="white" strokeWidth="9" fill="none" strokeLinecap="round" transform="rotate(-90 56 56)"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
      <text x="56" y="54" textAnchor="middle" fill="white" fontFamily="Plus Jakarta Sans" fontWeight="800" fontSize="28">{days <= 0 ? 'Today' : days}</text>
      {days > 0 && <text x="56" y="73" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="11" fontWeight="600">DAYS TO GO</text>}
    </svg>
  )
}

function DonorSlot({ label, d }) {
  return (
    <div className="glass grow" style={{ minWidth: 180 }}>
      <div className="tiny" style={{ opacity: 0.8, fontWeight: 700, letterSpacing: '.08em' }}>{label}</div>
      {d ? (
        <div className="row" style={{ marginTop: 8 }}>
          <Avatar name={d.display_name} />
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-display)' }}>{d.display_name}</div>
            <div className="small" style={{ opacity: 0.85 }}>{d.blood_group} · {d.status === 'attending' ? 'Confirmed ✓' : 'Awaiting reply'}{d.source === 'urgent' ? ' · urgent match' : d.source === 'promoted' ? ' · promoted' : ''}</div>
          </div>
        </div>
      ) : <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>Not assigned yet</div>}
    </div>
  )
}

const STEPS = [['circle', 'Circle alerted'], ['broadcast', 'Nearby donors'], ['filled', 'Donor confirmed']]
function UrgentProgress({ u }) {
  const done = ['filled', 'stock_fulfilled'].includes(u.status)
  const idx = done ? 2 : u.status === 'broadcast' ? 1 : 0
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between wrap">
        <div className="row"><span className="blood">{u.blood_group}</span><b>{u.units} unit(s) by {fmtDate(u.needed_by)}</b></div>
        <Status s={u.status} />
      </div>
      <div className="faint">{u.reason} · routed to {u.blood_bank}</div>
      <div className="row" style={{ gap: 6 }}>
        {STEPS.map(([k, label], i) => (
          <div key={k} className="grow">
            <div className="bar"><motion.div initial={{ width: 0 }} animate={{ width: i <= idx ? '100%' : '0%' }} transition={{ delay: i * 0.3, duration: 0.6 }}
              style={{ background: i <= idx ? (done ? 'var(--ok)' : undefined) : undefined }} /></div>
            <div className="tiny" style={{ marginTop: 6, fontWeight: 600, color: i <= idx ? 'var(--text)' : 'var(--text-3)' }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="small muted">
        {u.alerted.circle} circle member(s) and {u.alerted.nearby} nearby donor(s) alerted{u.radius_km ? ` within ${u.radius_km} km` : ''}.
        {u.filled_by && <> <b>{u.filled_by.display_name}</b> accepted{u.filled_by.distance ? ` (${u.filled_by.distance} away)` : ''}.</>}
        {u.status === 'stock_fulfilled' && <> {u.staff_note}.</>}
      </div>
    </div>
  )
}

export default function PatientApp() {
  const [tab, setTab] = useTab('overview')
  const [data, reload] = useData('/api/family/overview')
  const [pi, setPi] = useState(0)
  const [urgentOpen, setUrgentOpen] = useState(false)
  const [busy, run] = useAction()
  const [cycle, setCycle] = useState(null)
  const [uf, setUf] = useState({ reason: '', units: 1, needed_by: '' })

  const p = data?.patients?.[pi]
  useEffect(() => { if (p) { setCycle({ cycle_days: p.cycle_days, units_per_transfusion: p.units_per_transfusion }); setUf(u => ({ ...u, needed_by: u.needed_by || new Date().toISOString().slice(0, 10) })) } }, [p?.id, p?.cycle_days]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeUrgent = p?.urgent?.filter(u => ['circle', 'broadcast', 'no_match'].includes(u.status)) || []
  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'circle', label: 'Circle', icon: Users, count: p?.circle?.length },
    { value: 'rotation', label: 'Rotation', icon: Repeat },
    { value: 'urgent', label: 'Urgent', icon: Siren, count: activeUrgent.length || undefined },
  ]

  const saveCycle = () => run('cycle', () => api(`/api/family/patients/${p.id}/cycle`, { method: 'PUT', body: { cycle_days: Number(cycle.cycle_days), units_per_transfusion: Number(cycle.units_per_transfusion) } }), r => `Cycle saved · next transfusion ${fmtDate(r.next_date)}`).then(reload)
  const sendUrgent = async () => {
    const r = await run('urgent', () => api(`/api/family/patients/${p.id}/urgent`, { method: 'POST', body: { ...uf, units: Number(uf.units) } }), 'Urgent request sent to the blood bank')
    if (r) { setUrgentOpen(false); setTab('urgent'); reload() }
  }

  const next = p?.next
  const urgentButton = p && (
    <button className="btn danger" onClick={() => setUrgentOpen(true)}><Siren size={16} /> <span className="hide-sm">Request urgent help</span></button>
  )

  return (
    <Shell title={p ? `${p.name.split(' ')[0]}'s care plan` : 'Care plan'} subtitle={p ? `${p.condition} · ${p.blood_group} · ${p.hospital}` : ''}
      tabs={tabs} tab={tab} onTab={setTab} actions={urgentButton} onNotification={reload}>
      {!data ? <Loading /> : !p ? <Empty title="No patients yet" /> : (
        <>
          {data.patients.length > 1 && (
            <div className="row wrap" style={{ marginBottom: 16 }}>
              {data.patients.map((x, i) => <button key={x.id} className={`btn sm ${i === pi ? 'primary' : ''}`} onClick={() => setPi(i)}>{x.name}</button>)}
            </div>
          )}

          {tab === 'overview' && (
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              {activeUrgent.length > 0 && (
                <motion.div className="banner crit" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ display: 'grid' }}><Siren size={18} color="var(--crit)" /></motion.span>
                  <div className="grow"><b>Urgent mode is active.</b> <span className="small">We're finding a donor – the blood bank is watching.</span></div>
                  <button className="btn sm" onClick={() => setTab('urgent')}>Track</button>
                </motion.div>
              )}
              <Card className="hero-card" style={{ padding: 26 }}>
                <div className="row between wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
                  <div>
                    <div className="row" style={{ gap: 8, opacity: 0.9 }}><CalendarDays size={16} /> <b className="small" style={{ letterSpacing: '.08em' }}>NEXT TRANSFUSION</b></div>
                    <div className="big-date" style={{ marginTop: 10 }}>{fmtDate(next.date)}</div>
                    <div className="muted" style={{ marginTop: 8 }}>{fmtLong(next.date)} · {next.units_needed} unit(s) · {p.hospital}</div>
                    <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
                      <span className="badge" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}><Repeat size={12} /> Every {p.cycle_days} days</span>
                      <span className="badge" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}><ShieldCheck size={12} /> {next.status === 'scheduled' ? 'Slot booked by blood bank' : 'Awaiting blood bank approval'}</span>
                    </div>
                  </div>
                  <Countdown days={next.days_until} cycle={p.cycle_days} />
                </div>
                <div className="row wrap" style={{ marginTop: 22, gap: 12, alignItems: 'stretch' }}>
                  <DonorSlot label="CONFIRMED DONOR" d={next.confirmed} />
                  <DonorSlot label="BACKUP DONOR" d={next.backup} />
                </div>
              </Card>

              <div className="grid g3">
                <Card i={1}>
                  <CardTitle icon={Settings2} title="Transfusion cycle" sub="Changing it re-plans the next date" />
                  {cycle && (
                    <div className="col">
                      <div className="row between"><span className="muted small">Every</span><b className="mono" style={{ fontSize: 22 }}>{cycle.cycle_days} days</b></div>
                      <input type="range" min={7} max={60} value={cycle.cycle_days} onChange={e => setCycle(c => ({ ...c, cycle_days: e.target.value }))} style={{ accentColor: 'var(--primary)' }} aria-label="Cycle length" />
                      <div className="row between"><span className="muted small">Units per transfusion</span>
                        <select className="input" style={{ width: 80 }} value={cycle.units_per_transfusion} onChange={e => setCycle(c => ({ ...c, units_per_transfusion: e.target.value }))}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></div>
                      <button className="btn primary" disabled={busy === 'cycle'} onClick={saveCycle}>Save cycle</button>
                    </div>
                  )}
                </Card>
                <Card i={2}>
                  <CardTitle icon={Users} title="Grow your circle" sub="Share this code with relatives & friends" />
                  <motion.div className="row between" style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--primary-soft)', border: '1px dashed var(--rose-300)' }} whileHover={{ scale: 1.02 }}>
                    <b className="mono" style={{ fontSize: 22, letterSpacing: 2, color: 'var(--primary)' }}>{p.invite_code}</b>
                    <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(p.invite_code); run('copy', async () => 1, 'Invite code copied') }}><Copy size={14} /> Copy</button>
                  </motion.div>
                  <div className="faint mt16">{p.circle.length} members · {p.circle.filter(c => c.eligibility.eligible).length} eligible for {fmtDate(next.date)}. More members = lighter load on everyone.</div>
                </Card>
                <Card i={3}>
                  <CardTitle icon={History} title="Recent transfusions" />
                  {p.history.length === 0 ? <div className="faint">No history yet.</div> : (
                    <div className="timeline">
                      {p.history.slice(0, 4).map(h => (
                        <div key={h.date} className="tl-item done"><b className="small">{fmtDate(h.date)}</b> <span className="faint">{h.donors.length ? `· ${h.donors.join(', ')}` : '· from bank stock'}</span></div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
              <div className="banner info small"><Lock size={16} color="var(--info)" /><div>Donor phone numbers are never shown here. The blood bank coordinates every donation, so your circle's privacy is protected.</div></div>
            </div>
          )}

          {tab === 'circle' && (
            <Card>
              <CardTitle icon={Users} title={`${p.name.split(' ')[0]}'s donor circle`} sub={`Eligibility checked for ${fmtLong(next.date)}`}
                right={<button className="btn sm" onClick={() => run('replan', () => api(`/api/family/patients/${p.id}/replan`, { method: 'POST' }), 'Slots refreshed').then(reload)}><RefreshCcw size={14} /> Refresh slots</button>} />
              <div className="list">
                {p.circle.map((c, i) => (
                  <motion.div key={c.id} className="list-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Avatar name={c.display_name} />
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 8 }}><b>{c.display_name}</b><span className="faint">{c.relation}</span>{c.verified && <Badge tone="info"><ShieldCheck size={11} /> Verified</Badge>}</div>
                      <div className="faint">{c.why || c.contact}</div>
                    </div>
                    <span className="blood">{c.blood_group}</span>
                    <div style={{ width: 110 }} className="hide-sm">
                      {c.rotation_score != null ? (<><div className="bar"><motion.div initial={{ width: 0 }} animate={{ width: `${c.rotation_score}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} /></div><div className="tiny faint mt8">Priority {c.rotation_score}</div></>) : <div className="tiny faint">—</div>}
                    </div>
                    <Badge tone={c.eligibility.eligible ? 'ok' : c.eligibility.label.startsWith('Resting') ? 'warn' : ''} dot>{c.eligibility.label}</Badge>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'rotation' && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <Card>
                <CardTitle icon={CalendarClock} title="Next 6 cycles – forecast" sub="Assumes each confirmed donor donates as planned" />
                <div className="table-wrap">
                  <table className="t">
                    <thead><tr><th>Date</th><th>Confirmed</th><th>Backup</th></tr></thead>
                    <tbody>
                      {p.forecast.map((f, i) => (
                        <motion.tr key={f.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}>
                          <td className="mono"><b>{fmtDate(f.date)}</b></td>
                          <td>{f.confirmed ? <div className="row" style={{ gap: 8 }}><Avatar name={f.confirmed.name} size="" /><span>{f.confirmed.name.split(' ')[0]}</span></div> : <Badge tone="crit">Gap – urgent likely</Badge>}</td>
                          <td>{f.backup ? f.backup.name.split(' ')[0] : <span className="faint">—</span>}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card i={1}>
                <CardTitle icon={HeartPulse} title="How fair rotation works" />
                <div className="col small">
                  <p className="muted">Only donors who are medically eligible on the date (age, weight, 90/120-day gap, no deferral, compatible blood group) are considered. Each gets a transparent score:</p>
                  {[['Rotation', 40, 'Longest since they last helped this patient'], ['Rest', 20, 'Extra rest beyond the mandatory gap'], ['Reliability', 20, 'Shows up when booked; fewer late cancellations'], ['Load', 15, 'Fewer donations this year – prevents fatigue'], ['Exact match', 5, 'Same ABO/Rh preferred for chronic transfusion']].map(([k, w, d], i) => (
                    <div key={k}>
                      <div className="row between"><b>{k}</b><span className="score-pill">{w} pts</span></div>
                      <div className="bar mt8"><motion.div initial={{ width: 0 }} animate={{ width: `${w * 2.5}%` }} transition={{ delay: 0.2 + i * 0.1 }} /></div>
                      <div className="faint mt8">{d}</div>
                    </div>
                  ))}
                  <div className="banner info"><Info size={16} color="var(--info)" /><div>Top score = confirmed donor, runner-up = backup. If someone cancels, the backup is promoted automatically.</div></div>
                </div>
              </Card>
            </div>
          )}

          {tab === 'urgent' && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <Card>
                <CardTitle icon={Siren} title="Urgent requests" sub="Circle first, then verified donors nearby" right={urgentButton} />
                {p.urgent.length === 0 ? <Empty icon={ShieldCheck} title="No urgent requests" sub="Use this if a donor cancels last-minute or a transfusion is needed early." /> : (
                  <div className="col" style={{ gap: 22 }}>{p.urgent.map(u => <UrgentProgress key={u.id} u={u} />)}</div>
                )}
              </Card>
              <Card i={1}>
                <CardTitle icon={Info} title="What happens when you press the button" />
                <div className="timeline small">
                  <div className="tl-item"><b>1 · Blood bank is alerted</b><div className="faint">Your request lands in {p.blood_bank}'s queue immediately.</div></div>
                  <div className="tl-item"><b>2 · Your circle first</b><div className="faint">Every eligible circle member gets an urgent alert.</div></div>
                  <div className="tl-item"><b>3 · Nearby verified donors</b><div className="faint">If unfilled, compatible donors are alerted ring by ring – 5, 10, 25, 50 km – closest first.</div></div>
                  <div className="tl-item"><b>4 · First to accept is confirmed</b><div className="faint">Everyone else is told it's filled. The blood bank calls the donor.</div></div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Modal open={urgentOpen} onClose={() => setUrgentOpen(false)} title="Request urgent help">
        <div className="col">
          <div className="banner crit small"><Siren size={16} color="var(--crit)" /><div>This goes straight to <b>{p?.blood_bank}</b> and alerts your circle.</div></div>
          <div className="field"><label>What happened?</label><textarea className="input" rows={3} placeholder="e.g. Donor cancelled, Hb dropped to 6.5" value={uf.reason} onChange={e => setUf(u => ({ ...u, reason: e.target.value }))} /></div>
          <div className="grid g2">
            <div className="field"><label>Needed by</label><input className="input" type="date" value={uf.needed_by} onChange={e => setUf(u => ({ ...u, needed_by: e.target.value }))} /></div>
            <div className="field"><label>Units</label><select className="input" value={uf.units} onChange={e => setUf(u => ({ ...u, units: e.target.value }))}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></div>
          </div>
          <button className="btn danger lg" disabled={busy === 'urgent' || uf.reason.length < 3} onClick={sendUrgent}><Siren size={16} /> Send urgent request</button>
        </div>
      </Modal>
    </Shell>
  )
}
