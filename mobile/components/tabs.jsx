import { Feather } from '@expo/vector-icons'
import { Redirect } from 'expo-router'
import { useAuth } from '../lib/auth'
import { ROLE_HOME } from '../lib/format'

export function tabOptions(t) {
  return {
    headerShown: false,
    tabBarActiveTintColor: t.primary,
    tabBarInactiveTintColor: t.text3,
    tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
    tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
    sceneStyle: { backgroundColor: t.bg },
  }
}

export const icon = name => {
  const TabIcon = ({ color, size }) => <Feather name={name} size={size - 2} color={color} />
  return TabIcon
}

/** Role guard for a tab group: only the matching role gets in, everyone else is sent home. */
export function useRoleGate(role) {
  const { ready, user } = useAuth()
  if (!ready) return null
  if (!user) return <Redirect href="/login" />
  if (user.role !== role) return <Redirect href={ROLE_HOME[user.role]} />
  return false
}
