interface WaveDividerProps {
  color?: string
  flip?: boolean
}

// A wavy seam between a colored header and the plain content below it,
// instead of a hard straight edge.
export function WaveDivider({ color = 'var(--color-bg)', flip = false }: WaveDividerProps) {
  return (
    <svg
      viewBox="0 0 120 16"
      preserveAspectRatio="none"
      width="100%"
      height="16"
      aria-hidden="true"
      style={{ display: 'block', transform: flip ? 'scaleY(-1)' : undefined }}
    >
      <path
        d="M0 8 C 15 16, 30 0, 45 8 C 60 16, 75 0, 90 8 C 100 13, 110 3, 120 8 L120 16 L0 16 Z"
        fill={color}
      />
    </svg>
  )
}
