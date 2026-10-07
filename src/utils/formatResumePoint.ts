import type { CursorDescription } from '../data'

// "Dos · Rang 12": where a guide stands, for the project page and the home
// quick-resume cards.
export function formatResumePoint(description: CursorDescription): string {
  return [description.pieceName, description.rowLabel ?? description.blockLabel].filter(Boolean).join(' · ')
}
