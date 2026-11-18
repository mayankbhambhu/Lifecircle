import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import UrgentSheet from '../../components/UrgentSheet'
import { Avatar, Banner, BloodTag, Button, Card, Divider, Loading, Row, Screen, Status, T, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useTheme } from '../../lib/theme'

export default function HospitalPatients() {
  const t = useTheme()
  const { data, reload, refresh, refreshing, error } = useData('/api/hospital/overview')
  const [busy, run] = useAction()
  const [req, setReq] = useState(null)
  const attention = data?.patients.filter(p => ['uncovered', 'awaiting_donor'].includes(p.next.coverage)).length || 0
  return (
    <Screen title={data?.hospital.name || 'Hospital'} subtitle={data ? `${data.patients.length} patients · ${attention} need attention · ${data.blood_bank.name}` : ''} refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          {data.stock_alerts.length > 0 && (
            <Banner tone="warn" icon="droplet" title={`${data.blood_bank.name} is short on ${data.stock_alerts.map(a => a.blood_group).join(', ')}`}
              onPress={() => router.navigate('/hospital/stock')} right={<Feather name="chevron-right" size={18} color={t.warn} />}>
              Plan transfusions for these groups with the blood bank.
            </Banner>
          )}
          {data.patients.map((p, i) => (
            <Card key={p.id} i={i} style={{ gap: 12 }}>
              <Row>
                <Avatar name={p.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Row gap={6}><T weight="800" size={16}>{p.name}</T><BloodTag group={p.blood_group} /></Row>
                  <T faint size={12.5}>{p.condition} · every {p.cycle_days} days</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T weight="900" size={17}>{fmtDate(p.next.date)}</T>
                  <T faint size={12}>{p.next.days_until <= 0 ? 'today' : `in ${p.next.days_until} days`}</T>
                </View>
              </Row>
              <Divider />
              <Row between>
                <View style={{ gap: 3 }}>
                  <T faint size={12}>Confirmed · Backup</T>
                  <T weight="700">{p.next.confirmed?.display_name || '—'} · {p.next.backup?.display_name || '—'}</T>
                </View>
                <Status s={p.next.coverage} />
              </Row>
              <Row gap={8}>
                {p.next.days_until <= 0 && <Button small variant="primary" icon="check-circle" title="Transfused" style={{ flex: 1 }} loading={busy === 'd' + p.id}
                  onPress={() => run('d' + p.id, () => api(`/api/hospital/appointments/${p.next.id}/complete`, { method: 'POST' }), r => `Done · next ${fmtDate(r.next_date)}`).then(reload)} />}
                <Button small variant="danger" icon="alert-octagon" title="Urgent request" style={{ flex: 1 }} onPress={() => setReq(p)} />
              </Row>
            </Card>
          ))}
          <T faint size={12.5} center>Donor contact details are handled by the blood bank and are not shown to hospital staff.</T>
        </>
      )}
      <UrgentSheet open={!!req} onClose={() => setReq(null)} busy={busy === 'u'} destination={data?.blood_bank.name} defaultDate={req?.next.date} placeholder="e.g. Pre-transfusion Hb 6.1 g/dL"
        onSubmit={async f => {
          const r = await run('u', () => api(`/api/hospital/patients/${req.id}/urgent`, { method: 'POST', body: f }), 'Urgent request raised with the blood bank')
          if (r) { setReq(null); reload(); router.navigate('/hospital/urgent') }
        }} />
    </Screen>
  )
}
