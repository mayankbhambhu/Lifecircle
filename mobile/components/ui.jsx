import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../lib/api'
import { useAuth, useNotifications } from '../lib/auth'
import { ROLE_LABEL } from '../lib/format'
import { font, radius, shadow, useTheme } from '../lib/theme'
import { useToast } from './Toast'

export const tap = () => { try { Haptics.selectionAsync() } catch { /* ignore */ } }

/* ------------------------------------------------------------------ data hooks */
export function useData(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const reload = useCallback(async () => {
    if (!path) return
    try { setData(await api(path)); setError(null) } catch (e) { setError(e) }
  }, [path])
  useFocusEffect(useCallback(() => { reload() }, [reload]))
  const refresh = useCallback(async () => { setRefreshing(true); await reload(); setRefreshing(false) }, [reload])
  return { data, reload, refresh, refreshing, error, setData }
}

/** Run an async action with toast feedback and a busy key. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const run = useCallback(async (key, fn, success) => {
    setBusy(key)
    try {
      const r = await fn()
      if (success) toast(typeof success === 'function' ? success(r) : success)
      return r
    } catch (e) {
      toast(e.message, { tone: 'error' })
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) } catch { /* ignore */ }
      return null
    } finally { setBusy(null) }
  }, [toast])
  return [busy, run]
}

/* ------------------------------------------------------------------ text */
export function T({ style, muted, faint, size, weight, color, center, children, ...rest }) {
  const t = useTheme()
  return (
    <Text style={[{ color: color || (faint ? t.text3 : muted ? t.text2 : t.text), fontSize: size || 15, fontWeight: weight, textAlign: center ? 'center' : undefined }, style]} {...rest}>
      {children}
    </Text>
  )
}
export const H1 = p => <T size={28} style={font.display} {...p} />
export const H2 = p => <T size={20} style={font.title} {...p} />
export const H3 = p => <T size={16} weight="700" {...p} />

export function SectionTitle({ children, style }) {
  const t = useTheme()
  return <Text style={[{ color: t.text3, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, marginBottom: 10 }, style]}>{children}</Text>
}

export const Row = ({ style, gap = 10, wrap, between, children, ...rest }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap', justifyContent: between ? 'space-between' : undefined }, style]} {...rest}>{children}</View>
)

/* ------------------------------------------------------------------ screen */
function Bell() {
  const t = useTheme()
  const { unread } = useNotifications()
  const rot = useSharedValue(0)
  useEffect(() => {
    rot.value = unread ? withRepeat(withSequence(withTiming(-14, { duration: 120 }), withTiming(12, { duration: 120 }), withTiming(0, { duration: 120 }), withTiming(0, { duration: 3000 })), -1) : withTiming(0)
  }, [unread, rot])
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }))
  return (
    <Pressable onPress={() => { tap(); router.push('/notifications') }} style={[styles.iconBtn, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityLabel="Notifications">
      <Animated.View style={st}><Feather name="bell" size={19} color={t.text} /></Animated.View>
      {unread > 0 && <View style={[styles.count, { backgroundColor: t.primary, borderColor: t.bg }]}><Text style={styles.countText}>{unread > 9 ? '9+' : unread}</Text></View>}
    </Pressable>
  )
}

export function Screen({ title, subtitle, right, children, refreshing, onRefresh, scroll = true, padded = true }) {
  const t = useTheme()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const header = (
    <Animated.View entering={FadeIn.duration(300)} style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 14 }}>
      <Row between style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={[styles.roleChip, { backgroundColor: t.primarySoft }]}><Text style={{ color: t.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>{ROLE_LABEL[user?.role]?.toUpperCase()}</Text></View>
          <H1 numberOfLines={2}>{title}</H1>
          {!!subtitle && <T muted size={13} style={{ marginTop: 3 }} numberOfLines={2}>{subtitle}</T>}
        </View>
        <Row gap={8}>{right}<Bell /><Pressable onPress={() => { tap(); router.push('/account') }} accessibilityLabel="Account"><Avatar name={user?.name || '?'} size={42} /></Pressable></Row>
      </Row>
    </Animated.View>
  )
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.bg }}>{header}<View style={{ flex: 1, paddingHorizontal: padded ? 16 : 0 }}>{children}</View></View>
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingHorizontal: padded ? 16 : 0, paddingBottom: 32, gap: 14 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} /> : undefined}
      keyboardShouldPersistTaps="handled">
      <View style={{ marginHorizontal: padded ? -16 : 0 }}>{header}</View>
      {children}
    </ScrollView>
  )
}

