import { Feather } from '@expo/vector-icons'
import { createContext, useCallback, useContext, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeOutUp, SlideInUp, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { shadow, useTheme } from '../lib/theme'

const ToastCtx = createContext(() => {})
const ICON = { success: 'check-circle', error: 'alert-octagon', warning: 'alert-triangle', info: 'info' }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const push = useCallback((title, { tone = 'success', body, ms = 3800 } = {}) => {
    const id = Math.random().toString(36).slice(2)
    setItems(x => [...x.slice(-2), { id, title, body, tone }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), ms)
  }, [])
  const color = { success: t.ok, error: t.crit, warning: t.warn, info: t.info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
        {items.map(i => (
          <Animated.View key={i.id} entering={SlideInUp.springify().damping(18)} exiting={FadeOutUp} layout={LinearTransition}
            style={[styles.toast, shadow(t, 3), { backgroundColor: t.surface, borderColor: t.border }]}>
            <Feather name={ICON[i.tone] || 'info'} size={20} color={color[i.tone]} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{i.title}</Text>
              {!!i.body && <Text style={{ color: t.text2, fontSize: 13, marginTop: 2 }} numberOfLines={3}>{i.body}</Text>}
            </View>
          </Animated.View>
        ))}
      </View>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 1000 },
  toast: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
})
