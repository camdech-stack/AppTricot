import { useMemo, useState } from 'react'
import styles from './AssociateProjectSheet.module.css'
import { Sheet } from '../ui'
import { linkPatternToProject, type ProjectRecord } from '../../data'

interface AssociateProjectSheetProps {
  open: boolean
  onClose: () => void
  patternId: string
  // Projects not already linked to this pattern.
  candidates: ProjectRecord[]
}

export function AssociateProjectSheet({ open, onClose, patternId, candidates }: AssociateProjectSheetProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return candidates
    return candidates.filter((project) => project.name.toLowerCase().includes(needle))
  }, [candidates, query])

  async function handleSelect(projectId: string) {
    await linkPatternToProject(projectId, patternId)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Associer à un projet">
      <input
        className={styles.searchInput}
        type="search"
        placeholder="Rechercher un projet…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.list}>
        {filtered.map((project) => (
          <button key={project.id} type="button" className={styles.item} onClick={() => void handleSelect(project.id)}>
            {project.name}
          </button>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>Aucun projet ne correspond.</p>}
      </div>
    </Sheet>
  )
}
