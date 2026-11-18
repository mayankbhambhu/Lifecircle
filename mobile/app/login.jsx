import { Feather } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Logo from '../components/Logo'
import { useToast } from '../components/Toast'
import { Button, Input, Row, Segmented, Sheet, T, tap } from '../components/ui'
import { api, detectServer, getServer, setServer } from '../lib/api'
import { useAuth } from '../lib/auth'
import { firstName } from '../lib/format'
import { setPendingOnboarding } from '../lib/pending'
import { radius, shadow, useTheme } from '../lib/theme'

const DEMO = [
  { role: 'patient', label: 'Patient family', who: "Neha · Aarav's mother", icon: 'user', color: '#e11d48' },
  { role: 'donor', label: 'Donor', who: 'Priya · has an urgent alert', icon: 'heart', color: '#7c3aed' },
  { role: 'blood_bank', label: 'Blood bank', who: 'Dr. Meera · City Blood Centre', icon: 'home', color: '#2563eb' },
  { role: 'hospital', label: 'Hospital', who: "Ravi · Sunrise Children's", icon: 'activity', color: '#059669' },
]

function OtpBoxes({ value, onChange }) {
  const t = useTheme()
  const ref = useRef(null)
  return (
    <Pressable onPress={() => ref.current?.focus()}>
      <Row gap={8} style={{ justifyContent: 'space-between' }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const active = i === Math.min(value.length, 5)
          return (
            <Animated.View key={i} entering={FadeInDown.delay(i * 40)}
              style={{ flex: 1, height: 56, borderRadius: 14, borderWidth: active ? 2 : 1, borderColor: active ? t.rose400 : t.borderStrong, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: t.text }}>{value[i] || ''}</Text>
            </Animated.View>
          )
        })}
      </Row>
      <TextInput ref={ref} value={value} onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
        textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus maxLength={6} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
    </Pressable>
  )
}

function GoogleG() {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}>
      <Text style={{ fontWeight: '900', fontSize: 13, color: '#4285F4' }}>G</Text>
    </View>
  )
}

