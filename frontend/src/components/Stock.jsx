import { motion } from 'framer-motion'
import { AlertTriangle, Droplets, Megaphone, Siren } from 'lucide-react'
import { Badge } from './ui.jsx'

export function StockTubes({ stock, onSelect }) {
  return (
    <div className="stock-grid">
      {stock.map((s, i) => {
        const pct = Math.max(4, s.fill_pct)
        const thr = Math.min(100, Math.round(100 * s.min_threshold / Math.max(1, s.min_threshold * 2)))
        return (
          <button key={s.blood_group} className="stock-col" onClick={() => onSelect?.(s)} style={{ border: 0, background: 'none', cursor: onSelect ? 'pointer' : 'default', padding: 0 }}
            title={`${s.blood_group}: ${s.units} units · ${s.days_of_cover ?? '–'} days of cover`}>
            <div className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{s.units}</div>
            <div className="stock-tube">
              <motion.div className={`stock-fill ${s.status}`} initial={{ height: 0 }} animate={{ height: `${pct}%` }}
                transition={{ duration: 1.1, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
                <div className="wave" />
              </motion.div>
              <div className="stock-threshold" style={{ bottom: `${thr}%` }} />
            </div>
            <div className="blood">{s.blood_group}</div>
            <div className="tiny" style={{ color: s.status === 'healthy' ? 'var(--text-3)' : s.status === 'low' ? 'var(--warn)' : 'var(--crit)', fontWeight: 700 }}>
              {s.days_of_cover != null ? `${s.days_of_cover}d` : '—'}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function StockAlerts({ alerts, onRally, busy }) {
  if (!alerts.length) return (
    <div className="banner ok"><Droplets size={18} color="var(--ok)" /><div><b>All blood groups above safety levels.</b></div></div>
  )
  return (
    <div className="col" style={{ gap: 10 }}>
      {alerts.map((a, i) => (
        <motion.div key={a.blood_group} className={`banner ${a.status === 'critical' ? 'crit' : 'warn'}`}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
          {a.status === 'critical'
            ? <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} style={{ display: 'grid' }}><Siren size={18} color="var(--crit)" /></motion.span>
            : <AlertTriangle size={18} color="var(--warn)" />}
          <div className="grow">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="blood">{a.blood_group}</span>
              <Badge tone={a.status === 'critical' ? 'crit' : 'warn'}>{a.status.toUpperCase()}</Badge>
            </div>
            <div className="small" style={{ marginTop: 4 }}>{a.message}</div>
          </div>
          {onRally && (
            <button className="btn sm" disabled={busy === a.blood_group} onClick={() => onRally(a.blood_group)}>
              <Megaphone size={14} /> Rally donors
            </button>
          )}
        </motion.div>
      ))}
    </div>
  )
}
