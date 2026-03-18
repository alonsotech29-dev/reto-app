'use client'

import { motion } from 'framer-motion'

interface Props {
  consumed: number
  target: number
  size?: number
}

export default function CalorieChart({ consumed, target, size = 160 }: Props) {
  const over = Math.max(consumed - target, 0)
  const percent = Math.min(Math.round((consumed / target) * 100), 999)
  const clampedPercent = Math.min(percent, 100)

  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedPercent / 100) * circumference

  const ringColor = over > 0 ? '#ef4444' : '#84cc16'
  const trackColor = 'rgba(255,255,255,0.06)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-3xl font-bold font-heading ${over > 0 ? 'text-danger' : 'text-foreground'}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {percent}%
        </motion.span>
        <span className="text-xs text-muted">
          {over > 0 ? 'excedido' : 'consumido'}
        </span>
      </div>
    </div>
  )
}
