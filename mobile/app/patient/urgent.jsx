import { useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import UrgentSheet, { UrgentButton } from '../../components/UrgentSheet'
import { BloodTag, Button, Card, CardTitle, Empty, Loading, ProgressBar, Row, Screen, Status, T, useAction } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { usePatient } from '../../lib/usePatient'
import { useTheme } from '../../lib/theme'

const STEPS = ['Circle alerted', 'Nearby donors', 'Donor confirmed']

function Progress({ u }) {
  const t = useTheme()
  const done = ['filled', 'stock_fulfilled'].includes(u.status)
  const idx = done ? 2 : u.status === 'broadcast' ? 1 : 0
  return (
    <View style={{ gap: 10 }}>
      <Row between><Row gap={8}><BloodTag group={u.blood_group} /><T weight="800">{u.units} unit(s) by {fmtDate(u.needed_by)}</T></Row><Status s={u.status} /></Row>
      <T faint size={13}>{u.reason} · routed to {u.blood_bank}</T>
      <Row gap={6}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 6 }}>
            <ProgressBar pct={i <= idx ? 100 : 0} color={done ? t.ok : undefined} height={6} />
            <T size={11} weight="700" color={i <= idx ? t.text : t.text3}>{s}</T>
          </View>
        ))}
      </Row>
      <T muted size={13}>
        {u.alerted.circle} circle member(s) and {u.alerted.nearby} nearby donor(s) alerted{u.radius_km ? ` within ${u.radius_km} km` : ''}.
        {u.filled_by ? ` ${u.filled_by.display_name} accepted${u.filled_by.distance ? ` (${u.filled_by.distance} away)` : ''}.` : ''}
        {u.status === 'stock_fulfilled' ? ` ${u.staff_note}.` : ''}
      </T>
    </View>
  )
}

export default function Urgent() {
  const { p, reload, refresh, refreshing, error } = usePatient()
  const [open, setOpen] = useState(false)
  const [busy, run] = useAction()
  const submit = async f => {
    const r = await run('u', () => api(`/api/family/patients/${p.id}/urgent`, { method: 'POST', body: f }), 'Urgent request sent to the blood bank')
    if (r) { setOpen(false); reload() }
  }
  return (
    <Screen title="Urgent help" subtitle="Circle first, then verified donors nearby" right={p && <UrgentButton onPress={() => setOpen(true)} />} refreshing={refreshing} onRefresh={refresh}>
      {!p ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card>
            <CardTitle icon="alert-octagon" title="Your requests" />
            {p.urgent.length === 0 ? (
              <>
                <Empty icon="shield" title="No urgent requests" sub="Use this if a donor cancels last-minute or a transfusion is needed early." />
                <Button variant="danger" icon="alert-octagon" title="Request urgent help" onPress={() => setOpen(true)} />
              </>
            ) : <View style={{ gap: 22 }}>{p.urgent.map(u => <Progress key={u.id} u={u} />)}</View>}
          </Card>
          <Card i={1}>
            <CardTitle icon="info" title="What happens when you press it" />
            {[['1 · Blood bank is alerted', `Your request lands in ${p.blood_bank}'s queue immediately.`],
              ['2 · Your circle first', 'Every eligible circle member gets an urgent alert.'],
              ['3 · Nearby verified donors', 'If unfilled, compatible donors are alerted ring by ring – 5, 10, 25, 50 km – closest first.'],
              ['4 · First to accept is confirmed', "Everyone else is told it's filled. The blood bank calls the donor."]].map(([h, d], i) => (
              <Animated.View key={h} entering={FadeInDown.delay(i * 80)} style={{ marginBottom: 12 }}><T weight="700" size={14}>{h}</T><T faint size={13}>{d}</T></Animated.View>
            ))}
          </Card>
        </>
      )}
      <UrgentSheet open={open} onClose={() => setOpen(false)} busy={busy === 'u'} destination={p?.blood_bank} onSubmit={submit} />
    </Screen>
  )
}