/* ------------------------------------------------------------------ building blocks */
export function Card({ children, style, i = 0, tone, onPress }) {
  const t = useTheme()
  const border = tone ? { crit: t.rose300, ok: t.ok, warn: t.warn }[tone] : t.border
  const body = (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 60).duration(420).springify().damping(18)}
      style={[styles.card, shadow(t), { backgroundColor: t.surface, borderColor: border }, style]}>
      {children}
    </Animated.View>
  )
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body
}

export function CardTitle({ icon, title, sub, right }) {
  return (
    <Row between style={{ marginBottom: 14 }}>
      <Row style={{ flex: 1 }}>
        {icon && <IconBox name={icon} />}
        <View style={{ flex: 1 }}>
          <H3>{title}</H3>
          {!!sub && <T faint size={12.5} style={{ marginTop: 1 }}>{sub}</T>}
        </View>
      </Row>
      {right}
    </Row>
  )
}

export function IconBox({ name, color, bg, size = 34 }) {
  const t = useTheme()
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', backgroundColor: bg || t.primarySoft }}>
      <Feather name={name} size={size * 0.5} color={color || t.primary} />
    </View>
  )
}

const TONES = t => ({
  ok: [t.okSoft, t.ok], warn: [t.warnSoft, t.warn], crit: [t.critSoft, t.crit], info: [t.infoSoft, t.info],
  violet: [t.violetSoft, t.violet], rose: [t.primarySoft, t.primary], '': [t.bg2, t.text2],
})
export function Badge({ tone = '', children, dot, icon, style }) {
  const t = useTheme()
  const [bg, fg] = TONES(t)[tone] || TONES(t)['']
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} />}
      {icon && <Feather name={icon} size={11} color={fg} />}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  )
}

export const STATUS_TONE = {
  attending: 'ok', confirmed: 'ok', donated: 'ok', filled: 'ok', stock_fulfilled: 'ok', scheduled: 'ok', completed: 'ok', healthy: 'ok', accepted: 'ok',
  pending: 'warn', awaiting_bank: 'warn', planned: 'info', awaiting_donor: 'warn', low: 'warn', circle: 'warn', deferred: 'warn',
  broadcast: 'crit', uncovered: 'crit', critical: 'crit', no_match: 'crit', no_show: 'crit', excused: 'info', sent: 'rose',
}
export const STATUS_LABEL = {
  attending: 'Confirmed', pending: 'Awaiting reply', awaiting_bank: 'Awaiting bank', scheduled: 'Slot booked', circle: 'Alerting circle',
  broadcast: 'Broadcasting', filled: 'Filled', stock_fulfilled: 'From stock', no_match: 'No match', no_show: 'No-show',
  awaiting_donor: 'Awaiting donor', uncovered: 'Uncovered', planned: 'Planned', confirmed: 'Confirmed', sent: 'New', closed: 'Closed',
  released: 'Released', accepted: 'Accepted', declined: 'Declined', donated: 'Donated', deferred: 'Deferred', excused: 'Excused',
  cancelled: 'Cancelled', completed: 'Completed', healthy: 'Healthy', low: 'Low', critical: 'Critical',
}
export const Status = ({ s }) => <Badge tone={STATUS_TONE[s] ?? ''} dot>{STATUS_LABEL[s] ?? s?.replace(/_/g, ' ')}</Badge>

export function BloodTag({ group, big }) {
  const t = useTheme()
  return (
    <View style={{ backgroundColor: t.primarySoft, borderRadius: 10, paddingHorizontal: big ? 10 : 8, paddingVertical: big ? 6 : 3 }}>
      <Text style={{ color: t.primary, fontWeight: '900', fontSize: big ? 16 : 13 }}>{group}</Text>
    </View>
  )
}

