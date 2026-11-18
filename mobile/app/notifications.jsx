import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Empty, H2, Row, T } from '../components/ui'
import { useNotifications } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useTheme } from '../lib/theme'

const ICON = { critical: 'alert-octagon', warning: 'alert-triangle', success: 'check-circle', info: 'info' }

export default function Notifications() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { items, reload, readAll } = useNotifications()
  useEffect(() => { reload() }, [reload])
  const color = { critical: t.crit, warning: t.warn, success: t.ok, info: t.info }
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top || 16 }}>
      <Row between style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
        <H2>Notifications</H2>
        <Row gap={8}>
          <Button small variant="ghost" icon="check-square" title="Read all" onPress={readAll} />
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"><Feather name="x" size={24} color={t.text2} /></Pressable>
        </Row>
      </Row>
      <FlatList data={items} keyExtractor={n => String(n.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20, gap: 10 }}
        ListEmptyComponent={<Empty icon="bell-off" title="You're all caught up" />}
        renderItem={({ item: n, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40)}
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: n.read ? t.border : t.rose200, backgroundColor: n.read ? t.surface : t.primarySoft }}>
            <Feather name={ICON[n.level] || 'info'} size={18} color={color[n.level]} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <T weight="700" size={14}>{n.title}</T>
              <T muted size={13} style={{ marginTop: 2 }}>{n.body}</T>
              <T faint size={11.5} style={{ marginTop: 4 }}>{timeAgo(n.created_at)}</T>
            </View>
          </Animated.View>
        )} />
    </View>
  )
}
