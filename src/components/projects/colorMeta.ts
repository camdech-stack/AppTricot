import type { ProjectColorKey } from '../../data'

export function projectColorVar(colorKey: ProjectColorKey): string {
  return `var(--color-project-${colorKey})`
}

export function projectColorSoftVar(colorKey: ProjectColorKey): string {
  return `var(--color-project-${colorKey}-soft)`
}

// A two-tone gradient in the project's own color, echoing --gradient-hero's
// look without needing a "-strong" token per project color.
export function projectGradient(colorKey: ProjectColorKey): string {
  const color = projectColorVar(colorKey)
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, black))`
}
