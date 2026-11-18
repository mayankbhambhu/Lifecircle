import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, initServer, onUnauthorized, setToken, store } from './api'
import { ROLE_HOME } from './format'
import { useToast } from '../components/Toast'

const AuthCtx = createContext(null)
const NotifCtx = createContext({ unread: 0, items: [], reload: () => {}, readAll: () => {} })

/** Polls in-app notifications while signed in and surfaces new ones as toasts + haptics. */
function NotificationsProvider({ user, children }) {
  const [data, setData] = useState({ unread: 0, items: [] })
  const seen = useRef(null)
  const toast = useToast()

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const d = await api('/api/notifications')
      if (seen.current !== null) {
        const fresh = d.items.filter(n => !n.read && n.id > seen.current)
        if (fresh.length) {
          const n = fresh[0]
          toast(n.title, { body: n.body, tone: n.level === 'critical' ? 'error' : n.level === 'success' ? 'success' : n.level === 'warning' ? 'warning' : 'info' })
          try { Haptics.notificationAsync(n.level === 'critical' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success) } catch { /* no haptics */ }
        }
      }
      seen.current = Math.max(0, ...d.items.map(n => n.id))
      setData(d)
    } catch { /* offline – try again next tick */ }
  }, [user, toast])

  useEffect(() => {
    seen.current = null
    if (!user) return
    reload()
    const t = setInterval(reload, 12000)
    return () => clearInterval(t)
  }, [user, reload])

  const readAll = useCallback(async () => {
    try { await api('/api/notifications/read-all', { method: 'POST' }); reload() } catch { /* ignore */ }
  }, [reload])

  return <NotifCtx.Provider value={{ ...data, reload, readAll }}>{children}</NotifCtx.Provider>
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null })

  useEffect(() => {
    (async () => {
      await initServer()
      let session = null
      try { session = JSON.parse((await store.get('lc_session')) || 'null') } catch { /* corrupt */ }
      if (session?.token) {
        setToken(session.token)
        try {
          const user = await api('/api/auth/me') // validates the token with the server
          setState({ ready: true, user })
          return
        } catch (e) {
          if (e.status !== 401) { setState({ ready: true, user: session.user }); return } // offline: keep cached session
          setToken(null)
          await store.del('lc_session')
        }
      }
      setState({ ready: true, user: null })
    })()
  }, [])

  const signIn = useCallback(async res => {
    setToken(res.token)
    await store.set('lc_session', JSON.stringify({ token: res.token, user: res.user }))
    setState({ ready: true, user: res.user })
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) } catch { /* ignore */ }
    router.replace(ROLE_HOME[res.user.role])
  }, [])

  const signOut = useCallback(async () => {
    setToken(null)
    await store.del('lc_session')
    setState({ ready: true, user: null })
    router.replace('/login')
  }, [])

  useEffect(() => onUnauthorized(() => { signOut() }), [signOut])

  return (
    <AuthCtx.Provider value={{ ...state, signIn, signOut }}>
      <NotificationsProvider user={state.user}>{children}</NotificationsProvider>
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
export const useNotifications = () => useContext(NotifCtx)