const AV = [['#fb7185', '#e11d48'], ['#a78bfa', '#7c3aed'], ['#60a5fa', '#2563eb'], ['#34d399', '#059669'], ['#fbbf24', '#d97706'], ['#f472b6', '#db2777'], ['#2dd4bf', '#0d9488']]
export function Avatar({ name = '?', size = 40, label }) {
  const initials = label || name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?'
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <LinearGradient colors={AV[h % AV.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: 'white', fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </LinearGradient>
  )
}

export function Button({ title, onPress, variant = 'outline', icon, small, disabled, loading, style, full }) {
  const t = useTheme()
  const scale = useSharedValue(1)
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const v = {
    primary: { bg: null, fg: '#fff', border: 'transparent' },
    danger: { bg: t.crit, fg: '#fff', border: 'transparent' },
    ok: { bg: t.ok, fg: '#fff', border: 'transparent' },
    ghost: { bg: 'transparent', fg: t.primary, border: 'transparent' },
    outline: { bg: t.surface, fg: t.text, border: t.borderStrong },
  }[variant]
  const pad = small ? { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 11 } : { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14 }
  const inner = (
    <Row gap={7} style={{ justifyContent: 'center' }}>
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Feather name={icon} size={small ? 14 : 16} color={v.fg} /> : null}
      {!!title && <Text style={{ color: v.fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>}
    </Row>
  )
  return (
    <Animated.View style={[st, full && { alignSelf: 'stretch' }, { opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={title}
        onPressIn={() => scale.set(withSpring(0.95, { damping: 15 }))} onPressOut={() => scale.set(withSpring(1))}
        onPress={() => { tap(); onPress?.() }}>
        {variant === 'primary' ? (
          <LinearGradient colors={[t.rose500, t.rose700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[pad, shadow({ ...t, shadow: t.rose700 }, 1)]}>{inner}</LinearGradient>
        ) : (
          <View style={[pad, { backgroundColor: v.bg, borderWidth: 1, borderColor: v.border }]}>{inner}</View>
        )}
      </Pressable>
    </Animated.View>
  )
}

export function Input({ label, style, ...rest }) {
  const t = useTheme()
  const [focus, setFocus] = useState(false)
  return (
    <View style={[{ gap: 6 }, style]}>
      {!!label && <T muted size={13} weight="600">{label}</T>}
      <TextInput placeholderTextColor={t.text3} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: focus ? t.rose400 : t.borderStrong }, rest.multiline && { minHeight: 80, textAlignVertical: 'top' }]} {...rest} />
    </View>
  )
}

/** Horizontal choice pills (blood group, units, role…). */
export function Choice({ options, value, onChange, label }) {
  const t = useTheme()
  return (
    <View style={{ gap: 6 }}>
      {!!label && <T muted size={13} weight="600">{label}</T>}
      <Row wrap gap={8}>
        {options.map(o => {
          const val = typeof o === 'object' ? o.value : o
          const lab = typeof o === 'object' ? o.label : String(o)
          const on = val === value
          return (
            <Pressable key={String(val)} onPress={() => { tap(); onChange(val) }}
              style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: on ? t.rose400 : t.borderStrong, backgroundColor: on ? t.primarySoft : t.surface }}>
              <Text style={{ color: on ? t.primary : t.text2, fontWeight: '700', fontSize: 13 }}>{lab}</Text>
            </Pressable>
          )
        })}
      </Row>
    </View>
  )
}

/** Segmented control with an animated sliding pill. */
export function Segmented({ options, value, onChange }) {
  const t = useTheme()
  const [w, setW] = useState(0)
  const idx = Math.max(0, options.findIndex(o => o.value === value))
  const x = useSharedValue(0)
  const seg = w / options.length
  useEffect(() => { x.value = withSpring(idx * seg, { damping: 20, stiffness: 220 }) }, [idx, seg, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width - 8)} style={[styles.seg, { backgroundColor: t.bg2 }]}>
      {w > 0 && <Animated.View style={[styles.segPill, shadow(t), { width: seg, backgroundColor: t.surface }, pill]} />}
      {options.map(o => (
        <Pressable key={o.value} style={styles.segBtn} onPress={() => { tap(); onChange(o.value) }} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }}>
          {o.icon && <Feather name={o.icon} size={15} color={o.value === value ? t.primary : t.text3} />}
          <Text style={{ fontWeight: '700', fontSize: 13, color: o.value === value ? t.text : t.text3 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Sheet({ open, onClose, title, children }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 18 }]}>
          <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />
          <Row between style={{ marginBottom: 14 }}>
            <H2 style={{ flex: 1 }}>{title}</H2>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Feather name="x" size={22} color={t.text2} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function Banner({ tone = 'info', icon, title, children, onPress, right }) {
  const t = useTheme()
  const [bg, fg] = TONES(t)[tone]
  const pulse = useSharedValue(1)
  useEffect(() => { if (tone === 'crit') pulse.value = withRepeat(withSequence(withTiming(1.25, { duration: 500 }), withTiming(1, { duration: 500 })), -1) }, [tone, pulse])
  const ps = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const body = (
    <Animated.View entering={FadeInDown.duration(350)} style={[styles.banner, { backgroundColor: bg, borderColor: fg + '44' }]}>
      <Animated.View style={ps}><Feather name={icon || { crit: 'alert-octagon', warn: 'alert-triangle', ok: 'check-circle', info: 'info' }[tone]} size={18} color={fg} /></Animated.View>
      <View style={{ flex: 1 }}>
        {!!title && <T weight="700" size={14}>{title}</T>}
        {typeof children === 'string' ? <T size={13} muted style={{ marginTop: title ? 2 : 0 }}>{children}</T> : children}
      </View>
      {right}
    </Animated.View>
  )
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body
}

export function ProgressBar({ pct, color, delay = 0, height = 8 }) {
  const t = useTheme()
  const w = useSharedValue(0)
  useEffect(() => { w.value = withTiming(Math.max(0, Math.min(100, pct)), { duration: 900 }) }, [pct, w])
  const st = useAnimatedStyle(() => ({ width: `${w.value}%` }))
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.bg2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: color || t.rose500 }, st]} />
    </View>
  )
}

