import { motion } from 'framer-motion'
import { BedDouble, Droplets, Lock, Siren, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { api, fmtDate, timeAgo } from '../api.js'
import Shell from '../components/Shell.jsx'
import { StockAlerts, StockTubes } from '../components/Stock.jsx'
import { Avatar, Badge, Card, CardTitle, Empty, Loading, Modal, Status, useAction } from '../components/ui.jsx'
import { useData, useTab } from '../hooks.js'

export default function HospitalApp() {
  const [tab, setTab] = useTab('patients')
  const [data, reload] = useData('/api/hospital/overview')
  const [busy, run] = useAction()
  const [req, setReq] = useState(null)

  const open = data?.urgent.filter(u => ['circle', 'broadcast', 'no_match'].includes(u.status)) || []
  const tabs = [
    { value: 'patients', label: 'Patients', icon: BedDouble },
    { value: 'stock', label: 'Blood stock', icon: Droplets, count: data?.stock_alerts.filter(a => a.status === 'critical').length || undefined },
    { value: 'urgent', label: 'Urgent', icon: Siren, count: open.length || undefined },
  ]
  const uncovered = data?.patients.filter(p => ['uncovered', 'awaiting_donor'].includes(p.next.coverage)) || []

  return (
    <Shell title={data?.hospital.name || 'Hospital'} subtitle={data ? `Linked blood bank: ${data.blood_bank.name}` : ''} tabs={tabs} tab={tab} onTab={setTab} onNotification={reload}>
      {!data ? <Loading /> : (
        <>
          {tab === 'patients' && (
            <div className="col" style={{ gap: 18 }}>
              {data.stock_alerts.length > 0 && (
                <motion.button className="banner warn" style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => setTab('stock')} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Droplets size={18} color="var(--warn)" />
                  <div className="grow"><b>{data.blood_bank.name} is short on {data.stock_alerts.map(a => a.blood_group).join(', ')}</b><div className="small">Plan transfusions for these groups with the blood bank.</div></div>
                </motion.button>
              )}
              <Card>
                <CardTitle icon={Stethoscope} title="Regular-transfusion patients" sub={`${data.patients.length} patients · ${uncovered.length} need attention`} />
                <div className="table-wrap">
                  <table className="t">
                    <thead><tr><th>Patient</th><th>Next transfusion</th><th>Confirmed</th><th>Backup</th><th>Coverage</th><th></th></tr></thead>
                    <tbody>
                      {data.patients.map((p, i) => (
                        <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                          <td><div className="row" style={{ gap: 10 }}><Avatar name={p.name} /><div><b>{p.name}</b> <span className="blood">{p.blood_group}</span><div className="tiny faint">{p.condition} · every {p.cycle_days}d</div></div></div></td>
                          <td className="mono"><b>{fmtDate(p.next.date)}</b><div className="tiny faint">{p.next.days_until <= 0 ? 'today' : `in ${p.next.days_until} days`}</div></td>
                          <td>{p.next.confirmed ? <div><b>{p.next.confirmed.display_name}</b><div><Status s={p.next.confirmed.status} /></div></div> : <span className="faint">—</span>}</td>
                          <td>{p.next.backup ? p.next.backup.display_name : <span className="faint">—</span>}</td>
                          <td><Status s={p.next.coverage} /></td>
                          <td>
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              {p.next.days_until <= 0 && <button className="btn primary sm" disabled={!!busy} onClick={() => run('d', () => api(`/api/hospital/appointments/${p.next.id}/complete`, { method: 'POST' }), r => `Done · next ${fmtDate(r.next_date)}`).then(reload)}>Transfused</button>}
                              <button className="btn danger sm" onClick={() => setReq({ patient: p, reason: '', units: 1, needed_by: p.next.date })}><Siren size={13} /> Urgent</button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="faint mt16 row"><Lock size={13} /> Donor contact details are handled by the blood bank and are not shown to hospital staff.</div>
              </Card>
            </div>
          )}

          {tab === 'stock' && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <Card><CardTitle icon={Droplets} title={`${data.blood_bank.name} – live stock`} sub="Read-only view for planning" /><StockTubes stock={data.stock} /></Card>
              <Card i={1}><CardTitle icon={Siren} title="Shortage alerts" /><StockAlerts alerts={data.stock_alerts} /></Card>
            </div>
          )}

          {tab === 'urgent' && (
            <Card>
              <CardTitle icon={Siren} title="Urgent requests for your patients" />
              {data.urgent.length === 0 ? <Empty title="No urgent requests" /> : (
                <div className="list">
                  {data.urgent.map(u => (
                    <div key={u.id} className="list-row wrap">
                      <span className="blood">{u.blood_group}</span>
                      <div className="grow"><b>{u.patient.name}</b> · {u.units} unit(s) by {fmtDate(u.needed_by)}<div className="faint">{u.reason} · {timeAgo(u.created_at)} · {u.alerted.circle + u.alerted.nearby} donors alerted{u.filled_by ? ` · filled by ${u.filled_by.display_name}` : ''}</div></div>
                      <Badge>{u.blood_bank}</Badge><Status s={u.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={!!req} onClose={() => setReq(null)} title={req ? `Urgent request · ${req.patient.name}` : ''}>
        {req && (
          <div className="col">
            <div className="field"><label>Clinical reason</label><textarea className="input" rows={3} value={req.reason} onChange={e => setReq(r => ({ ...r, reason: e.target.value }))} placeholder="e.g. Pre-transfusion Hb 6.1 g/dL" /></div>
            <div className="grid g2">
              <div className="field"><label>Needed by</label><input className="input" type="date" value={req.needed_by} onChange={e => setReq(r => ({ ...r, needed_by: e.target.value }))} /></div>
              <div className="field"><label>Units</label><select className="input" value={req.units} onChange={e => setReq(r => ({ ...r, units: Number(e.target.value) }))}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></div>
            </div>
            <button className="btn danger" disabled={!!busy || req.reason.length < 3} onClick={async () => {
              const r = await run('u', () => api(`/api/hospital/patients/${req.patient.id}/urgent`, { method: 'POST', body: { reason: req.reason, units: req.units, needed_by: req.needed_by } }), 'Urgent request raised with the blood bank')
              if (r) { setReq(null); reload(); setTab('urgent') }
            }}><Siren size={15} /> Raise urgent request</button>
          </div>
        )}
      </Modal>
    </Shell>
  )
}
