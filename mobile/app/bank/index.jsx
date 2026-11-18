import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import DonorLine from '../../components/DonorLine'
import Radar from '../../components/Radar'
import { AnimatedNumber, Badge, Banner, BloodTag, Button, Card, Choice, Divider, Empty, Input, Loading, Row, Screen, SectionTitle, Sheet, Status, T, tap, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, timeAgo } from '../../lib/format'
import { useTheme } from '../../lib/theme'

function Kpi({ label, value, tone, icon, i }) {
  const t = useTheme()
  const c = { crit: [t.critSoft, t.crit], warn: [t.warnSoft, t.warn], info: [t.infoSoft, t.info], violet: [t.violetSoft, t.violet] }[tone]
  return (
    <Card i={i} style={{ flex: 1, padding: 14, gap: 4 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c[0], alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={15} color={c[1]} /></View>
      <AnimatedNumber value={value} style={{ fontSize: 28, fontWeight: '900', color: t.text }} />
      <T faint size={11.5} weight="600" numberOfLines={1}>{label}</T>
    </Card>
  )
}

function UrgentCard({ u, i, busy, onAction, canReroute }) {
  const [showAll, setShowAll] = useState(false)
  const open = ['circle', 'broadcast', 'no_match'].includes(u.status)
  const alerts = showAll ? u.alerts : u.alerts.slice(0, 4)
  return (
    <Card i={i} tone={open ? 'crit' : undefined} style={{ gap: 12 }}>
      <Row between style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={8} wrap><T weight="900" size={17}>{u.patient.name}</T><BloodTag group={u.blood_group} /></Row>
          <T faint size={12.5}>{u.units} unit(s) by {fmtDate(u.needed_by)} · {timeAgo(u.created_at)}</T>
        </View>
        <Status s={u.status} />
      </Row>
      <T muted size={13}>{u.reason}{u.staff_note ? ` · ${u.staff_note}` : ''}</T>
      <Row wrap gap={6}>
        <Badge tone="violet">{u.stage === 1 ? 'Stage 1 · circle' : `Stage ${u.stage} · ${u.radius_km} km ring`}</Badge>
        <Badge>{u.alerted.circle} circle</Badge><Badge>{u.alerted.nearby} nearby</Badge>
        {u.alerted.declined > 0 && <Badge tone="warn">{u.alerted.declined} declined</Badge>}
        <Badge>{u.source.replace('_', ' ')}</Badge>
      </Row>
      {u.alerts.length > 0 && <Radar alerts={u.alerts} radius={u.radius_km || 5} size={220} />}
      {u.filled_by && <Banner tone="ok" title={`${u.filled_by.name} accepted`}>{`${u.filled_by.distance || ''} · call ${u.filled_by.phone} to book the slot`}</Banner>}
      {alerts.map(a => (
        <DonorLine key={a.alert_id} d={a} sub={`${a.in_circle ? 'Circle' : `Ring ${a.stage}`} · ${a.distance}`} right={<Status s={a.status} />} />
      ))}
      {u.alerts.length > 4 && <Button small variant="ghost" title={showAll ? 'Show less' : `Show all ${u.alerts.length} alerted donors`} onPress={() => setShowAll(s => !s)} />}
      {u.alerts.length === 0 && <T faint size={13}>No donors alerted yet.</T>}
      {open && (
        <View style={{ gap: 8 }}>
          {u.status !== 'no_match' && <Button variant="primary" icon="radio" title={u.stage === 1 ? 'Approve & broadcast nearby' : 'Widen radius'} loading={busy === 'approve' + u.id} disabled={!!busy} onPress={() => onAction('approve', u)} />}
          <Row gap={8}>
            <Button small icon="package" title="From stock" style={{ flex: 1 }} disabled={!!busy} onPress={() => onAction('stock', u)} />
            {canReroute && <Button small icon="shuffle" title="Re-route" style={{ flex: 1 }} disabled={!!busy} onPress={() => onAction('reroute', u)} />}
            <Button small variant="ghost" icon="x-circle" title="Close" disabled={!!busy} onPress={() => onAction('cancel', u)} />
          </Row>
        </View>
      )}
    </Card>
  )
}

export default function BankQueue() {
  const t = useTheme()
  const { data: q, reload, refresh, refreshing, error } = useData('/api/bank/queue')
  const [busy, run] = useAction()
  const [reroute, setReroute] = useState(null)
  const post = (key, path, msg, body) => run(key, () => api(path, { method: 'POST', body }), msg).then(r => { reload(); return r })

  const urgentOpen = q?.urgent.filter(u => ['circle', 'broadcast', 'no_match'].includes(u.status)) || []
  const awaiting = q?.planned.filter(p => p.status === 'awaiting_bank') || []
  const onUrgent = (kind, u) => {
    if (kind === 'approve') post('approve' + u.id, `/api/bank/urgent/${u.id}/approve`, r => (r.status === 'broadcast' ? `Broadcast to ${r.alerted} donors within ${r.radius_km} km` : 'No eligible donors within 50 km'))
    if (kind === 'stock') post('s', `/api/bank/urgent/${u.id}/fulfil-stock`, r => `Issued ${r.units} unit(s) of ${r.issued_group}`)
    if (kind === 'cancel') post('c', `/api/bank/urgent/${u.id}/cancel`, 'Request closed', { note: 'Closed by staff' })
    if (kind === 'reroute') setReroute({ kind: 'urgent', id: u.id, blood_bank_id: q.other_banks[0]?.id, note: '' })
  }

  return (
    <Screen title={q?.bank.name || 'Blood bank'} subtitle="Approve, re-route and close the loop" refreshing={refreshing} onRefresh={refresh}
      right={<Pressable onPress={() => { tap(); post('tick', '/api/system/tick', r => `Scheduler ran · ${r.reminders_sent} reminders · ${r.escalated} escalations`) }} accessibilityLabel="Run scheduler now"
        style={{ width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Feather name="play" size={17} color={t.text} /></Pressable>}>
      {!q ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Row gap={10}>
            <Kpi i={0} icon="alert-octagon" label="Open urgent" value={urgentOpen.length} tone="crit" />
            <Kpi i={1} icon="inbox" label="To approve" value={awaiting.length} tone="warn" />
            <Kpi i={2} icon="droplet" label="Stock alerts" value={q.stock_alerts.length} tone="violet" />
          </Row>
          <SectionTitle>Urgent requests</SectionTitle>
          {q.urgent.length === 0 ? <Card><Empty icon="shield" title="No urgent requests" /></Card>
            : q.urgent.map((u, i) => <UrgentCard key={u.id} u={u} i={i} busy={busy} onAction={onUrgent} canReroute={q.other_banks.length > 0} />)}
          <SectionTitle>Planned transfusions</SectionTitle>
          {q.planned.map((a, i) => (
            <Card key={a.id} i={i} style={{ gap: 12 }}>
              <Row between>
                <Row gap={10} style={{ flex: 1 }}>
                  <View style={{ width: 64, paddingVertical: 6, borderRadius: 12, backgroundColor: t.primarySoft, alignItems: 'center' }}>
                    <T weight="900" size={15} color={t.primary}>{fmtDate(a.date)}</T>
                    <T size={10.5} weight="700" color={t.primary}>{a.days_until === 0 ? 'today' : `in ${a.days_until}d`}</T>
                  </View>
                  <View style={{ flex: 1 }}><Row gap={6}><T weight="800">{a.patient.name}</T><BloodTag group={a.patient.blood_group} /></Row><T faint size={12}>{a.patient.hospital}</T></View>
                </Row>
              </Row>
              <Row wrap gap={6}><Status s={a.coverage} /><Status s={a.status} /></Row>
              <View style={{ gap: 10 }}>
                <DonorLine d={a.confirmed} sub="Confirmed donor" right={a.confirmed && <Status s={a.confirmed.status} />} />
                {a.backup ? <DonorLine d={a.backup} sub="Backup" right={<Status s={a.backup.status} />} /> : <T faint size={12.5}>No backup donor</T>}
              </View>
              <Divider />
              <Row gap={8}>
                {a.status === 'awaiting_bank' && <Button small variant="ok" icon="check" title="Approve slot" style={{ flex: 1 }} loading={busy === 'ap' + a.id} disabled={!!busy} onPress={() => post('ap' + a.id, `/api/bank/appointments/${a.id}/approve`, 'Slot approved', { note: '' })} />}
                {a.days_until <= 0 && <Button small variant="primary" icon="check-circle" title="Transfusion done" style={{ flex: 1 }} loading={busy === 'd' + a.id} disabled={!!busy} onPress={() => post('d' + a.id, `/api/bank/appointments/${a.id}/complete`, r => `Done · next cycle ${fmtDate(r.next_date)}`)} />}
                <Button small icon="shuffle" disabled={!!busy} onPress={() => setReroute({ kind: 'appt', id: a.id, blood_bank_id: q.other_banks[0]?.id, note: '' })} />
              </Row>
            </Card>
          ))}
        </>
      )}
      <Sheet open={!!reroute} onClose={() => setReroute(null)} title="Re-route request">
        {reroute && (
          <>
            <Choice label="Send to" options={q.other_banks.map(b => ({ value: b.id, label: b.name }))} value={reroute.blood_bank_id} onChange={v => setReroute(r => ({ ...r, blood_bank_id: v }))} />
            <Input label="Note for the receiving bank & family" placeholder="e.g. O- stock out here" value={reroute.note} onChangeText={note => setReroute(r => ({ ...r, note }))} />
            <Button variant="primary" icon="shuffle" title="Re-route" loading={busy === 'rr'} onPress={async () => {
              const path = reroute.kind === 'urgent' ? `/api/bank/urgent/${reroute.id}/reroute` : `/api/bank/appointments/${reroute.id}/reroute`
              const r = await post('rr', path, 'Request re-routed', { blood_bank_id: reroute.blood_bank_id, note: reroute.note })
              if (r) setReroute(null)
            }} />
          </>
        )}
      </Sheet>
    </Screen>
  )
}
