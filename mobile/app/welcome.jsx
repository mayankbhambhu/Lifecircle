import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Logo from '../components/Logo'
import { tap } from '../components/ui'
import { store } from '../lib/api'

const SLIDES = [
  {
    colors: ['#fb7185', '#e11d48', '#881337'],
    eyebrow: 'FOR THALASSEMIA & REGULAR-TRANSFUSION PATIENTS',
    title: 'Blood on time,\nevery single cycle.',
    body: 'A child with thalassemia major needs a transfusion every 2–4 weeks, for life. LifeCircle makes every one of them predictable.',
    hero: 'logo',
  },
  {
    colors: ['#f43f5e', '#be123c', '#4c0519'],
    eyebrow: 'THE REAL PROBLEM',
    title: 'Every cycle restarts\nthe same scramble.',
    points: [
      ['message-circle', 'Families message relatives manually, every few weeks'],
      ['clock', 'Donors lose track of their 90/120-day eligibility gap'],
      ['x-octagon', 'One cancellation the night before becomes an emergency'],
    ],
  },
  {
    colors: ['#8b5cf6', '#6d28d9', '#2e1065'],
    eyebrow: 'PLANNED MODE',
    title: 'A fair, automatic\ndonor rotation.',
    points: [
      ['calendar', 'Next date = last transfusion + cycle (e.g. 21 days)'],
      ['check-circle', 'Only medically eligible donors are considered'],
      ['repeat', 'Fair rotation picks a Confirmed + a Backup donor'],
      ['bell', 'Reminders at 7, 3 and 1 day before – automatically'],
    ],
  },
  {
    colors: ['#f97316', '#dc2626', '#7f1d1d'],
    eyebrow: 'URGENT MODE · PRIVATE BY DESIGN',
    title: 'When plans break,\nhelp is minutes away.',
    points: [
      ['users', 'Your own circle is alerted first'],
      ['map-pin', 'Then verified donors nearby – "2.4 km from you"'],
      ['zap', 'First donor to accept is confirmed'],
      ['lock', 'Donor phone numbers are only ever seen by the blood bank'],
    ],
  },
]

export default function Welcome() {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [page, setPage] = useState(0)
  const ref = useRef(null)
  const s = SLIDES[page]
  const last = page === SLIDES.length - 1

  const finish = async () => { tap(); await store.set('lc_welcomed', '1'); router.replace('/login') }
  const go = i => { tap(); ref.current?.scrollTo({ x: i * width, animated: true }); setPage(i) }

  return (
    <LinearGradient colors={s.colors} style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Logo size={28} light /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>LifeCircle</Text></View>
        {!last && <Pressable onPress={finish} hitSlop={10}><Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>Skip</Text></Pressable>}
      </View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((sl, i) => (
          <View key={i} style={{ width, paddingHorizontal: 26, justifyContent: 'center' }}>
            {i === page && (
              <View style={{ gap: 18 }}>
                {sl.hero === 'logo' && (
                  <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignSelf: 'center', marginBottom: 12 }}>
                    <View style={{ width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Logo size={110} light />
                    </View>
                  </Animated.View>
                )}
                <Animated.Text entering={FadeInDown.delay(80)} style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>{sl.eyebrow}</Animated.Text>
                <Animated.Text entering={FadeInDown.delay(160)} style={{ color: '#fff', fontWeight: '900', fontSize: 34, letterSpacing: -1, lineHeight: 40 }}>{sl.title}</Animated.Text>
                {!!sl.body && <Animated.Text entering={FadeInDown.delay(240)} style={{ color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 23 }}>{sl.body}</Animated.Text>}
                {sl.points?.map(([ic, txt], k) => (
                  <Animated.View key={txt} entering={FadeInUp.delay(260 + k * 110).springify()} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, padding: 14, borderRadius: 16 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Feather name={ic} size={18} color="#fff" /></View>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 }}>{txt}</Text>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 20, gap: 18 }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {SLIDES.map((_, i) => <Pressable key={i} onPress={() => go(i)} hitSlop={6} style={{ height: 8, width: i === page ? 26 : 8, borderRadius: 4, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.4)' }} />)}
        </View>
        <Pressable onPress={() => (last ? finish() : go(page + 1))} style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Text style={{ color: s.colors[1], fontWeight: '800', fontSize: 16 }}>{last ? 'Get started' : 'Next'}</Text>
          <Feather name="arrow-right" size={18} color={s.colors[1]} />
        </Pressable>
      </View>
    </LinearGradient>
  )
}
