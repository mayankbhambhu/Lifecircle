import { AnimatePresence, animate, motion, useInView } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
}

export function Page({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  )
}

export function Card({ children, className = '', i = 0, style, ...rest }) {
  return (
    <motion.div className={`card ${className}`} variants={fadeUp} initial="hidden" animate="show" custom={i} style={style} {...rest}>
      {children}
    </motion.div>
  )
}

export function CardTitle({ icon: Icon, title, sub, right }) {
  return (
    <div className="card-title">
      <div className="row grow">
        {Icon && <div className="ico"><Icon size={18} /></div>}
        <div className="grow">
          <h3>{title}</h3>
          {sub && <div className="faint">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

const AV = [['#fb7185', '#e11d48'], ['#a78bfa', '#7c3aed'], ['#60a5fa', '#2563eb'], ['#34d399', '#059669'], ['#fbbf24', '#d97706'], ['#f472b6', '#db2777'], ['#2dd4bf', '#0d9488']]
export function Avatar({ name = '?', size = '' }) {
  const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [a, b] = AV[h % AV.length]
  return <div className={`avatar ${size}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>{initials || '?'}</div>
}

export function Badge({ tone = '', children, dot }) {
  return <span className={`badge ${tone}`}>{dot && <span className="dot" />}{children}</span>
}

export const STATUS_TONE = {
  attending: 'ok', confirmed: 'ok', donated: 'ok', filled: 'ok', stock_fulfilled: 'ok', scheduled: 'ok', completed: 'ok', healthy: 'ok', accepted: 'ok',
  pending: 'warn', awaiting_bank: 'warn', planned: 'info', awaiting_donor: 'warn', low: 'warn', circle: 'warn', deferred: 'warn',
  broadcast: 'crit', uncovered: 'crit', critical: 'crit', no_match: 'crit', no_show: 'crit', cancelled: '', excused: 'info', closed: '', declined: '', released: '', rerouted: 'info', sent: 'rose',
}
export const STATUS_LABEL = {
  attending: 'Confirmed', pending: 'Awaiting reply', awaiting_bank: 'Awaiting bank', scheduled: 'Slot booked', circle: 'Alerting circle',
  broadcast: 'Broadcasting nearby', filled: 'Filled', stock_fulfilled: 'From stock', no_match: 'No match', no_show: 'No-show',
  awaiting_donor: 'Awaiting donor', uncovered: 'Uncovered', planned: 'Planned', confirmed: 'Confirmed', sent: 'New', closed: 'Closed', released: 'Released',
  accepted: 'Accepted', declined: 'Declined', donated: 'Donated', deferred: 'Deferred', excused: 'Excused', cancelled: 'Cancelled', completed: 'Completed',
}
export function Status({ s }) {
  return <Badge tone={STATUS_TONE[s] ?? ''} dot>{STATUS_LABEL[s] ?? s?.replace(/_/g, ' ')}</Badge>
}

export function AnimatedNumber({ value, decimals = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView || value == null) return
    const c = animate(0, value, { duration: 1.2, ease: 'easeOut', onUpdate: v => { if (ref.current) ref.current.textContent = v.toFixed(decimals) } })
    return () => c.stop()
  }, [inView, value, decimals])
  return <span ref={ref} className="mono">0</span>
}

export function Modal({ open, onClose, children, title }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div className="modal" initial={{ y: 30, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="row between" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 19 }}>{title}</h3>
              <button className="btn ghost icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Seg({ value, onChange, options, layoutId = 'seg' }) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={value === o.value}>
          {value === o.value && <motion.span layoutId={layoutId} className="pill" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
          {o.icon && <o.icon size={15} />}{o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon: Icon = Info, title, sub }) {
  return (
    <div className="center col" style={{ alignItems: 'center', padding: '26px 10px', gap: 8 }}>
      <div className="ico" style={{ width: 48, height: 48, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--bg-2)', color: 'var(--text-3)' }}><Icon size={22} /></div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {sub && <div className="faint">{sub}</div>}
    </div>
  )
}

export function Skeleton({ h = 120 }) {
  return <div className="skeleton" style={{ height: h }} />
}

export function Loading() {
  return (
    <div className="grid g3">
      <Skeleton h={220} /><Skeleton h={220} /><Skeleton h={220} />
      <div style={{ gridColumn: '1 / -1' }}><Skeleton h={260} /></div>
    </div>
  )
}

/* ---------------------------------------------------------------- toasts */
const ToastCtx = createContext(() => {})
const ICON = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const COLOR = { success: 'var(--ok)', error: 'var(--crit)', warning: 'var(--warn)', info: 'var(--info)' }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((title, { tone = 'success', body, ms = 4200 } = {}) => {
    const id = Math.random().toString(36).slice(2)
    setItems(x => [...x, { id, title, body, tone }])
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), ms)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map(t => {
            const I = ICON[t.tone] || Info
            return (
              <motion.div key={t.id} className="toast" layout initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}>
                <I size={20} color={COLOR[t.tone]} style={{ flex: 'none', marginTop: 1 }} />
                <div className="grow"><div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>{t.body && <div className="faint">{t.body}</div>}</div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/** Run an async action with toast feedback and a busy flag. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const run = useCallback(async (key, fn, success) => {
    setBusy(key)
    try {
      const r = await fn()
      if (success) toast(typeof success === 'function' ? success(r) : success)
      return r
    } catch (e) {
      toast(e.message, { tone: 'error' })
      return null
    } finally {
      setBusy(null)
    }
  }, [toast])
  return [busy, run]
}
