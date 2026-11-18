import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { AnimatedNumber, Avatar, Badge, Banner, BloodTag, Button, Card, CardTitle, Divider, Empty, Input, Loading, Row, Screen, Sheet, Status, T, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'
import { dayNum, firstName, fmtDate, monthShort } from '../../lib/format'
import { radius, shadow, useTheme } from '../../lib/theme'

export default function DonorHome() {
  const t = useTheme()
  const { data, reload, refresh, refreshing, error } = useData('/api/donor/overview')
  const [busy, run] = useAction()
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const post = (key, path, msg, body) => run(key, () => api(path, { method: 'POST', body }), msg).then(r => { reload(); return r })

  const live = data?.alerts.filter(a => a.status === 'sent' && ['circle', 'broadcast'].includes(a.request_status)) || []
  const e = data?.eligibility
  return (
    <Screen title={data ? `Hi ${firstName(data.profile.name)} 👋` : 'Donor'} subtitle={data ? `${data.profile.blood_group} donor · ${data.profile.area || 'location set'}` : ''} refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          {live.length > 0 && (
            <Banner tone="crit" title={`${live.length} urgent request${live.length > 1 ? 's' : ''} near you`} onPress={() => router.navigate('/donor/alerts')} right={<Feather name="chevron-right" size={18} color={t.crit} />}>
              {`Closest: ${live[0].blood_group} · ${live[0].distance} from you`}
            </Banner>
          )}

          <Animated.View entering={FadeInDown.springify().damping(16)} style={[{ borderRadius: radius.xl, overflow: 'hidden' }, shadow({ ...t, shadow: t.rose800 }, 2)]}>
            <LinearGradient colors={e.eligible ? ['#34d399', '#059669', '#064e3b'] : ['#fb7185', '#e11d48', '#881337']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 20, gap: 10 }}>
              <Row gap={6}><Feather name="droplet" size={14} color="#fff" /><Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ELIGIBILITY</Text></Row>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }}>{e.eligible ? 'Ready to donate' : e.next_eligible_date ? `From ${fmtDate(e.next_eligible_date)}` : 'Not eligible'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>{e.eligible ? 'All pre-checks pass. Final screening happens at the blood bank.' : e.reasons.join(' · ')}</Text>
              <Row wrap gap={6}>
                {Object.entries(e.checks).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                    <Feather name={v ? 'check' : 'x'} size={11} color="#fff" /><Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>{k}</Text>
                  </View>
                ))}
              </Row>
            </LinearGradient>
          </Animated.View>

          <Row gap={12} style={{ alignItems: 'stretch' }}>
            <Card i={1} style={{ flex: 1 }}>
              <T faint size={12} weight="700">DONATIONS</T>
              <AnimatedNumber value={data.stats.donations} style={{ fontSize: 34, fontWeight: '900', color: t.text }} />
            </Card>
            <Card i={2} style={{ flex: 1 }}>
              <T faint size={12} weight="700">LIVES SUPPORTED*</T>
              <AnimatedNumber value={data.stats.lives_supported} style={{ fontSize: 34, fontWeight: '900', color: t.primary }} />
            </Card>
          </Row>
          <T faint size={11.5} style={{ marginTop: -6 }}>*One donation can be split into up to 3 components.</T>

          <Card i={3}>
            <CardTitle icon="calendar" title="Upcoming donations" sub="Confirm early – or cancel early so a backup can step in" />
            {data.upcoming.length === 0 ? <Empty icon="calendar" title="Nothing scheduled" sub="Fair rotation will let you know when it's your turn." /> : data.upcoming.map((u, i) => (
              <View key={u.assignment_id}>
                {i > 0 && <Divider />}
                <View style={{ paddingVertical: 12, gap: 12 }}>
                  <Row gap={12}>
                    <View style={{ width: 56, paddingVertical: 8, borderRadius: 14, backgroundColor: t.primarySoft, alignItems: 'center' }}>
                      <T weight="900" size={22} color={t.primary}>{dayNum(u.date)}</T>
                      <T weight="800" size={11} color={t.primary}>{monthShort(u.date)}</T>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T weight="800">For {u.patient}</T>
                      <Row wrap gap={6}><Badge tone={u.slot === 'confirmed' ? 'rose' : 'violet'}>{u.slot === 'confirmed' ? 'Confirmed donor' : 'Backup (standby)'}</Badge><Status s={u.status} /></Row>
                      <T faint size={12.5}>{u.blood_bank} · in {u.days_until} day{u.days_until === 1 ? '' : 's'}</T>
                    </View>
                  </Row>
                  <Row gap={10}>
                    <Button small title="Cancel" icon="x" style={{ flex: 1 }} disabled={!!busy} onPress={() => { setCancelling(u); setReason('') }} />
                    {u.status === 'pending' && <Button small variant="ok" title="I'll be there" icon="check" style={{ flex: 2 }} loading={busy === 'c' + u.assignment_id}
                      onPress={() => post('c' + u.assignment_id, `/api/donor/assignments/${u.assignment_id}/confirm`, 'Thank you – attendance confirmed')} />}
                  </Row>
                </View>
              </View>
            ))}
          </Card>

          <Card i={4}>
            <CardTitle icon="users" title="Your circles" />
            {data.circles.length === 0 ? <T faint>Join a patient’s circle with their invite code (Profile tab).</T> : data.circles.map(c => (
              <Row key={c.patient} style={{ paddingVertical: 6 }}><Avatar name={c.patient} size={36} /><View style={{ flex: 1 }}><T weight="700">{c.patient}</T><T faint size={12}>{c.relation} · {c.hospital}</T></View><BloodTag group={c.blood_group} /></Row>
            ))}
          </Card>
        </>
      )}
      <Sheet open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this donation?">
        {cancelling && (
          <>
            <T muted size={14}>{cancelling.slot === 'confirmed' ? 'Your backup will be promoted automatically. If there is no backup, Urgent mode starts and the blood bank is alerted.' : 'A new backup will be picked from the circle.'}</T>
            <Input label="Reason (shared with the blood bank only)" placeholder="e.g. Fever, travelling" value={reason} onChangeText={setReason} />
            <Row gap={10}>
              <Button title="Keep my slot" style={{ flex: 1 }} onPress={() => setCancelling(null)} />
              <Button variant="danger" title="Cancel donation" style={{ flex: 1 }} loading={busy === 'x'} onPress={async () => {
                const r = await post('x', `/api/donor/assignments/${cancelling.assignment_id}/cancel`, r => (r.promoted ? 'Cancelled – backup promoted' : r.urgent_request_id ? 'Cancelled – urgent mode started' : 'Cancelled'), { reason })
                if (r) setCancelling(null)
              }} />
            </Row>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
