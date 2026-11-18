import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, { ZoomIn } from 'react-native-reanimated'
import Logo from '../components/Logo'
import { Button, H2, T } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { setPendingOnboarding } from '../lib/pending'
import { useTheme } from '../lib/theme'

/** Opened by the emailed link: lifecircle://magic?token=…  (exp://<ip>:8081/--/magic?token=… in Expo Go) */
export default function Magic() {
  const { token } = useLocalSearchParams()
  const { signIn } = useAuth()
  const [error, setError] = useState(null)
  const ran = useRef(false)
  const t = useTheme()

  useEffect(() => {
    if (ran.current) return
    ran.current = true // tokens are single use
    api('/api/auth/magic/verify', { method: 'POST', body: { token: String(token || '') } })
      .then(res => {
        if (res.status === 'signed_in') signIn(res)
        else { setPendingOnboarding(res); router.replace('/onboarding') }
      })
      .catch(e => setError(e.message))
  }, [token, signIn])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: t.bg }}>
      {error ? (
        <Animated.View entering={ZoomIn} style={{ alignItems: 'center', gap: 12 }}>
          <Feather name="x-circle" size={48} color={t.crit} />
          <H2>Link didn’t work</H2>
          <T muted center>{error}</T>
          <Button variant="primary" title="Back to sign in" onPress={() => router.replace('/login')} />
        </Animated.View>
      ) : (
        <>
          <Logo size={72} />
          <H2>Signing you in…</H2>
          <T muted>Verifying your magic link</T>
        </>
      )}
    </View>
  )
}
