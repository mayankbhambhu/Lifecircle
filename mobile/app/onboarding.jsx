import { Feather } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { Redirect, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToast } from '../components/Toast'
import { Banner, Button, Choice, H1, Input, Row, T, tap } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { todayIso } from '../lib/format'
import { getPendingOnboarding, setPendingOnboarding } from '../lib/pending'
import { radius, shadow, useTheme } from '../lib/theme'

const ROLES = [
  { id: 'patient', title: 'I need blood', sub: 'Patient or family managing regular transfusions', icon: 'user', color: '#e11d48' },
  { id: 'donor', title: 'I want to donate', sub: "Join a patient's circle, get urgent alerts nearby", icon: 'heart', color: '#7c3aed' },
  { id: 'blood_bank', title: 'Blood bank staff', sub: 'Invite only – ask your administrator', icon: 'home', color: '#2563eb', locked: true },
  { id: 'hospital', title: 'Hospital staff', sub: 'Invite only – ask your administrator', icon: 'activity', color: '#059669', locked: true },
]
const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function Onboarding() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { signIn } = useAuth()
  const [ob] = useState(getPendingOnboarding)
  const [role, setRole] = useState(null)
  const [meta, setMeta] = useState(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ cycle_days: 21, sex: 'M', name: ob?.identity?.name || '' })
  const set = k => v => setF(x => ({ ...x, [k]: v }))

  useEffect(() => { api('/api/meta').then(setMeta).catch(() => {}) }, [])
  if (!ob) return <Redirect href="/login" />

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return toast('Location not shared', { tone: 'warning', body: 'You can add it later from your profile.' })
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    setF(x => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude }))
    toast('Location added', { body: 'Used only to rank you for nearby urgent requests.' })
  }

  const submit = async () => {
    setBusy(true)
    try {
      const body = { onboarding_token: ob.onboarding_token, role, ...f, cycle_days: Number(f.cycle_days), weight_kg: f.weight_kg ? Number(f.weight_kg) : undefined }
      Object.keys(body).forEach(k => (body[k] === '' || body[k] === undefined || body[k] === null) && delete body[k])
      const res = await api('/api/auth/onboard', { method: 'POST', body })
      setPendingOnboarding(null)
      toast('Welcome to LifeCircle', { body: role === 'patient' ? 'Your first cycle is planned – invite your circle next.' : 'A blood bank will verify your profile.' })
      signIn(res)
    } catch (e) { toast(e.message, { tone: 'error' }) } finally { setBusy(false) }
  }

  const verified = ob.identity?.phone || ob.identity?.email
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 30, gap: 16 }}>
        <Row between>
          <Pressable onPress={() => (role ? setRole(null) : router.back())} hitSlop={10}><Feather name="arrow-left" size={22} color={t.text} /></Pressable>
          <Row gap={6}>{[0, 1].map(i => <View key={i} style={{ width: 34, height: 5, borderRadius: 3, backgroundColor: (role ? 1 : 0) >= i ? t.primary : t.border }} />)}</Row>
        </Row>

        {!role ? (
          <Animated.View key="pick" entering={FadeInDown} style={{ gap: 14 }}>
            <H1>How will you use LifeCircle?</H1>
            <T muted>Verified as <T weight="700">{verified}</T>. You’ll land on your role’s dashboard every time you sign in.</T>
            {ROLES.map((r, i) => (
              <Animated.View key={r.id} entering={FadeInDown.delay(80 + i * 70).springify()}>
                <Pressable disabled={r.locked} onPress={() => { tap(); setRole(r.id) }}
                  style={({ pressed }) => [{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, opacity: r.locked ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, shadow(t)]}>
                  <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: r.color, alignItems: 'center', justifyContent: 'center' }}><Feather name={r.icon} size={21} color="#fff" /></View>
                  <View style={{ flex: 1 }}><T weight="800" size={16}>{r.title}</T><T faint size={13}>{r.sub}</T></View>
                  <Feather name={r.locked ? 'lock' : 'chevron-right'} size={18} color={t.text3} />
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View key="form" entering={FadeInRight} style={{ gap: 16 }}>
            <H1>{role === 'patient' ? "Set up your patient's plan" : 'Your donor profile'}</H1>
            <Input label="Your name" value={f.name} onChangeText={set('name')} />
            {!ob.identity?.phone && <Input label={role === 'donor' ? 'Mobile number' : 'Mobile number (optional)'} keyboardType="phone-pad" placeholder="98xxxxxxxx" value={f.phone || ''} onChangeText={set('phone')} />}
            {role === 'patient' ? (
              <>
                <Input label="Patient's name" value={f.patient_name || ''} onChangeText={set('patient_name')} />
                <Choice label="Patient's blood group" options={GROUPS} value={f.patient_blood_group} onChange={set('patient_blood_group')} />
                <Choice label="Transfusion every" options={[14, 21, 28, 35].map(d => ({ value: d, label: `${d} days` }))} value={Number(f.cycle_days)} onChange={set('cycle_days')} />
                <Choice label="Last transfusion" options={[{ value: todayIso(), label: 'Today' }, { value: daysAgo(7), label: '1 week ago' }, { value: daysAgo(14), label: '2 weeks ago' }, { value: daysAgo(21), label: '3 weeks ago' }]}
                  value={f.last_transfusion_date} onChange={set('last_transfusion_date')} />
                <Choice label="Hospital / day-care centre" options={(meta?.hospitals || []).map(h => ({ value: h.id, label: h.name }))} value={f.hospital_id} onChange={set('hospital_id')} />
              </>
            ) : (
              <>
                <Choice label="Blood group" options={GROUPS} value={f.blood_group} onChange={set('blood_group')} />
                <Choice label="Sex" options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]} value={f.sex} onChange={set('sex')} />
                <Row gap={12}>
                  <Input style={{ flex: 1 }} label="Weight (kg)" keyboardType="numeric" value={f.weight_kg || ''} onChangeText={set('weight_kg')} />
                  <Input style={{ flex: 1.3 }} label="Date of birth" placeholder="YYYY-MM-DD" value={f.date_of_birth || ''} onChangeText={set('date_of_birth')} />
                </Row>
                <Input label="Area" placeholder="e.g. Malviya Nagar" value={f.area || ''} onChangeText={set('area')} />
                <Button icon={f.lat ? 'check' : 'map-pin'} title={f.lat ? 'Location added' : 'Use my current location'} onPress={locate} />
                <Row gap={12}>
                  <Input style={{ flex: 1 }} label="Circle invite code" placeholder="AARAV-7Q2K" autoCapitalize="characters" value={f.invite_code || ''} onChangeText={set('invite_code')} />
                  <Input style={{ flex: 1 }} label="Relation" placeholder="Cousin" value={f.relation || ''} onChangeText={set('relation')} />
                </Row>
                <Banner tone="info" icon="lock">Your phone number is visible only to blood bank staff. Families see your first name and status – never your number.</Banner>
              </>
            )}
            <Button variant="primary" title="Create account" icon="arrow-right" loading={busy} onPress={submit} />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
