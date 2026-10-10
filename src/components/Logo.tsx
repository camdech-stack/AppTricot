import { useId } from 'react'
import styles from './Logo.module.css'
import { APP_NAME } from '../config/appInfo'

// The mark is also the source of public/favicon.svg and the PWA icons
// (cream ball on a raspberry square): keep the geometry in sync with them.
function LogoMark({ size }: { size: number }) {
  const clipId = `logo-ball-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={styles.mark} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="30" cy="31" r="22" />
        </clipPath>
      </defs>
      <circle cx="30" cy="31" r="22" fill="var(--color-primary)" />
      <g
        clipPath={`url(#${clipId})`}
        fill="none"
        stroke="var(--color-bg)"
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <g transform="rotate(-28 30 31)">
          <path d="M2 14Q30 26 58 14" />
          <path d="M2 23Q30 35 58 23" />
          <path d="M2 32Q30 44 58 32" />
          <path d="M2 41Q30 53 58 41" />
          <path d="M2 50Q30 62 58 50" />
        </g>
      </g>
      <path
        d="M41 50C49 58 55 49 59 56"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark size={32} />
      <span className={styles.name}>{APP_NAME}</span>
    </span>
  )
}
