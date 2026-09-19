// Thin wrappers around lucide-react icons so every icon in the app shares
// the same stroke weight (1.75), instead of repeating the prop at each
// call site. Sizes stay consistent via the `size` prop: 20, 24 or 28.
import type { ComponentType } from 'react'
import {
  BarChart3,
  BookOpen,
  FolderOpen,
  Home,
  Settings,
  type LucideProps,
} from 'lucide-react'

const STROKE_WIDTH = 1.75

function withStroke(Icon: ComponentType<LucideProps>) {
  return function StrokedIcon(props: LucideProps) {
    return <Icon strokeWidth={STROKE_WIDTH} {...props} />
  }
}

export const HomeIcon = withStroke(Home)
export const ProjectsIcon = withStroke(FolderOpen)
export const PatternsIcon = withStroke(BookOpen)
export const StatsIcon = withStroke(BarChart3)
export const SettingsIcon = withStroke(Settings)

export type { LucideProps }
