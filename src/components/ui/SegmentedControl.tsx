import styles from './SegmentedControl.module.css'

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  // Overrides the selected segment's color, e.g. a project's own color.
  accentColor?: string
  fullWidth?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  accentColor,
  fullWidth,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={[styles.segmented, fullWidth ? styles.fullWidth : undefined].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      style={accentColor ? ({ '--segmented-accent': accentColor } as React.CSSProperties) : undefined}
    >
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
