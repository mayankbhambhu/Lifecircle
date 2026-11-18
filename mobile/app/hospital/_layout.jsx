import { Tabs } from 'expo-router'
import { icon, tabOptions, useRoleGate } from '../../components/tabs'
import { useTheme } from '../../lib/theme'

export default function HospitalTabs() {
  const t = useTheme()
  const gate = useRoleGate('hospital')
  if (gate !== false) return gate
  return (
    <Tabs screenOptions={tabOptions(t)}>
      <Tabs.Screen name="index" options={{ title: 'Patients', tabBarIcon: icon('activity') }} />
      <Tabs.Screen name="stock" options={{ title: 'Blood stock', tabBarIcon: icon('droplet') }} />
      <Tabs.Screen name="urgent" options={{ title: 'Urgent', tabBarIcon: icon('alert-octagon') }} />
    </Tabs>
  )
}
