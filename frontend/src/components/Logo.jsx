import { motion } from 'framer-motion'

export default function Logo({ size = 32, animated = false, light = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`lg${light ? 'l' : ''}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light ? '#ffffff' : '#fb7185'} />
          <stop offset="1" stopColor={light ? '#ffe4e8' : '#be123c'} />
        </linearGradient>
      </defs>
      <motion.circle cx="32" cy="32" r="28" fill="none" stroke={`url(#lg${light ? 'l' : ''})`} strokeWidth="5" strokeLinecap="round"
        strokeDasharray="150 26" style={{ originX: '50%', originY: '50%' }}
        animate={animated ? { rotate: 360 } : undefined} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }} />
      <motion.path d="M32 14c6 9 12 15 12 23a12 12 0 0 1-24 0c0-8 6-14 12-23z" fill={`url(#lg${light ? 'l' : ''})`}
        animate={animated ? { scale: [1, 1.08, 1] } : undefined} style={{ originX: '50%', originY: '60%' }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} />
    </svg>
  )
}
