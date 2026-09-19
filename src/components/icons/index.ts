import type { ComponentType, SVGProps } from 'react'

export { HomeIcon, ProjectsIcon, PatternsIcon, StatsIcon, SettingsIcon } from './lucide'
export { YarnBallIcon } from './YarnBallIcon'

// Common shape shared by every icon in this set (lucide wrappers and the
// custom YarnBallIcon alike), so call sites can accept any of them
// interchangeably — see components/layout/navItems.ts.
export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
