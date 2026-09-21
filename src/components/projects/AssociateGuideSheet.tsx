import { useMemo, useState } from 'react'
import styles from './AssociatePatternSheet.module.css'
import { Sheet } from '../ui'
import { linkGuideToProject, type GuideRecord } from '../../data'

interface AssociateGuideSheetProps {
  open: boolean
  onClose: () => void
  projectId: string
  // Guides not already linked to this project.
  candidates: GuideRecord[]
}

export function AssociateGuideSheet({ open, onClose, projectId, candidates }: AssociateGuideSheetProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return candidates
    return candidates.filter((guide) => guide.name.toLowerCase().includes(needle))
  }, [candidates, query])

  async function handleSelect(guideId: string) {
    await linkGuideToProject(projectId, guideId)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Associer un guide">
      <input
        className={styles.searchInput}
        type="search"
        placeholder="Rechercher un guide…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.list}>
        {filtered.map((guide) => (
          <button key={guide.id} type="button" className={styles.item} onClick={() => void handleSelect(guide.id)}>
            <span className={styles.itemName}>{guide.name}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>Aucun guide ne correspond.</p>}
      </div>
    </Sheet>
  )
}