export default function Login() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { signIn } = useAuth()
  const [method, setMethod] = useState('otp')
  const [cfg, setCfg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(null)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [email, setEmail] = useState('')
  const [link, setLink] = useState(null)
  const [googleOpen, setGoogleOpen] = useState(false)
  const [gEmail, setGEmail] = useState('')
  const [serverOpen, setServerOpen] = useState(false)
  const [serverDraft, setServerDraft] = useState(getServer())

  const loadCfg = () => api('/api/auth/config').then(setCfg).catch(e => setCfg({ error: e.message }))
  useEffect(() => { loadCfg() }, [])
  useEffect(() => { if (cooldown > 0) { const x = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(x) } }, [cooldown])

  const finish = res => {
    if (res.status === 'signed_in') {
      toast(`Welcome, ${firstName(res.user.name)}`, { body: `Signed in as ${res.user.role.replace('_', ' ')}` })
      signIn(res)
    } else {
      setPendingOnboarding(res)
      router.push('/onboarding')
    }
  }
  const go = async fn => { setBusy(true); try { await fn() } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) } }

  const sendOtp = () => go(async () => { const r = await api('/api/auth/otp/request', { method: 'POST', body: { phone } }); setOtp(r); setCode(''); setCooldown(r.resend_in) })
  const verifyOtp = c => go(async () => finish(await api('/api/auth/otp/verify', { method: 'POST', body: { phone: otp.phone, code: c } })))
  const onCode = v => { setCode(v); if (v.length === 6 && !busy) verifyOtp(v) }
  const sendLink = () => go(async () => setLink(await api('/api/auth/magic/request', { method: 'POST', body: { email, redirect: Linking.createURL('magic') } })))
  const demo = role => go(async () => finish(await api('/api/auth/demo-login', { method: 'POST', body: { role } })))
  const googleDemo = e => go(async () => { setGoogleOpen(false); finish(await api('/api/auth/google/demo', { method: 'POST', body: { email: e } })) })

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <LinearGradient colors={['#fb7185', '#e11d48', '#881337']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 26, paddingHorizontal: 22, paddingBottom: 54, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <Row><Logo size={40} light /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>LifeCircle</Text></Row>
          <Animated.Text entering={FadeInDown.delay(100)} style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 26, lineHeight: 35 }}>
            One login.{'\n'}Every role.
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(180)} style={{ color: 'rgba(255,255,255,0.88)', marginTop: 8, fontSize: 15 }}>
            Families, donors, blood banks and hospitals sign in here – we take you straight to your workspace.
          </Animated.Text>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={[{ marginHorizontal: 16, marginTop: -32, backgroundColor: t.surface, borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: t.border, gap: 16 }, shadow(t, 2)]}>
          <Segmented value={method} onChange={setMethod} options={[{ value: 'otp', label: 'Phone', icon: 'smartphone' }, { value: 'magic', label: 'Email', icon: 'mail' }, { value: 'google', label: 'Google', icon: 'globe' }]} />

          {method === 'otp' && (
            <Animated.View key={otp ? 'o2' : 'o1'} entering={FadeInRight} exiting={FadeOutLeft} style={{ gap: 14 }}>
              {!otp ? (
                <>
                  <Row gap={8}>
                    <View style={{ paddingHorizontal: 14, paddingVertical: 13, borderRadius: 13, backgroundColor: t.bg2 }}><T weight="700">+91</T></View>
                    <Input style={{ flex: 1 }} placeholder="98000 00001" keyboardType="phone-pad" value={phone} onChangeText={setPhone} onSubmitEditing={sendOtp} accessibilityLabel="Mobile number" />
                  </Row>
                  <Button variant="primary" title="Send code" icon="arrow-right" loading={busy} disabled={phone.replace(/\D/g, '').length < 10} onPress={sendOtp} />
                  <T faint size={12.5}>6-digit code · valid 5 minutes · 5 attempts</T>
                </>
              ) : (
                <>
                  <Pressable onPress={() => setOtp(null)}><Row gap={6}><Feather name="arrow-left" size={14} color={t.primary} /><T color={t.primary} weight="700" size={13}>{otp.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')}</T></Row></Pressable>
                  <T weight="600" size={14}>Enter the code we sent</T>
                  <OtpBoxes value={code} onChange={onCode} />
                  {!!otp.dev_code && (
                    <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.rose300, backgroundColor: t.primarySoft }}>
                      <Feather name="message-square" size={18} color={t.primary} />
                      <T size={13} style={{ flex: 1 }}>Demo SMS: <T weight="900" size={15} style={{ letterSpacing: 2 }}>{otp.dev_code}</T></T>
                      <Button small title="Use" onPress={() => onCode(otp.dev_code)} />
                    </Animated.View>
                  )}
                  <Row between>
                    <Button variant="primary" small title="Verify" loading={busy} disabled={code.length < 6} onPress={() => verifyOtp(code)} />
                    <Button variant="ghost" small title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'} disabled={cooldown > 0 || busy} onPress={sendOtp} />
                  </Row>
                </>
              )}
            </Animated.View>
          )}

          {method === 'magic' && (
            <Animated.View entering={FadeInRight} style={{ gap: 14 }}>
              <Input placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} onSubmitEditing={sendLink} accessibilityLabel="Email" />
              <Button variant="primary" title="Email me a sign-in link" icon="mail" loading={busy} disabled={!email.includes('@')} onPress={sendLink} />
              {link && (
                <Animated.View entering={FadeInDown} style={{ gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.rose300, backgroundColor: t.primarySoft }}>
                  <Row gap={8}><Feather name="inbox" size={18} color={t.primary} /><T weight="700" size={14}>Check {link.email}</T></Row>
                  <T faint size={12.5}>The link opens this app directly. Single use, valid for 15 minutes.</T>
                  {!!link.dev_token && <Button small variant="primary" icon="external-link" title="Open demo inbox link" onPress={() => router.push({ pathname: '/magic', params: { token: link.dev_token } })} />}
                </Animated.View>
              )}
            </Animated.View>
          )}

          {method === 'google' && (
            <Animated.View entering={FadeInRight} style={{ gap: 12 }}>
              <Pressable onPress={() => { tap(); if (cfg?.demo_mode && !cfg?.google_enabled) setGoogleOpen(true); else toast('Google sign-in needs a development build', { tone: 'info', body: 'Expo Go cannot load the native Google SDK. Use OTP or email here.' }) }}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface }}>
                <GoogleG /><T weight="700">Continue with Google</T>
              </Pressable>
              <T faint size={12.5}>
                {cfg?.google_enabled
                  ? 'Real Google sign-in is configured on the server. It runs in a development build (the native Google SDK is not part of Expo Go).'
                  : 'Demo mode: a simulated Google account chooser is used. The server already verifies real Google ID tokens once GOOGLE_CLIENT_IDS is set.'}
              </T>
            </Animated.View>
          )}
        </Animated.View>

        {cfg?.error && (
          <Animated.View entering={FadeInDown} style={{ margin: 16, marginBottom: 0, padding: 14, borderRadius: 16, backgroundColor: t.critSoft, gap: 8 }}>
            <Row gap={8}><Feather name="wifi-off" size={16} color={t.crit} /><T weight="700" size={14}>Can’t reach the server</T></Row>
            <T size={13} muted>{cfg.error}</T>
            <Row gap={8}><Button small title="Retry" icon="refresh-cw" onPress={loadCfg} /><Button small title="Change server" icon="server" onPress={() => setServerOpen(true)} /></Row>
          </Animated.View>
        )}

        {cfg?.demo_mode && (
          <View style={{ paddingHorizontal: 16, marginTop: 22, gap: 10 }}>
            <T faint size={11.5} weight="800" center style={{ letterSpacing: 1 }}>PRESENTATION DEMO · ONE-TAP SIGN-IN</T>
            <Row wrap gap={10}>
              {DEMO.map((d, i) => (
                <Animated.View key={d.role} entering={FadeInDown.delay(200 + i * 70).springify()} style={{ width: '48%', flexGrow: 1 }}>
                  <Pressable disabled={busy} onPress={() => { tap(); demo(d.role) }}
                    style={({ pressed }) => [{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, transform: [{ scale: pressed ? 0.97 : 1 }] }, shadow(t)]}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: d.color, alignItems: 'center', justifyContent: 'center' }}><Feather name={d.icon} size={17} color="#fff" /></View>
                    <View style={{ flex: 1 }}><T weight="700" size={13}>{d.label}</T><T faint size={11} numberOfLines={1}>{d.who}</T></View>
                  </Pressable>
                </Animated.View>
              ))}
            </Row>
            <T faint size={12} center>Or use Phone OTP with a seeded number, e.g. 98000 00002 (Amit, confirmed donor).</T>
          </View>
        )}

        <Pressable onPress={() => { setServerDraft(getServer()); setServerOpen(true) }} style={{ marginTop: 22, alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8 }}>
          <Feather name="server" size={12} color={t.text3} /><T faint size={12}>Server: {getServer()}</T><Feather name="edit-2" size={11} color={t.text3} />
        </Pressable>
      </ScrollView>

      <Sheet open={googleOpen} onClose={() => setGoogleOpen(false)} title="Choose a Google account">
        {['neha@lifecircle.demo', 'priya@lifecircle.demo'].map(e => (
          <Pressable key={e} onPress={() => googleDemo(e)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>{e[0].toUpperCase()}</Text></View>
            <View><T weight="700">{e.split('@')[0][0].toUpperCase() + e.split('@')[0].slice(1)}</T><T faint size={12}>{e}</T></View>
          </Pressable>
        ))}
        <Input label="Use another account" placeholder="new.person@gmail.com" keyboardType="email-address" autoCapitalize="none" value={gEmail} onChangeText={setGEmail} />
        <Button variant="primary" title="Continue" disabled={!gEmail.includes('@') || busy} onPress={() => googleDemo(gEmail)} />
        <T faint size={12}>Simulated chooser for the demo – nothing is sent to Google.</T>
      </Sheet>

      <Sheet open={serverOpen} onClose={() => setServerOpen(false)} title="Backend server">
        <T muted size={13}>Expo Go detects your laptop automatically. Change this only if you use a tunnel or another machine.</T>
        <Input label="API URL" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={serverDraft} onChangeText={setServerDraft} />
        <Row gap={8}>
          <Button variant="primary" title="Save & test" icon="check" style={{ flex: 1 }} onPress={async () => {
            await setServer(serverDraft)
            try { await api('/api/health'); toast('Connected', { body: getServer() }); setServerOpen(false); loadCfg() } catch (e) { toast(e.message, { tone: 'error' }) }
          }} />
          <Button title="Auto-detect" icon="refresh-cw" onPress={async () => { await setServer(null); setServerDraft(detectServer()) }} />
        </Row>
        <Button variant="ghost" small icon="copy" title="Copy backend start command" onPress={async () => { await Clipboard.setStringAsync('uvicorn app.main:app --host 0.0.0.0 --port 8000'); toast('Copied') }} />
      </Sheet>
    </KeyboardAvoidingView>
  )
}
