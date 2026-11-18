import { Tabs } from 'expo-router'
import { icon, tabOptions, useRoleGate } from '../../components/tabs'
import { useTheme } from '../../lib/theme'

export default function DonorTabs() {
  const t = useTheme()
  const gate = useRoleGate('donor')
  if (gate !== false) return gate
  return (
    <Tabs screenOptions={tabOptions(t)}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: icon('radio') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  )
}
