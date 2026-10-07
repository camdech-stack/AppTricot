import type { ContinueTarget } from '../../data'

// Where "Continuer" (project page) and "Reprendre" (home) take a project:
// a linked guide always comes first (its follow screen), then the work view
// when a pattern is linked (it reopens on the last used tab), else the
// counter screen.
export function getContinueRoute(projectId: string, target: ContinueTarget): string {
  if (target.guideId) return `/projets/${projectId}/guides/${target.guideId}/suivre`
  if (target.hasPatterns) return `/projets/${projectId}/travail`
  return `/projets/${projectId}/compteur`
}
