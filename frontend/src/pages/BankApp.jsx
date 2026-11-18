import { motion } from 'framer-motion'
import { Activity, ArrowRightLeft, CalendarCheck, CheckCircle2, ClipboardList, Droplets, FileLock2, Inbox, Megaphone, PackageCheck, Phone, Play, Radio, Search, ShieldCheck, Siren, Users, XCircle } from 'lucide-react'
import { useState } from 'react'
import { api, fmtDate, timeAgo } from '../api.js'
import Radar from '../components/Radar.jsx'
import Shell from '../components/Shell.jsx'
import { StockAlerts, StockTubes } from '../components/Stock.jsx'
import { AnimatedNumber, Avatar, Badge, Card, CardTitle, Empty, Loading, Modal, Status, useAction } from '../components/ui.jsx'
import { useData, useTab } from '../hooks.js'

const today = () => new Date().toISOString().slice(0, 10)

function Kpi({ icon: Icon, label, value, tone, i }) {
  return (
    <Card i={i} style={{ padding: 18 }}>
      <div className="row between">
        <div className="faint" style={{ fontWeight: 600 }}>{label}</div>
        <div className="ico" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: `var(--${tone}-soft)`, color: `var(--${tone})` }}><Icon size={16} /></div>
      </div>
      <div className="stat-big" style={{ marginTop: 6 }}><AnimatedNumber value={value} /></div>
    </Card>
  )
}

function DonorCell({ d }) {
  if (!d) return <span className="faint">—</span>
  return (
    <div className="row" style={{ gap: 10 }}>
      <Avatar name={d.name || d.display_name} />
      <div>
        <div style={{ fontWeight: 650 }}>{d.name}</div>
        <a className="tiny row" style={{ gap: 4 }} href={`tel:${d.phone?.replace(/\s/g, '')}`}><Phone size={11} /> {d.phone}</a>
      </div>
    </div>
  )
}

