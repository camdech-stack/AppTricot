import type { SVGProps } from 'react'

// Custom "pelote de laine" icon (lucide-react has none): same stroke
// language as the rest of the icon set (1.75, round caps, currentColor),
// used for the Laine tab and the provisional Logo.
export function YarnBallIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="13" r="7" />
      {/* Three asymmetric wound bands, deliberately not aligned like a
          globe's equator/meridians. */}
      <path d="M3.5 10.8c3.7 2 9.3 2 13 0" />
      <path d="M4.3 17c3.4-2.6 8.8-2.6 12 0" />
      <path d="M7.7 6.6c2.3 3.3 2.3 12.4 0 15.8" transform="rotate(-16 10 13)" />
      {/* Loose end escaping the ball, curling at the tip — the detail that
          reads as yarn rather than a globe grid. */}
      <path d="M15.3 17.6c2 1.5 3.9 2.6 5.1 4.3" />
      <path d="M20.6 22.3c.7-.3.9-1 .5-1.7" />
    </svg>
  )
}
