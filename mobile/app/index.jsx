import { LinearGradient } from 'expo-linear-gradient'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Logo from '../components/Logo'
import { store } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_HOME } from '../lib/format'

export default function Index() {
  const { ready, user } = useAuth()
  const [welcomed, setWelcomed] = useState(null)
  const [minDelay, setMinDelay] = useState(false)
  useEffect(() => {
    store.get('lc_welcomed').then(v => setWelcomed(!!v)).catch(() => setWelcomed(false))
    const t = setTimeout(() => setMinDelay(true), 900) // let the splash animation breathe
    return () => clearTimeout(t)
  }, [])

  if (ready && welcomed !== null && minDelay) {
    if (user) return <Redirect href={ROLE_HOME[user.role]} />
    return <Redirect href={welcomed ? '/login' : '/welcome'} />
  }
  return (
    <LinearGradient colors={['#fb7185', '#e11d48', '#881337']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Logo size={88} light />
      <Animated.View entering={FadeIn.delay(200)}>
        <Text style={{ color: 'white', fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }}>LifeCircle</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 }}>Blood on time, every cycle.</Text>
      </Animated.View>
    </LinearGradient>
  )
}
