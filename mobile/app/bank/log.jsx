import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import DonorLine from '../../components/DonorLine'
import { Badge, Banner, Button, Card, Empty, Loading, Row, Screen, Status, T, tap, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtLong, todayIso } from '../../lib/format'
import { useTheme } from '../../lib/theme'

const shift = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

function LogRow({ r, day, busy, onLog, i }) {
  const t = useTheme()
  const [hb, setHb] = useState('')
  const [days, setDays] = useState('7')
  return (
    <Card i={i} style={{ gap: 12 }}>
      <DonorLine d={r.donor} sub={`For ${r.patient}`} right={<Badge tone={r.slot === 'confirmed' ? 'rose' : r.slot === 'urgent' ? 'crit' : 'violet'}>{r.slot}</Badge>} />
      {r.logged ? (
        <Row between><Status s={r.logged.outcome} />{r.logged.hemoglobin != null && <T faint size={13}>Hb {r.logged.hemoglobin} g/dL</T>}</Row>
      ) : r.status === 'released' ? <T faint>Released (donated elsewhere)</T> : (
        <>
          <Row gap={10}>
            <View style={{ flex: 1 }}><T faint size={12} weight="700">HAEMOGLOBIN (g/dL)</T>
              <TextInput value={hb} onChangeText={setHb} keyboardType="decimal-pad" placeholder="13.2" placeholderTextColor={t.text3}
                style={{ borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: t.text, fontSize: 16, marginTop: 4 }} /></View>
            <View style={{ width: 110 }}><T faint size={12} weight="700">DEFER (DAYS)</T>
              <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" placeholderTextColor={t.text3}
                style={{ borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: t.text, fontSize: 16, marginTop: 4 }} /></View>
          </Row>
          <Row gap={8}>
            <Button small variant="ok" title="Donated" style={{ flex: 1.3 }} disabled={!!busy} onPress={() => onLog(r, 'donated', hb, days)} />
            <Button small title="Deferred" style={{ flex: 1 }} disabled={!!busy} onPress={() => onLog(r, 'deferred', hb, days)} />
          </Row>
          <Row gap={8}>
            <Button small title="No-show" style={{ flex: 1 }} disabled={!!busy} onPress={() => onLog(r, 'no_show', hb, days)} />
            <Button small variant="ghost" title="Excused" style={{ flex: 1 }} disabled={!!busy} onPress={() => onLog(r, 'excused', hb, days)} />
          </Row>
        </>
      )}
    </Card>
  )
}

export default function DailyLog() {
  const t = useTheme()
  const [day, setDay] = useState(todayIso())
  const { data, reload, refresh, refreshing, error } = useData(`/api/bank/log?day=${day}`)
  const [busy, run] = useAction()
  const onLog = (r, outcome, hb, days) => run('l', () => api('/api/bank/log', { method: 'POST', body: {
    date: day, outcome, assignment_id: r.assignment_id, urgent_request_id: r.urgent_request_id,
    hemoglobin: hb ? Number(hb) : undefined, deferral_days: outcome === 'deferred' ? Number(days || 7) : undefined,
  } }), res => (res.promoted ? 'Logged – backup promoted' : res.urgent_request_id ? 'Logged – urgent request opened' : `Logged as ${outcome.replace('_', '-')}`)).then(reload)
  const isToday = day === todayIso()
  return (
    <Screen title="Daily log" subtitle="Final health-screening outcome for every booked donor" refreshing={refreshing} onRefresh={refresh}>
      <Card style={{ padding: 10 }}>
        <Row between>
          <Pressable hitSlop={10} onPress={() => { tap(); setDay(d => shift(d, -1)) }} style={{ padding: 8 }}><Feather name="chevron-left" size={22} color={t.text} /></Pressable>
          <View style={{ alignItems: 'center' }}><T weight="800">{fmtLong(day)}</T><T faint size={12}>{isToday ? 'Today' : 'Past day'}</T></View>
          <Pressable hitSlop={10} disabled={isToday} onPress={() => { tap(); setDay(d => shift(d, 1)) }} style={{ padding: 8, opacity: isToday ? 0.3 : 1 }}><Feather name="chevron-right" size={22} color={t.text} /></Pressable>
        </Row>
      </Card>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Row wrap gap={6}>
            <Badge tone="ok">{data.counts.donated} donated</Badge><Badge tone="warn">{data.counts.deferred} deferred</Badge>
            <Badge tone="crit">{data.counts.no_show} no-show</Badge><Badge tone="info">{data.counts.excused} excused</Badge><Badge>min Hb {data.min_hemoglobin}</Badge>
          </Row>
          {data.rows.length === 0 ? <Card><Empty icon="clipboard" title="No donors booked for this day" /></Card>
            : data.rows.map((r, i) => <LogRow key={r.key} r={r} i={i} day={day} busy={busy} onLog={onLog} />)}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Banner tone="info">Donated → stock +1 and the donor’s 90/120-day clock restarts. Deferred/no-show on a confirmed slot promotes the backup or opens an urgent request.</Banner>
          </Animated.View>
        </>
      )}
    </Screen>
  )
}
