import { useEffect } from 'react'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

export default function Logo({ size = 36, light = false, animated = true }) {
  const rot = useSharedValue(0)
  const beat = useSharedValue(1)
  useEffect(() => {
    if (!animated) return
    rot.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1)
    beat.value = withRepeat(withSequence(withTiming(1.1, { duration: 400 }), withTiming(1, { duration: 400 }), withTiming(1, { duration: 700 })), -1)
  }, [animated, rot, beat])
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }))
  const drop = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }))
  const a = light ? '#ffffff' : '#fb7185'
  const b = light ? '#ffe4e8' : '#be123c'
  const grad = (id) => (
    <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient></Defs>
  )
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Svg width={size} height={size} viewBox="0 0 64 64">{grad('r')}<Circle cx="32" cy="32" r="28" fill="none" stroke="url(#r)" strokeWidth="5" strokeLinecap="round" strokeDasharray="150 26" /></Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, drop]}>
        <Svg width={size} height={size} viewBox="0 0 64 64">{grad('d')}<Path d="M32 14c6 9 12 15 12 23a12 12 0 0 1-24 0c0-8 6-14 12-23z" fill="url(#d)" /></Svg>
      </Animated.View>
    </View>
  )
}
