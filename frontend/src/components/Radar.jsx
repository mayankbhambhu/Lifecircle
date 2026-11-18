import { motion } from 'framer-motion'
import { Hospital } from 'lucide-react'

/** Urgent-mode visual: blood bank in the centre, alerted donors as blips by distance. */
export default function Radar({ alerts = [], radius = 5 }) {
  const max = Math.max(radius || 5, ...alerts.map(a => a.distance_km || 0), 1)
  const rings = [0.33, 0.66, 1]
  const color = s => s === 'accepted' ? 'var(--ok)' : s === 'declined' || s === 'closed' ? 'var(--text-3)' : 'var(--rose-500)'
  return (
    <div className="radar">
      <div className="sweep" />
      {rings.map(r => (
        <div key={r} className="ring" style={{ width: `${r * 100}%`, height: `${r * 100}%` }}>
          <span>{(max * r).toFixed(max * r < 10 ? 1 : 0)} km</span>
        </div>
      ))}
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="pulse" initial={{ scale: 0.5, opacity: 0.5 }} animate={{ scale: 9, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 3, delay: i, ease: 'easeOut' }} />
      ))}
      <div className="center"><Hospital size={12} /></div>
      {alerts.map((a, i) => {
        const ang = ((a.donor_id ?? a.id ?? i) * 137.5) * Math.PI / 180
        const d = Math.min(1, (a.distance_km || 0) / max) * 46
        return (
          <motion.div key={a.alert_id ?? i} className="blip" title={`${a.display_name} · ${a.distance}`}
            style={{ left: `${50 + d * Math.cos(ang)}%`, top: `${50 + d * Math.sin(ang)}%`, background: color(a.status), boxShadow: a.status === 'accepted' ? '0 0 0 6px rgba(5,150,105,.25)' : undefined }}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.08, type: 'spring' }} />
        )
      })}
    </div>
  )
}
