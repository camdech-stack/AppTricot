import type { CSSProperties } from 'react'
import styles from './BarHistogram.module.css'

export interface HistogramBar {
  key: string
  label: string
  value: number
  // Tooltip text.
  title?: string
}

interface BarHistogramProps {
  bars: HistogramBar[]
  ariaLabel: string
  accentColor?: string
  // Shrinks bars to fit the width (no horizontal scroll) and only labels
  // every `labelStep`-th bar — for charts with many bars, like a month by day.
  fit?: boolean
  labelStep?: number
}

export function BarHistogram({ bars, ariaLabel, accentColor, fit, labelStep = 1 }: BarHistogramProps) {
  const max = Math.max(1, ...bars.map((bar) => bar.value))

  return (
    <div
      className={[styles.histogram, fit ? styles.fit : undefined].filter(Boolean).join(' ')}
      role="img"
      aria-label={ariaLabel}
      style={accentColor ? ({ '--histogram-accent': accentColor } as CSSProperties) : undefined}
    >
      {bars.map((bar, index) => (
        <div key={bar.key} className={styles.bar} title={bar.title}>
          <div className={styles.barFill} style={{ height: `${Math.max(bar.value > 0 ? 4 : 1, (bar.value / max) * 100)}%` }} />
          <span className={styles.barLabel}>{index % labelStep === 0 ? bar.label : ''}</span>
        </div>
      ))}
    </div>
  )
}
