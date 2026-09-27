import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGuideProjectLinks, linkGuideToProject } from '../data'

export interface FollowGuideSheetState {
  guideId: string
  // 'pickAny': the guide isn't linked to any project yet — pick (and link)
  // one from every project. 'pickLinked': the guide is linked to several
  // projects — pick which one to follow it in.
  mode: 'pickAny' | 'pickLinked'
  linkedProjectIds: string[]
}

// "Suivre dans un projet", from the guide list or the editor's menu (see
// CLAUDE.md "Écran de départ") — direct navigation when the guide has
// exactly one linked project, a picker sheet otherwise.
export function useFollowGuideFlow() {
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<FollowGuideSheetState | null>(null)

  async function startFollow(guideId: string) {
    const links = await getGuideProjectLinks(guideId)
    if (links.length === 1) {
      navigate(`/projets/${links[0]!.projectId}/guides/${guideId}/suivre`)
      return
    }
    if (links.length === 0) {
      setSheet({ guideId, mode: 'pickAny', linkedProjectIds: [] })
      return
    }
    setSheet({ guideId, mode: 'pickLinked', linkedProjectIds: links.map((link) => link.projectId) })
  }

  async function followInProject(projectId: string) {
    if (!sheet) return
    if (sheet.mode === 'pickAny') {
      await linkGuideToProject(projectId, sheet.guideId)
    }
    navigate(`/projets/${projectId}/guides/${sheet.guideId}/suivre`)
    setSheet(null)
  }

  return { sheet, startFollow, followInProject, closeSheet: () => setSheet(null) }
}
