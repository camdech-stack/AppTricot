import { useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import styles from './StepOverviewCard.module.css'
import { Pill } from '../../ui'
import type { StepOverviewEntry } from '../../../data'

interface StepOverviewCardProps {
  entries: StepOverviewEntry[]
}

// Collapsible, at-a-glance recap of the current répétition/passage's own
// steps, with the current one highlighted — purely informational (no
// action on tap): jumping around stays the Plan du guide's job, which
// covers the whole guide with lock states, not just this one block. See
// CLAUDE.md "Vue d'ensemble locale". Starts collapsed.
export function StepOverviewCard({ entries }: StepOverviewCardProps) {
  const [open, setOpen] = useState(false)
  if (entries.length === 0) return null

  return (
    <div className={styles.card}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <ListChecks size={18} strokeWidth={1.75} />
        <span className={styles.toggleLabel}>Aperçu du bloc</span>
        <Pill color="gold">
          {entries.length} étape{entries.length > 1 ? 's' : ''}
        </Pill>
        {open ? <ChevronUp size={18} strokeWidth={1.75} /> : <ChevronDown size={18} strokeWidth={1.75} />}
      </button>

      {open && (
        <div className={styles.list}>
          {entries.map((entry) => (
            <div key={entry.nodeId} className={entry.isCurrent ? styles.itemCurrent : styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemLabel}>{entry.label}</span>
                {entry.sideLabel && <Pill color={entry.sideLabel === 'rs' ? 'primary' : 'blue'}>{entry.sideLabel === 'rs' ? 'END' : 'ENV'}</Pill>}
                {entry.isCurrent && <Pill color="primary">Actuel</Pill>}
              </div>
              {entry.text && <p className={styles.itemText}>{entry.text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
