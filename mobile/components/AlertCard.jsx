import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { fmtLong, timeAgo } from '../lib/format'
import { radius, shadow, useTheme } from '../lib/theme'
import { Badge, Button, Row, Status, T } from './ui'

/** An urgent request as a donor sees it: blood group, distance from them, accept/decline. */
export default function AlertCard({ a, onAccept, onDecline, busy, i = 0 }) {
  const t = useTheme()
  const live = a.status === 'sent' && ['circle', 'broadcast'].includes(a.request_status)
  const glow = useSharedValue(0)
  useEffect(() => { if (live) glow.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true) }, [live, glow])
  const ring = useAnimatedStyle(() => ({ borderColor: live ? `rgba(244,63,94,${0.25 + glow.value * 0.6})` : t.border }))
  return (
    <Animated.View entering={FadeInDown.delay(i * 70).springify()} layout={LinearTransition}
      style={[{ backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 2, padding: 16, gap: 12 }, shadow(t), ring]}>
      <Row style={{ alignItems: 'flex-start' }} gap={12}>
        <LinearGradient colors={['#fb7185', '#be123c']} style={{ width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{a.blood_group}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 4 }}>
          <T weight="800" size={16}>{a.patient} needs {a.units} unit(s)</T>
          {a.in_circle ? <Badge tone="violet" icon="users">Your circle</Badge> : <Badge tone="rose" icon="radio">Nearby request</Badge>}
        </View>
        {!live && <Status s={a.status === 'sent' ? a.request_status : a.status} />}
      </Row>
      <Row gap={6}><Feather name="map-pin" size={16} color={t.primary} /><T weight="900" size={17} color={t.primary}>{a.distance} from you</T></Row>
      <T muted size={13}>{a.blood_bank} · by {fmtLong(a.needed_by)}</T>
      <T faint size={12}>Sent {timeAgo(a.sent_at)} · first donor to accept is confirmed</T>
      {live && (
        <Row gap={10}>
          <Button title="Can't" icon="x" style={{ flex: 1 }} disabled={!!busy} onPress={onDecline} />
          <Button variant="ok" title="I can donate" icon="check" style={{ flex: 2 }} loading={busy === 'a' + a.alert_id} disabled={!!busy} onPress={onAccept} />
        </Row>
      )}
    </Animated.View>
  )
}