function UrgentCard({ u, onAction, busy, banks }) {
  const open = ['circle', 'broadcast', 'no_match'].includes(u.status)
  return (
    <Card style={{ borderColor: open ? 'var(--rose-300)' : undefined }}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 22 }}>
        <div className="col" style={{ gap: 14, minWidth: 0 }}>
          <div className="row between wrap">
            <div className="row wrap" style={{ gap: 8 }}>
              {open && <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ display: 'grid' }}><Siren size={18} color="var(--crit)" /></motion.span>}
              <b style={{ fontSize: 17 }}>{u.patient.name}</b><span className="blood">{u.blood_group}</span><span className="faint">{u.units} unit(s) by {fmtDate(u.needed_by)}</span>
            </div>
            <Status s={u.status} />
          </div>
          <div className="small muted">{u.reason} · <Badge>{u.source.replace('_', ' ')}</Badge> · {timeAgo(u.created_at)}{u.staff_note ? ` · ${u.staff_note}` : ''}</div>
          <div className="row wrap" style={{ gap: 8 }}>
            <Badge tone="violet">Stage {u.stage} {u.stage === 1 ? '· circle' : `· ${u.radius_km} km ring`}</Badge>
            <Badge>{u.alerted.circle} circle</Badge><Badge>{u.alerted.nearby} nearby</Badge>{u.alerted.declined > 0 && <Badge tone="warn">{u.alerted.declined} declined</Badge>}
          </div>
          {u.filled_by && <div className="banner ok"><CheckCircle2 size={18} color="var(--ok)" /><div className="grow"><b>{u.filled_by.name}</b> accepted · {u.filled_by.distance} · <a href={`tel:${u.filled_by.phone}`}>{u.filled_by.phone}</a></div></div>}
          <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
            <table className="t">
              <thead><tr><th>#</th><th>Donor</th><th>Group</th><th>Distance</th><th>Status</th></tr></thead>
              <tbody>
                {u.alerts.map(a => (
                  <tr key={a.alert_id}>
                    <td className="faint">{a.in_circle ? 'C' : a.stage}</td>
                    <td><DonorCell d={a} /></td>
                    <td><span className="blood">{a.blood_group}</span></td>
                    <td className="mono">{a.distance}</td>
                    <td><Status s={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {u.alerts.length === 0 && <div className="faint" style={{ padding: 8 }}>No donors alerted yet.</div>}
          </div>
          {open && (
            <div className="row wrap">
              {u.status !== 'no_match' && <button className="btn primary sm" disabled={!!busy} onClick={() => onAction('approve', u)}><Radio size={14} /> {u.stage === 1 ? 'Approve & broadcast nearby' : 'Widen radius'}</button>}
              <button className="btn sm" disabled={!!busy} onClick={() => onAction('stock', u)}><PackageCheck size={14} /> Fulfil from stock</button>
              {banks.length > 0 && <button className="btn sm" disabled={!!busy} onClick={() => onAction('reroute', u)}><ArrowRightLeft size={14} /> Re-route</button>}
              <button className="btn ghost sm" disabled={!!busy} onClick={() => onAction('cancel', u)}><XCircle size={14} /> Close</button>
            </div>
          )}
        </div>
        <div className="hide-sm"><Radar alerts={u.alerts} radius={u.radius_km || 5} /></div>
      </div>
    </Card>
  )
}

export default function BankApp() {
  const [tab, setTab] = useTab('queue')
  const [q, reloadQ] = useData('/api/bank/queue')
  const [stock, reloadStock] = useData('/api/bank/inventory')
  const [day, setDay] = useState(today())
  const [log, reloadLog] = useData(`/api/bank/log?day=${day}`, [day])
  const [search, setSearch] = useState({ q: '', group: '' })
  const [donors, reloadDonors] = useData(`/api/bank/donors?q=${encodeURIComponent(search.q)}&group=${encodeURIComponent(search.group)}`, [search.q, search.group])
  const [audit, reloadAudit] = useData('/api/bank/audit', [tab])
  const [busy, run] = useAction()
  const [reroute, setReroute] = useState(null)
  const [edit, setEdit] = useState(null)
  const [rallied, setRallied] = useState(null)
  const [hb, setHb] = useState({})

  const reloadAll = () => { reloadQ(); reloadStock(); reloadLog() }
  const post = (key, path, msg, body) => run(key, () => api(path, { method: 'POST', body }), msg).then(r => { reloadAll(); return r })

  const urgentOpen = q?.urgent.filter(u => ['circle', 'broadcast', 'no_match'].includes(u.status)) || []
  const awaiting = q?.planned.filter(p => p.status === 'awaiting_bank') || []
  const tabs = [
    { value: 'queue', label: 'Request queue', icon: Inbox, count: (urgentOpen.length + awaiting.length) || undefined },
    { value: 'log', label: 'Daily log', icon: ClipboardList },
    { value: 'stock', label: 'Stock', icon: Droplets, count: stock?.alerts.filter(a => a.status === 'critical').length || undefined },
    { value: 'donors', label: 'Donors', icon: Users },
    { value: 'audit', label: 'Privacy audit', icon: FileLock2 },
  ]

  const onUrgent = (kind, u) => {
    if (kind === 'approve') post('u', `/api/bank/urgent/${u.id}/approve`, r => r.status === 'broadcast' ? `Broadcast to ${r.alerted} donors within ${r.radius_km} km` : 'No eligible donors within 50 km')
    if (kind === 'stock') post('u', `/api/bank/urgent/${u.id}/fulfil-stock`, r => `Issued ${r.units} unit(s) of ${r.issued_group}`)
    if (kind === 'cancel') post('u', `/api/bank/urgent/${u.id}/cancel`, 'Request closed', { note: 'Closed by staff' })
    if (kind === 'reroute') setReroute({ kind: 'urgent', id: u.id, blood_bank_id: q.other_banks[0]?.id, note: '' })
  }
  const rally = g => run('r' + g, () => api(`/api/bank/inventory/${encodeURIComponent(g)}/rally`, { method: 'POST' })).then(r => { if (r) { setRallied({ group: g, ...r }); reloadStock() } })
  const logOutcome = (row, outcome) => {
    const h = hb[row.key] || {}
    const body = { date: day, outcome, assignment_id: row.assignment_id, urgent_request_id: row.urgent_request_id, hemoglobin: h.hb ? Number(h.hb) : undefined, deferral_days: outcome === 'deferred' ? Number(h.days || 7) : undefined }
    post('l' + row.key, '/api/bank/log', r => r.promoted ? 'Logged – backup promoted' : r.urgent_request_id ? 'Logged – urgent request opened' : `Logged as ${outcome.replace('_', '-')}`, body)
  }

  return (
    <Shell title={q?.bank.name || 'Blood bank'} subtitle="Approve, re-route and close the loop on every request" tabs={tabs} tab={tab} onTab={setTab} onNotification={reloadAll}
      actions={<button className="btn" disabled={!!busy} onClick={() => post('tick', '/api/system/tick', r => `Scheduler ran · ${r.reminders_sent} reminders · ${r.escalated} escalations`)} title="Runs reminders & escalations now (also runs every minute)"><Play size={15} /> <span className="hide-sm">Run scheduler</span></button>}>
      {!q ? <Loading /> : (
        <>
          {tab === 'queue' && (
            <div className="col" style={{ gap: 18 }}>
              <div className="grid g4">
                <Kpi i={0} icon={Siren} label="Open urgent" value={urgentOpen.length} tone="crit" />
                <Kpi i={1} icon={Inbox} label="Awaiting approval" value={awaiting.length} tone="warn" />
                <Kpi i={2} icon={CalendarCheck} label="Planned (30 days)" value={q.planned.length} tone="info" />
                <Kpi i={3} icon={Droplets} label="Stock alerts" value={q.stock_alerts.length} tone="violet" />
              </div>
              <div className="section-title">Urgent requests</div>
              {q.urgent.length === 0 ? <Card><Empty icon={ShieldCheck} title="No urgent requests" /></Card> : q.urgent.map(u => <UrgentCard key={u.id} u={u} busy={busy} banks={q.other_banks} onAction={onUrgent} />)}
              <div className="section-title">Planned transfusions</div>
              <Card>
                <div className="table-wrap">
                  <table className="t">
                    <thead><tr><th>Date</th><th>Patient</th><th>Confirmed donor</th><th>Backup</th><th>Coverage</th><th>Slot</th><th></th></tr></thead>
                    <tbody>
                      {q.planned.map(a => (
                        <tr key={a.id}>
                          <td className="mono"><b>{fmtDate(a.date)}</b><div className="tiny faint">{a.days_until === 0 ? 'today' : `in ${a.days_until}d`}</div></td>
                          <td><b>{a.patient.name}</b> <span className="blood">{a.patient.blood_group}</span><div className="tiny faint">{a.patient.hospital}</div></td>
                          <td><DonorCell d={a.confirmed} />{a.confirmed && <div className="mt8"><Status s={a.confirmed.status} /></div>}</td>
                          <td><DonorCell d={a.backup} /></td>
                          <td><Status s={a.coverage} /></td>
                          <td><Status s={a.status} /></td>
                          <td>
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              {a.status === 'awaiting_bank' && <button className="btn ok sm" disabled={!!busy} onClick={() => post('a' + a.id, `/api/bank/appointments/${a.id}/approve`, 'Slot approved', { note: '' })}>Approve</button>}
                              <button className="btn sm" disabled={!!busy} onClick={() => setReroute({ kind: 'appt', id: a.id, blood_bank_id: q.other_banks[0]?.id, note: '' })}><ArrowRightLeft size={13} /></button>
                              {a.days_until <= 0 && <button className="btn primary sm" disabled={!!busy} onClick={() => post('c' + a.id, `/api/bank/appointments/${a.id}/complete`, r => `Transfusion done · next cycle ${fmtDate(r.next_date)}`)}>Done</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {tab === 'log' && (
            <Card>
              <CardTitle icon={ClipboardList} title="Daily screening log" sub="Record the final health-screening outcome for every booked donor"
                right={<input className="input" type="date" style={{ width: 170 }} value={day} max={today()} onChange={e => setDay(e.target.value)} />} />
              {log && (
                <>
                  <div className="row wrap" style={{ marginBottom: 14 }}>
                    <Badge tone="ok">{log.counts.donated} donated</Badge><Badge tone="warn">{log.counts.deferred} deferred</Badge><Badge tone="crit">{log.counts.no_show} no-show</Badge><Badge tone="info">{log.counts.excused} excused</Badge>
                    <span className="faint">Min Hb {log.min_hemoglobin} g/dL</span>
                  </div>
                  {log.rows.length === 0 ? <Empty icon={CalendarCheck} title="No donors booked for this day" /> : (
                    <div className="table-wrap">
                      <table className="t">
                        <thead><tr><th>Donor</th><th>For</th><th>Slot</th><th>Hb (g/dL)</th><th>Outcome</th></tr></thead>
                        <tbody>
                          {log.rows.map(r => (
                            <tr key={r.key}>
                              <td><DonorCell d={r.donor} /></td>
                              <td><b>{r.patient}</b></td>
                              <td><Badge tone={r.slot === 'confirmed' ? 'rose' : r.slot === 'urgent' ? 'crit' : 'violet'}>{r.slot}</Badge> <Status s={r.status} /></td>
                              <td>{r.logged ? <span className="mono">{r.logged.hemoglobin ?? '—'}</span> : <input className="input" style={{ width: 84 }} inputMode="decimal" placeholder="13.2" value={hb[r.key]?.hb || ''} onChange={e => setHb(x => ({ ...x, [r.key]: { ...x[r.key], hb: e.target.value } }))} />}</td>
                              <td>
                                {r.logged ? <Status s={r.logged.outcome} /> : r.status === 'released' ? <span className="faint">released</span> : (
                                  <div className="row wrap" style={{ gap: 6 }}>
                                    <button className="btn ok sm" disabled={!!busy} onClick={() => logOutcome(r, 'donated')}>Donated</button>
                                    <span className="row" style={{ gap: 4 }}>
                                      <button className="btn sm" disabled={!!busy} onClick={() => logOutcome(r, 'deferred')}>Deferred</button>
                                      <input className="input" style={{ width: 60, padding: '6px 8px' }} title="Deferral days" placeholder="7d" value={hb[r.key]?.days || ''} onChange={e => setHb(x => ({ ...x, [r.key]: { ...x[r.key], days: e.target.value } }))} />
                                    </span>
                                    <button className="btn sm" disabled={!!busy} onClick={() => logOutcome(r, 'no_show')}>No-show</button>
                                    <button className="btn ghost sm" disabled={!!busy} onClick={() => logOutcome(r, 'excused')}>Excused</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="faint mt16">Donated → donor's 90/120-day clock restarts and stock +1. Deferred → donor paused for N days. Deferred / no-show on a confirmed slot automatically promotes the backup or opens an urgent request.</div>
                </>
              )}
            </Card>
          )}

          {tab === 'stock' && stock && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <Card>
                <CardTitle icon={Droplets} title="Live inventory" sub="Tap a group to update · dashed line = safety minimum" />
                <StockTubes stock={stock.stock} onSelect={s => setEdit({ ...s })} />
                <div className="row wrap mt16" style={{ gap: 12 }}><Badge tone="ok" dot>Healthy</Badge><Badge tone="warn" dot>Low (&lt; minimum or &lt; 5 days)</Badge><Badge tone="crit" dot>Critical (≤ 50% or &lt; 2 days)</Badge></div>
              </Card>
              <Card i={1}>
                <CardTitle icon={Siren} title="Shortage alerts" sub="Rally notifies eligible, verified donors of that group within 15 km" />
                <StockAlerts alerts={stock.alerts} onRally={rally} busy={busy?.slice(1)} />
              </Card>
            </div>
          )}

          {tab === 'donors' && (
            <Card>
              <CardTitle icon={Users} title="Donor directory" sub="Full contact details – every view is written to the privacy audit log" />
              <div className="row wrap" style={{ marginBottom: 14 }}>
                <div className="row grow" style={{ position: 'relative', minWidth: 200 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-3)' }} />
                  <input className="input" style={{ paddingLeft: 36 }} placeholder="Search name, phone or area" value={search.q} onChange={e => setSearch(s => ({ ...s, q: e.target.value }))} />
                </div>
                <select className="input" style={{ width: 120 }} value={search.group} onChange={e => setSearch(s => ({ ...s, group: e.target.value }))}>
                  <option value="">All groups</option>{['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              {!donors ? <Loading /> : (
                <div className="table-wrap">
                  <table className="t">
                    <thead><tr><th>Donor</th><th>Group</th><th>Area</th><th>Last donated</th><th>Eligibility today</th><th>Verified</th></tr></thead>
                    <tbody>
                      {donors.map(d => (
                        <tr key={d.id}>
                          <td><DonorCell d={d} /><div className="tiny faint">{d.sex} · {d.age}y · {d.weight_kg}kg{d.circles.length ? ` · circle: ${d.circles.join(', ')}` : ''}</div></td>
                          <td><span className="blood">{d.blood_group}</span></td>
                          <td className="small">{d.area}</td>
                          <td className="mono small">{fmtDate(d.last_donation_date)}</td>
                          <td>{d.eligibility.eligible ? <Badge tone="ok" dot>Eligible</Badge> : <div className="tiny" style={{ color: 'var(--warn)', maxWidth: 240 }}>{d.eligibility.reasons.join(' · ')}</div>}</td>
                          <td>{d.verified ? <Badge tone="info"><ShieldCheck size={11} /> Verified</Badge> : <button className="btn sm" disabled={!!busy} onClick={() => run('v', () => api(`/api/bank/donors/${d.id}/verify`, { method: 'POST', body: { verified: true } }), 'Donor verified').then(reloadDonors)}>Verify</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'audit' && (
            <Card>
              <CardTitle icon={FileLock2} title="Privacy audit trail" sub="Who viewed donor contact details, and when" right={<button className="btn sm" onClick={reloadAudit}><Activity size={14} /> Refresh</button>} />
              {!audit ? <Loading /> : (
                <div className="list">
                  {audit.map((a, i) => (
                    <div key={i} className="list-row"><Avatar name={a.who || '?'} /><div className="grow"><b>{a.who}</b> <span className="muted">{a.action.replace(/_/g, ' ')}</span><div className="faint">{a.target}</div></div><span className="faint">{timeAgo(a.when)}</span></div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={!!reroute} onClose={() => setReroute(null)} title="Re-route request">
        {reroute && (
          <div className="col">
            <div className="field"><label>Send to</label>
              <select className="input" value={reroute.blood_bank_id} onChange={e => setReroute(r => ({ ...r, blood_bank_id: Number(e.target.value) }))}>
                {q.other_banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div className="field"><label>Note for the receiving bank & family</label><input className="input" value={reroute.note} onChange={e => setReroute(r => ({ ...r, note: e.target.value }))} placeholder="e.g. O- stock out here; Lakeside has 11 units" /></div>
            <button className="btn primary" disabled={!!busy} onClick={async () => {
              const path = reroute.kind === 'urgent' ? `/api/bank/urgent/${reroute.id}/reroute` : `/api/bank/appointments/${reroute.id}/reroute`
              const r = await post('rr', path, 'Request re-routed', { blood_bank_id: reroute.blood_bank_id, note: reroute.note })
              if (r) setReroute(null)
            }}><ArrowRightLeft size={15} /> Re-route</button>
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Update ${edit.blood_group} stock` : ''}>
        {edit && (
          <div className="col">
            <div className="grid g3">
              <div className="field"><label>Units</label><input className="input" type="number" min={0} value={edit.units} onChange={e => setEdit(x => ({ ...x, units: e.target.value }))} /></div>
              <div className="field"><label>Minimum</label><input className="input" type="number" min={0} value={edit.min_threshold} onChange={e => setEdit(x => ({ ...x, min_threshold: e.target.value }))} /></div>
              <div className="field"><label>Use / day</label><input className="input" type="number" step="0.1" min={0} value={edit.daily_usage} onChange={e => setEdit(x => ({ ...x, daily_usage: e.target.value }))} /></div>
            </div>
            <button className="btn primary" disabled={!!busy} onClick={async () => {
              const r = await run('s', () => api(`/api/bank/inventory/${encodeURIComponent(edit.blood_group)}`, { method: 'PUT', body: { units: Number(edit.units), min_threshold: Number(edit.min_threshold), daily_usage: Number(edit.daily_usage) } }), s => `${s.blood_group} is now ${s.status}`)
              if (r) { setEdit(null); reloadStock(); reloadQ() }
            }}>Save</button>
          </div>
        )}
      </Modal>

      <Modal open={!!rallied} onClose={() => setRallied(null)} title={rallied ? `Rallied ${rallied.contacted} ${rallied.group} donors` : ''}>
        {rallied && (rallied.contacted === 0 ? <Empty icon={Megaphone} title="No eligible donors within 15 km right now" /> : (
          <div className="list">
            {rallied.donors.map(d => <div key={d.donor_id} className="list-row"><Avatar name={d.name} /><div className="grow"><b>{d.name}</b><div className="faint">{d.phone}</div></div><span className="mono small">{d.distance}</span></div>)}
          </div>
        ))}
      </Modal>
    </Shell>
  )
}
