import { Feather } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Share, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Countdown from '../../components/Countdown'
import UrgentSheet, { UrgentButton } from '../../components/UrgentSheet'
import { Avatar, Banner, Button, Card, CardTitle, Choice, Loading, Row, Screen, T, tap, useAction } from '../../components/ui'
import { api } from '../../lib/api'
import { firstName, fmtDate, fmtLong } from '../../lib/format'
import { usePatient } from '../../lib/usePatient'
import { radius, shadow, useTheme } from '../../lib/theme'

function DonorSlot({ label, d }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>{label}</Text>
      {d ? (
        <Row gap={8} style={{ marginTop: 8 }}>
          <Avatar name={d.display_name} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{d.display_name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5 }} numberOfLines={1}>{d.status === 'attending' ? 'Confirmed ✓' : 'Awaiting reply'}{d.source === 'promoted' ? ' · promoted' : d.source === 'urgent' ? ' · urgent' : ''}</Text>
          </View>
        </Row>
      ) : <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 10, fontSize: 13 }}>Not assigned yet</Text>}
    </View>
  )
}

export default function PatientHome() {
  const t = useTheme()
  const { p, patients, idx, setIdx, reload, refresh, refreshing, error } = usePatient()
  const [busy, run] = useAction()
  const [urgentOpen, setUrgentOpen] = useState(false)
  const [draft, setDraft] = useState(null) // unsaved edits; falls back to the server value
  const cycle = p ? (draft?.id === p.id ? draft : { id: p.id, cycle_days: p.cycle_days, units: p.units_per_transfusion }) : null
  const setCycle = fn => setDraft(fn(cycle))

  const active = p?.urgent?.filter(u => ['circle', 'broadcast', 'no_match'].includes(u.status)) || []
  const next = p?.next
  const sendUrgent = async f => {
    const r = await run('urgent', () => api(`/api/family/patients/${p.id}/urgent`, { method: 'POST', body: f }), 'Urgent request sent to the blood bank')
    if (r) { setUrgentOpen(false); reload(); router.navigate('/patient/urgent') }
  }

  return (
    <Screen title={p ? `${firstName(p.name)}'s care plan` : 'Care plan'} subtitle={p ? `${p.condition} · ${p.blood_group} · ${p.hospital}` : ''}
      right={p && <UrgentButton onPress={() => setUrgentOpen(true)} />} refreshing={refreshing} onRefresh={refresh}>
      {!p ? <Loading error={error} onRetry={reload} /> : (
        <>
          {patients.length > 1 && <Choice options={patients.map((x, i) => ({ value: i, label: x.name }))} value={idx} onChange={setIdx} />}
          {active.length > 0 && (
            <Banner tone="crit" title="Urgent mode is active" onPress={() => router.navigate('/patient/urgent')} right={<Feather name="chevron-right" size={18} color={t.crit} />}>
              We’re finding a donor – the blood bank is watching.
            </Banner>
          )}

          <Animated.View entering={FadeInDown.springify().damping(16)} style={[{ borderRadius: radius.xl, overflow: 'hidden' }, shadow({ ...t, shadow: t.rose800 }, 2)]}>
            <LinearGradient colors={['#fb7185', '#e11d48', '#881337']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 20, gap: 16 }}>
              <Row between style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Row gap={6}><Feather name="calendar" size={14} color="rgba(255,255,255,0.9)" /><Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>NEXT TRANSFUSION</Text></Row>
                  <Text style={{ color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -1.5, marginTop: 6 }}>{fmtDate(next.date)}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{fmtLong(next.date)} · {next.units_needed} unit(s)</Text>
                </View>
                <Countdown days={next.days_until} cycle={p.cycle_days} />
              </Row>
              <Row wrap gap={6}>
                <View style={pill}><Feather name="repeat" size={11} color="#fff" /><Text style={pillText}>Every {p.cycle_days} days</Text></View>
                <View style={pill}><Feather name="shield" size={11} color="#fff" /><Text style={pillText}>{next.status === 'scheduled' ? 'Slot booked by blood bank' : 'Awaiting blood bank'}</Text></View>
              </Row>
              <Row gap={10} style={{ alignItems: 'stretch' }}>
                <DonorSlot label="CONFIRMED DONOR" d={next.confirmed} />
                <DonorSlot label="BACKUP DONOR" d={next.backup} />
              </Row>
            </LinearGradient>
          </Animated.View>

          <Card i={1}>
            <CardTitle icon="sliders" title="Transfusion cycle" sub="Changing it re-plans the next date" />
            {cycle && (
              <View style={{ gap: 14 }}>
                <Row between>
                  <T muted>Every</T>
                  <Row gap={14}>
                    <Pressable hitSlop={8} onPress={() => { tap(); setCycle(c => ({ ...c, cycle_days: Math.max(7, c.cycle_days - 1) })) }} style={[stepBtn, { borderColor: t.borderStrong }]}><Feather name="minus" size={18} color={t.text} /></Pressable>
                    <T weight="900" size={24} style={{ minWidth: 92, textAlign: 'center' }}>{cycle.cycle_days} days</T>
                    <Pressable hitSlop={8} onPress={() => { tap(); setCycle(c => ({ ...c, cycle_days: Math.min(90, c.cycle_days + 1) })) }} style={[stepBtn, { borderColor: t.borderStrong }]}><Feather name="plus" size={18} color={t.text} /></Pressable>
                  </Row>
                </Row>
                <Choice label="Units per transfusion" options={[1, 2, 3]} value={cycle.units} onChange={units => setCycle(c => ({ ...c, units }))} />
                <Button variant="primary" title="Save cycle" loading={busy === 'cycle'} disabled={cycle.cycle_days === p.cycle_days && cycle.units === p.units_per_transfusion}
                  onPress={() => run('cycle', () => api(`/api/family/patients/${p.id}/cycle`, { method: 'PUT', body: { cycle_days: cycle.cycle_days, units_per_transfusion: cycle.units } }), r => `Saved · next transfusion ${fmtDate(r.next_date)}`).then(() => { setDraft(null); reload() })} />
              </View>
            )}
          </Card>

          <Card i={2}>
            <CardTitle icon="user-plus" title="Grow your circle" sub="Share this code with relatives & friends" />
            <View style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.rose300, backgroundColor: t.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T weight="900" size={22} color={t.primary} style={{ letterSpacing: 2 }}>{p.invite_code}</T>
              <Row gap={6}>
                <Button small icon="copy" onPress={async () => { await Clipboard.setStringAsync(p.invite_code); run('c', async () => 1, 'Invite code copied') }} />
                <Button small icon="share-2" onPress={() => Share.share({ message: `Join ${firstName(p.name)}'s donor circle on LifeCircle with code ${p.invite_code}. You'll only be asked when you're eligible, and fairly.` })} />
              </Row>
            </View>
            <T faint size={13} style={{ marginTop: 12 }}>{p.circle.length} members · {p.circle.filter(c => c.eligibility.eligible).length} eligible for {fmtDate(next.date)}. More members = lighter load on everyone.</T>
          </Card>

          <Card i={3}>
            <CardTitle icon="clock" title="Recent transfusions" />
            {p.history.length === 0 ? <T faint>No history yet.</T> : p.history.slice(0, 4).map((h, i) => (
              <Row key={h.date} gap={12} style={{ paddingVertical: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.ok }} />
                  {i < Math.min(3, p.history.length - 1) && <View style={{ width: 2, height: 26, backgroundColor: t.border, position: 'absolute', top: 14 }} />}
                </View>
                <T weight="700" size={14}>{fmtDate(h.date)}</T>
                <T faint size={13} style={{ flex: 1 }} numberOfLines={1}>{h.donors.length ? h.donors.join(', ') : 'from bank stock'}</T>
              </Row>
            ))}
          </Card>
          <Banner tone="info" icon="lock">Donor phone numbers are never shown here. The blood bank coordinates every donation.</Banner>
        </>
      )}
      <UrgentSheet open={urgentOpen} onClose={() => setUrgentOpen(false)} busy={busy === 'urgent'} destination={p?.blood_bank} onSubmit={sendUrgent} />
    </Screen>
  )
}

const pill = { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.18)' }
const pillText = { color: '#fff', fontSize: 11.5, fontWeight: '700' }
const stepBtn = { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
