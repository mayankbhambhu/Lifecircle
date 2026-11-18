import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, LogOut, Moon, Siren, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ROLE_LABEL, timeAgo } from '../api.js'
import { useAuth } from '../auth.jsx'
import Logo from './Logo.jsx'
import { Avatar, Page, useToast } from './ui.jsx'

const LEVEL_ICON = { critical: Siren, warning: AlertTriangle, success: CheckCircle2, info: Info }
const LEVEL_COLOR = { critical: 'var(--crit)', warning: 'var(--warn)', success: 'var(--ok)', info: 'var(--info)' }

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('lc_theme') || '' } catch { return '' } })
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    try { localStorage.setItem('lc_theme', theme) } catch { /* ignore */ }
  }, [theme])
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return [dark, () => setTheme(dark ? 'light' : 'dark')]
}

function Bell_({ onNew }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ unread: 0, items: [] })
  const seen = useRef(null)
  const toast = useToast()
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const d = await api('/api/notifications')
      if (seen.current !== null) {
        const fresh = d.items.filter(n => !n.read && n.id > seen.current)
        fresh.slice(0, 2).forEach(n => toast(n.title, { tone: n.level === 'critical' ? 'error' : n.level === 'success' ? 'success' : n.level === 'warning' ? 'warning' : 'info', body: n.body }))
        if (fresh.length) onNew?.()
      }
      seen.current = Math.max(0, ...d.items.map(n => n.id))
      setData(d)
    } catch { /* offline */ }
  }, [toast, onNew])

  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const readAll = async () => { await api('/api/notifications/read-all', { method: 'POST' }); load() }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn icon-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        <motion.span animate={data.unread ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.8, repeat: data.unread ? Infinity : 0, repeatDelay: 4 }} style={{ display: 'grid' }}>
          <Bell size={18} />
        </motion.span>
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="popover" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
            <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <b>Notifications</b>
              <button className="btn sm ghost" onClick={readAll}><CheckCheck size={14} /> Mark all read</button>
            </div>
            {data.items.length === 0 && <div className="faint center" style={{ padding: 24 }}>You're all caught up.</div>}
            {data.items.map(n => {
              const I = LEVEL_ICON[n.level] || Info
              return (
                <div key={n.id} className={`notif ${n.read ? '' : 'unread'}`}>
                  <I size={18} color={LEVEL_COLOR[n.level]} style={{ flex: 'none', marginTop: 2 }} />
                  <div className="grow">
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{n.title}</div>
                    <div className="faint">{n.body}</div>
                    <div className="tiny" style={{ color: 'var(--text-3)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Shell({ title, subtitle, tabs = [], tab, onTab, actions, children, onNotification }) {
  const { user, signOut } = useAuth()
  const [dark, toggleTheme] = useTheme()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><Logo size={30} animated /> LifeCircle</div>
        {tabs.map(t => (
          <button key={t.value} className={`nav-item ${tab === t.value ? 'active' : ''}`} onClick={() => onTab(t.value)}>
            {tab === t.value && <motion.span layoutId="navbg" className="nav-bg" transition={{ type: 'spring', damping: 30, stiffness: 380 }} />}
            <t.icon size={18} /> <span>{t.label}</span>
            {t.count ? <span className="nav-count">{t.count}</span> : null}
          </button>
        ))}
        <div className="side-foot col" style={{ gap: 10 }}>
          <div className="row">
            <Avatar name={user?.name} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div className="faint">{ROLE_LABEL[user?.role]}</div>
            </div>
          </div>
          <div className="row">
            <button className="btn sm grow" onClick={signOut}><LogOut size={14} /> Sign out</button>
            <button className="btn sm" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="grow">
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="role-chip">{ROLE_LABEL[user?.role]}</span>
            </div>
            <h1>{title}</h1>
            {subtitle && <div className="muted small" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div className="row">
            {actions}
            <Bell_ onNew={onNotification} />
            <button className="btn icon-btn only-sm" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
        <Page key={tab}>{children}</Page>
      </main>
      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.value} className={tab === t.value ? 'active' : ''} onClick={() => onTab(t.value)}>
            <t.icon size={20} />{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
