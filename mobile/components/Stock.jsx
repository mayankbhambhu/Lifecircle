import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated'
import { useTheme } from '../lib/theme'
import { Badge, Banner, Button, Row, T } from './ui'

const FILL = { healthy: ['#34d399', '#059669'], low: ['#fbbf24', '#d97706'], critical: ['#f87171', '#dc2626'] }
const TUBE_H = 130

function Tube({ s, i, onPress }) {
  const t = useTheme()
  const h = useSharedValue(0)
  const shimmer = useSharedValue(0)
  useEffect(() => {
    h.value = withDelay(i * 70, withTiming(Math.max(4, s.fill_pct), { duration: 1100, easing: Easing.out(Easing.cubic) }))
    shimmer.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true)
  }, [s.fill_pct, i, h, shimmer])
  const fill = useAnimatedStyle(() => ({ height: `${h.value}%` }))
  const shine = useAnimatedStyle(() => ({ opacity: 0.15 + shimmer.value * 0.25 }))
  const color = s.status === 'healthy' ? t.text3 : s.status === 'low' ? t.warn : t.crit
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, alignItems: 'center', gap: 6 }} accessibilityLabel={`${s.blood_group} ${s.units} units, ${s.status}`}>
      <Text style={{ color: t.text, fontWeight: '900', fontSize: 14 }}>{s.units}</Text>
      <View style={{ width: '100%', maxWidth: 40, height: TUBE_H, borderRadius: 12, backgroundColor: t.bg2, borderWidth: 1, borderColor: t.border, overflow: 'hidden', justifyContent: 'flex-end' }}>
        <Animated.View style={fill}>
          <LinearGradient colors={FILL[s.status]} style={{ flex: 1 }} />
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#fff' }, shine]} />
        </Animated.View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: '50%', borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.3)' }} />
      </View>
      <Text style={{ color: t.primary, fontWeight: '900', fontSize: 12 }}>{s.blood_group}</Text>
      <Text style={{ color, fontWeight: '800', fontSize: 11 }}>{s.days_of_cover != null ? `${s.days_of_cover}d` : '—'}</Text>
    </Pressable>
  )
}

export function StockTubes({ stock, onSelect }) {
  return (
    <View style={{ gap: 12 }}>
      <Row gap={6} style={{ alignItems: 'flex-end' }}>
        {stock.map((s, i) => <Tube key={s.blood_group} s={s} i={i} onPress={onSelect ? () => onSelect(s) : undefined} />)}
      </Row>
      <Row wrap gap={6}><Badge tone="ok" dot>Healthy</Badge><Badge tone="warn" dot>Low</Badge><Badge tone="crit" dot>Critical</Badge><T faint size={12}>dashed = minimum</T></Row>
    </View>
  )
}

export function StockAlerts({ alerts, onRally, busy }) {
  if (!alerts.length) return <Banner tone="ok" title="All groups above safety levels" />
  return (
    <View style={{ gap: 10 }}>
      {alerts.map(a => (
        <Banner key={a.blood_group} tone={a.status === 'critical' ? 'crit' : 'warn'} title={`${a.blood_group} · ${a.status.toUpperCase()}`}
          right={onRally ? <Button small icon="volume-2" title="Rally" loading={busy === a.blood_group} onPress={() => onRally(a.blood_group)} /> : null}>
          {`${a.units} units left · ${a.days_of_cover ?? '–'} days of cover · minimum ${a.min_threshold}`}
        </Banner>
      ))}
    </View>
  )
}

