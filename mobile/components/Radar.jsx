import { Feather } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated'
import { useTheme } from '../lib/theme'

function Pulse({ delay, size }) {
  const t = useTheme()
  const p = useSharedValue(0)
  useEffect(() => { p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.quad) }), -1)) }, [delay, p])
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 0.1 + p.value }], opacity: 0.45 * (1 - p.value) }))
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: t.rose500 }, st]} />
}

/** Urgent-mode visual: blood bank at the centre, alerted donors placed by real distance. */
export default function Radar({ alerts = [], radius = 5, size = 240 }) {
  const t = useTheme()
  const max = Math.max(radius || 5, ...alerts.map(a => a.distance_km || 0), 1)
  const sweep = useSharedValue(0)
  useEffect(() => { sweep.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1) }, [sweep])
  const sw = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value}deg` }] }))
  const color = s => (s === 'accepted' ? t.ok : s === 'declined' || s === 'closed' ? t.text3 : t.rose500)
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      {[1, 0.66, 0.33].map(r => (
        <View key={r} style={{ position: 'absolute', width: size * r, height: size * r, borderRadius: size, borderWidth: 1, borderStyle: 'dashed', borderColor: t.borderStrong }}>
          <Text style={{ position: 'absolute', top: -8, alignSelf: 'center', fontSize: 9, color: t.text3, backgroundColor: t.surface, paddingHorizontal: 3 }}>{(max * r).toFixed(max * r < 10 ? 1 : 0)} km</Text>
        </View>
      ))}
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, sw]}>
        <View style={{ position: 'absolute', left: size / 2, top: 0, width: 2, height: size / 2, backgroundColor: t.rose300, opacity: 0.7 }} />
      </Animated.View>
      {[0, 1000, 2000].map(d => <Pulse key={d} delay={d} size={size} />)}
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.rose600, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: t.rose200 }}>
        <Feather name="plus" size={12} color="#fff" />
      </View>
      {alerts.map((a, i) => {
        const ang = ((a.id ?? i) * 137.5 * Math.PI) / 180
        const d = (Math.min(1, (a.distance_km || 0) / max) * size) / 2 - 4
        return (
          <Animated.View key={a.alert_id ?? i} entering={ZoomIn.delay(300 + i * 90).springify()}
            style={{ position: 'absolute', left: size / 2 + d * Math.cos(ang) - 7, top: size / 2 + d * Math.sin(ang) - 7, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: t.surface, backgroundColor: color(a.status) }} />
        )
      })}
    </View>
  )
}
