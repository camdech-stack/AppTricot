import type { CSSProperties } from 'react'
import styles from './ProgressRing.module.css'

interface ProgressRingProps {
  progress: number // 0 to 1
  size?: number
  strokeWidth?: number
  label?: string
  // Overrides the default raspberry ring, e.g. for a project's own color.
  color?: string
  trackColor?: string
}

export function ProgressRing({ progress, size = 64, strokeWidth = 8, label, color, trackColor }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const ringVars = {
    width: size,
    height: size,
    '--ring-color': color,
    '--ring-track-color': trackColor,
  } as CSSProperties

  return (
    <div className={styles.wrap} style={ringVars}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={styles.track}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={styles.progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label !== undefined && <span className={styles.label}>{label}</span>}
    </div>
  )
}
