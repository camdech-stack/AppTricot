import { useMemo, useState } from 'react'
import styles from './AssociatePatternSheet.module.css'
import { Sheet } from '../ui'
import { linkPatternToProject, type PatternRecord } from '../../data'

interface AssociatePatternSheetProps {
  open: boolean
  onClose: () => void
  projectId: string
  // Patterns not already linked to this project.
  candidates: PatternRecord[]
}

export function AssociatePatternSheet({ open, onClose, projectId, candidates }: AssociatePatternSheetProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return candidates
    return candidates.filter((pattern) => pattern.name.toLowerCase().includes(needle) || pattern.tags.some((tag) => tag.toLowerCase().includes(needle)))
  }, [candidates, query])

  async function handleSelect(patternId: string) {
    await linkPatternToProject(projectId, patternId)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Associer un patron">
      <input
        className={styles.searchInput}
        type="search"
        placeholder="Rechercher un patron…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.list}>
        {filtered.map((pattern) => (
          <button key={pattern.id} type="button" className={styles.item} onClick={() => void handleSelect(pattern.id)}>
            <span className={styles.itemName}>{pattern.name}</span>
            <span className={styles.itemMeta}>{pattern.pageCount} pages</span>
          </button>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>Aucun patron ne correspond.</p>}
      </div>
    </Sheet>
  )
}
