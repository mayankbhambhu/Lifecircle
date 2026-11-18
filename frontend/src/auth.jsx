import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSession, saveSession } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)
  const navigate = useNavigate()

  const signIn = useCallback(res => {
    const s = { token: res.token, user: res.user }
    saveSession(s)
    setSession(s)
    navigate(res.home || res.user.home, { replace: true })
  }, [navigate])

  const signOut = useCallback(() => {
    saveSession(null)
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    const h = () => signOut()
    window.addEventListener('lc:unauthorized', h)
    return () => window.removeEventListener('lc:unauthorized', h)
  }, [signOut])

  return <AuthCtx.Provider value={{ user: session?.user, token: session?.token, signIn, signOut }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
