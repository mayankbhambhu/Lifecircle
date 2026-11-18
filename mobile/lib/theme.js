import { useColorScheme } from 'react-native'

const base = {
  rose50: '#fff1f3', rose100: '#ffe4e8', rose200: '#fecdd6', rose300: '#fda4b4', rose400: '#fb7185',
  rose500: '#f43f5e', rose600: '#e11d48', rose700: '#be123c', rose800: '#9f1239', rose900: '#881337',
}

const light = {
  ...base, dark: false,
  bg: '#fbf7f8', bg2: '#f3ecee', surface: '#ffffff', surface2: '#fcf9fa',
  border: '#efe3e6', borderStrong: '#e2d2d6',
  text: '#1c1417', text2: '#5d4e53', text3: '#93848a',
  primary: base.rose600, primarySoft: base.rose50,
  ok: '#059669', okSoft: '#ecfdf5', warn: '#d97706', warnSoft: '#fffbeb',
  crit: '#dc2626', critSoft: '#fef2f2', info: '#2563eb', infoSoft: '#eff6ff',
  violet: '#7c3aed', violetSoft: '#f5f3ff',
  shadow: '#5a1428',
}

const dark = {
  ...base, dark: true,
  bg: '#120d0f', bg2: '#1f181b', surface: '#1d1619', surface2: '#251d20',
  border: '#33282c', borderStrong: '#463a3e',
  text: '#f7eef0', text2: '#c9b9be', text3: '#8f7f85',
  primary: base.rose500, primarySoft: 'rgba(244,63,94,0.14)',
  ok: '#34d399', okSoft: 'rgba(5,150,105,0.16)', warn: '#fbbf24', warnSoft: 'rgba(217,119,6,0.16)',
  crit: '#f87171', critSoft: 'rgba(220,38,38,0.16)', info: '#60a5fa', infoSoft: 'rgba(37,99,235,0.16)',
  violet: '#a78bfa', violetSoft: 'rgba(124,58,237,0.18)',
  shadow: '#000000',
}

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light
}

export const radius = { sm: 12, md: 16, lg: 20, xl: 26 }

export const font = {
  display: { fontWeight: '800', letterSpacing: -0.6 },
  title: { fontWeight: '700', letterSpacing: -0.3 },
}

export function shadow(t, level = 1) {
  return {
    shadowColor: t.shadow,
    shadowOpacity: t.dark ? 0.4 : 0.08 * level,
    shadowRadius: 10 * level,
    shadowOffset: { width: 0, height: 4 * level },
    elevation: 2 * level,
  }
}