export function AnimatedNumber({ value = 0, style }) {
  const [n, setN] = useState(0)
  const raf = useRef()
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 1100)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <Text style={style}>{n}</Text>
}

export function Toggle({ value, onChange, label, sub }) {
  const t = useTheme()
  return (
    <Row style={{ paddingVertical: 10 }}>
      <View style={{ flex: 1 }}><T weight="700">{label}</T>{!!sub && <T faint size={13}>{sub}</T>}</View>
      <Switch value={value} onValueChange={v => { tap(); onChange(v) }} trackColor={{ true: t.ok, false: t.borderStrong }} thumbColor="#fff" />
    </Row>
  )
}

export function Empty({ icon = 'inbox', title, sub }) {
  const t = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: t.bg2, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={22} color={t.text3} /></View>
      <T weight="700" center>{title}</T>
      {!!sub && <T faint size={13} center>{sub}</T>}
    </View>
  )
}

export function Loading({ error, onRetry }) {
  const t = useTheme()
  const o = useSharedValue(0.4)
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true) }, [o])
  const st = useAnimatedStyle(() => ({ opacity: o.value }))
  if (error) return (
    <Card><Empty icon="wifi-off" title="Couldn't load" sub={error.message} />{onRetry && <Button title="Try again" icon="refresh-cw" onPress={onRetry} />}</Card>
  )
  return (
    <View style={{ gap: 14 }}>
      {[180, 120, 220].map((h, i) => <Animated.View key={i} style={[{ height: h, borderRadius: radius.lg, backgroundColor: t.bg2 }, st]} />)}
    </View>
  )
}

export function Divider() {
  const t = useTheme()
  return <View style={{ height: 1, backgroundColor: t.border, marginVertical: 2 }} />
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start' },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  countText: { color: 'white', fontSize: 10, fontWeight: '900' },
  roleChip: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 16 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,8,12,0.45)' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingTop: 10, maxHeight: '88%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
})
