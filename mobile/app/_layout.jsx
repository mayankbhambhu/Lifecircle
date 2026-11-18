import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../lib/auth'
import { useTheme } from '../lib/theme'

export default function RootLayout() {
  const t = useTheme()
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <StatusBar style={t.dark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="magic" />
            <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="patient" />
            <Stack.Screen name="donor" />
            <Stack.Screen name="bank" />
            <Stack.Screen name="hospital" />
            <Stack.Screen name="notifications" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  )
}
