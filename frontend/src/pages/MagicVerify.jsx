import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Logo from '../components/Logo.jsx'

export default function MagicVerify() {
  const [sp] = useSearchParams()
  const [error, setError] = useState(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true // the token is single-use; StrictMode would otherwise verify twice
    api('/api/auth/magic/verify', { method: 'POST', body: { token: sp.get('token') || '' } })
      .then(res => {
        if (res.status === 'signed_in') signIn(res)
        else { sessionStorage.setItem('lc_onboarding', JSON.stringify(res)); navigate('/onboarding', { replace: true }) }
      })
      .catch(e => setError(e.message))
  }, [sp, signIn, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <motion.div className="card center col" style={{ alignItems: 'center', width: 'min(420px, 100%)', padding: 36 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        {error ? (
          <>
            <XCircle size={44} color="var(--crit)" />
            <h2>Link didn't work</h2>
            <p className="muted">{error}</p>
            <Link className="btn primary" to="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <Logo size={64} animated />
            <h2>Signing you in…</h2>
            <p className="muted">Verifying your magic link.</p>
          </>
        )}
      </motion.div>
    </div>
  )
}
