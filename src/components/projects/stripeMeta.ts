import patterns from '../../styles/patterns.module.css'
import type { ProjectColorKey } from '../../data'

// The stripe-pattern class for a project's own color, for default covers.
export const PROJECT_STRIPE_CLASS: Record<ProjectColorKey, string | undefined> = {
  prune: patterns.stripesProjectPrune,
  pervenche: patterns.stripesProjectPervenche,
  terracotta: patterns.stripesProjectTerracotta,
  peche: patterns.stripesProjectPeche,
  rouge: patterns.stripesProjectRouge,
  rose: patterns.stripesProjectRose,
}
