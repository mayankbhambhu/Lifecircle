import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

const ACircle = Animated.createAnimatedComponent(Circle)

/** White progress ring for the hero card: how far through the current cycle we are. */
export default function Countdown({ days, cycle, size = 104 }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, 1 - days / Math.max(cycle, 1)))
  const p = useSharedValue(0)
  useEffect(() => { p.value = withTiming(pct, { duration: 1400, easing: Easing.out(Easing.cubic) }) }, [pct, p])
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${days} days to go`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={8} fill="none" />
        <ACircle cx={size / 2} cy={size / 2} r={r} stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: days <= 0 ? 20 : 30 }}>{days <= 0 ? 'Today' : days}</Text>
      {days > 0 && <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>DAYS TO GO</Text>}
    </View>
  )
}
