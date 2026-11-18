import { Tabs } from 'expo-router'
import { icon, tabOptions, useRoleGate } from '../../components/tabs'
import { useTheme } from '../../lib/theme'

export default function BankTabs() {
  const t = useTheme()
  const gate = useRoleGate('blood_bank')
  if (gate !== false) return gate
  return (
    <Tabs screenOptions={tabOptions(t)}>
      <Tabs.Screen name="index" options={{ title: 'Queue', tabBarIcon: icon('inbox') }} />
      <Tabs.Screen name="log" options={{ title: 'Daily log', tabBarIcon: icon('clipboard') }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon('droplet') }} />
      <Tabs.Screen name="donors" options={{ title: 'Donors', tabBarIcon: icon('users') }} />
    </Tabs>
  )
}
