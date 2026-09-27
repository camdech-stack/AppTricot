import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './FollowGuideSheet.module.css'
import { Sheet } from '../ui'
import { useProjects } from '../../hooks/useProjects'
import type { FollowGuideSheetState } from '../../hooks/useFollowGuideFlow'

interface FollowGuideSheetProps {
  state: FollowGuideSheetState
  onClose: () => void
  onSelect: (projectId: string) => void
}

// "Suivre dans un projet" when the guide isn't linked to exactly one
// project already (see useFollowGuideFlow) — picks (and, in 'pickAny'
// mode, links) a project to follow the guide in.
export function FollowGuideSheet({ state, onClose, onSelect }: FollowGuideSheetProps) {
  const [query, setQuery] = useState('')
  const projects = useProjects() ?? []

  const candidates = state.mode === 'pickAny' ? projects : projects.filter((project) => state.linkedProjectIds.includes(project.id))

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return candidates
    return candidates.filter((project) => project.name.toLowerCase().includes(needle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, query])

  return (
    <Sheet open onClose={onClose} title={state.mode === 'pickAny' ? 'Associer à un projet pour le suivre' : 'Suivre dans quel projet ?'}>
      {candidates.length > 4 && (
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Rechercher un projet…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <div className={styles.list}>
        {filtered.map((project) => (
          <button key={project.id} type="button" className={styles.item} onClick={() => onSelect(project.id)}>
            {project.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className={styles.empty}>
            {state.mode === 'pickAny' ? (
              <>
                Aucun projet pour l’instant. <Link to="/projets/nouveau">Créer un projet</Link>
              </>
            ) : (
              'Aucun projet ne correspond.'
            )}
          </p>
        )}
      </div>
    </Sheet>
  )
}
