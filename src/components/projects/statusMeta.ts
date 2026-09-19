import type { ProjectCraft, ProjectStatus } from '../../data'
import type { PillColor } from '../ui'

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  paused: 'En pause',
  done: 'Terminé',
}

export const STATUS_PILL_COLORS: Record<ProjectStatus, PillColor> = {
  todo: 'gold',
  in_progress: 'primary',
  paused: 'blue',
  done: 'sage',
}

// Filter pill order on the projects list, "Tous" is handled separately.
export const STATUS_FILTER_ORDER: ProjectStatus[] = ['in_progress', 'paused', 'todo', 'done']

export const CRAFT_LABELS: Record<ProjectCraft, string> = {
  knitting: 'Tricot',
  crochet: 'Crochet',
}
