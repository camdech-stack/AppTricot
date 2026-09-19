// Minimal hand-drawn line icons, kept in one file to avoid pulling in an
// icon library. All use currentColor so they follow the surrounding text
// color (including the active tab / theme colors).
import { useId, type SVGProps } from 'react'

const defaults: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <polyline points="3 11 12 4 21 11" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  )
}

export function ProjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <rect x="4" y="4" width="16" height="4" rx="1.2" />
      <rect x="4" y="10" width="16" height="4" rx="1.2" />
      <rect x="4" y="16" width="10" height="4" rx="1.2" />
    </svg>
  )
}

export function PatternsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 6c-2.2-1.3-5-1.5-8-.6v13c3-.9 5.8-.7 8 .6" />
      <path d="M12 6c2.2-1.3 5-1.5 8-.6v13c-3-.9-5.8-.7-8 .6" />
      <line x1="12" y1="6" x2="12" y2="19" />
    </svg>
  )
}

export function YarnIcon(props: SVGProps<SVGSVGElement>) {
  const clipId = useId()
  return (
    <svg {...defaults} {...props}>
      <clipPath id={clipId}>
        <circle cx="12" cy="12" r="8" />
      </clipPath>
      <circle cx="12" cy="12" r="8" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M5 9c3.5 1.3 10.5 1.3 14 0" />
        <path d="M4 14c4.5 2 11.5 2 16 0" />
        <path d="M9 4c1.5 3.5 1.5 12.5 0 16" />
      </g>
    </svg>
  )
}

export function StatsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} strokeWidth={2.4} {...props}>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </svg>
  )
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2.4 3.4" />
    </svg>
  )
}
