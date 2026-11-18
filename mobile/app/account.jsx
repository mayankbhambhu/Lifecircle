import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToast } from '../components/Toast'
import { Avatar, Badge, Button, Card, H2, Row, T } from '../components/ui'
import { api, getServer } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/format'
import { useTheme } from '../lib/theme'

export default function Account() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { user, signOut } = useAuth()
  const toast = useToast()
  if (!user) return null
  const reset = () => Alert.alert('Reset demo data?', 'Every account goes back to the seeded showcase state, with dates relative to today.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: async () => { try { await api('/api/demo/reset', { method: 'POST' }); toast('Demo data reset'); signOut() } catch (e) { toast(e.message, { tone: 'error' }) } } },
  ])
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingTop: (insets.top || 16) + 4, gap: 14, paddingBottom: insets.bottom + 24 }}>
      <Row between><H2>Account</H2><Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close"><Feather name="x" size={24} color={t.text2} /></Pressable></Row>
      <Card>
        <Row gap={14}>
          <Avatar name={user.name} size={56} />
          <View style={{ flex: 1 }}>
            <T weight="800" size={18}>{user.name}</T>
            <Badge tone="rose" style={{ marginTop: 6 }}>{ROLE_LABEL[user.role]}</Badge>
          </View>
        </Row>
        <View style={{ gap: 8, marginTop: 16 }}>
          {!!user.phone && <Row gap={8}><Feather name="smartphone" size={14} color={t.text3} /><T muted size={14}>{user.phone}</T></Row>}
          {!!user.email && <Row gap={8}><Feather name="mail" size={14} color={t.text3} /><T muted size={14}>{user.email}</T></Row>}
          <Row gap={8}><Feather name="server" size={14} color={t.text3} /><T muted size={14}>{getServer()}</T></Row>
        </View>
      </Card>
      <Card i={1} style={{ gap: 10 }}>
        <Row gap={8}><Feather name="shield" size={16} color={t.primary} /><T weight="700">Your privacy</T></Row>
        <T muted size={13}>Your session is stored in the device’s secure keychain. Donor phone numbers are only ever shown to blood bank staff, and every view is audited.</T>
      </Card>
      <Button variant="danger" icon="log-out" title="Sign out" onPress={signOut} />
      <Button variant="ghost" icon="rotate-ccw" title="Reset demo data" onPress={reset} />
    </ScrollView>
  )
}
