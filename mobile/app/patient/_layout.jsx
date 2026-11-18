import { Tabs } from 'expo-router'
import { icon, tabOptions, useRoleGate } from '../../components/tabs'
import { useTheme } from '../../lib/theme'

export default function PatientTabs() {
  const t = useTheme()
  const gate = useRoleGate('patient')
  if (gate !== false) return gate
  return (
    <Tabs screenOptions={tabOptions(t)}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="circle" options={{ title: 'Circle', tabBarIcon: icon('users') }} />
      <Tabs.Screen name="rotation" options={{ title: 'Rotation', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="urgent" options={{ title: 'Urgent', tabBarIcon: icon('alert-octagon') }} />
    </Tabs>
  )
}
