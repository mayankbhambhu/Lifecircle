import { View } from 'react-native'
import Animated, { FadeInRight } from 'react-native-reanimated'
import { Avatar, Badge, BloodTag, Button, Card, CardTitle, Divider, Loading, ProgressBar, Row, Screen, T, useAction } from '../../components/ui'
import { api } from '../../lib/api'
import { firstName, fmtLong } from '../../lib/format'
import { usePatient } from '../../lib/usePatient'

export default function Circle() {
  const { p, reload, refresh, refreshing, error } = usePatient()
  const [busy, run] = useAction()
  return (
    <Screen title={p ? `${firstName(p.name)}'s circle` : 'Circle'} subtitle={p ? `Eligibility checked for ${fmtLong(p.next.date)}` : ''} refreshing={refreshing} onRefresh={refresh}>
      {!p ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card>
            <CardTitle icon="users" title={`${p.circle.length} members`} sub="Sorted by fair-rotation priority"
              right={<Button small icon="refresh-cw" title="Refresh slots" loading={busy === 'r'} onPress={() => run('r', () => api(`/api/family/patients/${p.id}/replan`, { method: 'POST' }), 'Slots refreshed').then(reload)} />} />
            {p.circle.map((c, i) => (
              <Animated.View key={c.id} entering={FadeInRight.delay(i * 50)}>
                {i > 0 && <Divider />}
                <View style={{ paddingVertical: 12, gap: 8 }}>
                  <Row>
                    <Avatar name={c.display_name} />
                    <View style={{ flex: 1 }}>
                      <Row gap={6} wrap><T weight="800">{c.display_name}</T><T faint size={12.5}>{c.relation}</T>{c.verified && <Badge tone="info" icon="shield">Verified</Badge>}</Row>
                      <T faint size={12.5} numberOfLines={2}>{c.why || c.contact}</T>
                    </View>
                    <BloodTag group={c.blood_group} />
                  </Row>
                  <Row>
                    <View style={{ flex: 1 }}>{c.rotation_score != null ? <ProgressBar pct={c.rotation_score} /> : <T faint size={12}>Not in rotation this cycle</T>}</View>
                    {c.rotation_score != null && <T faint size={12} style={{ width: 70 }}>Priority {c.rotation_score}</T>}
                    <Badge tone={c.eligibility.eligible ? 'ok' : c.eligibility.label.startsWith('Resting') ? 'warn' : ''} dot>{c.eligibility.label}</Badge>
                  </Row>
                </View>
              </Animated.View>
            ))}
          </Card>
          <T faint size={12.5} center>Phone numbers and medical reasons stay with the blood bank. You see status only.</T>
        </>
      )}
    </Screen>
  )
}
