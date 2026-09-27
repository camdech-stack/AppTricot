import { Check } from 'lucide-react'
import styles from './LinkedCounterSheet.module.css'
import { Sheet } from '../../ui'
import type { CounterRecord } from '../../../data'

interface LinkedCounterSheetProps {
  open: boolean
  onClose: () => void
  counters: CounterRecord[]
  linkedCounterId: string | null
  onSelect: (counterId: string | null) => void
}

// "Compter aussi dans un compteur du projet" (see CLAUDE.md "Compteur
// intégré") — the rang shown on the follow screen IS the guide's own
// count; picking a counter here just mirrors +1/-1 onto it too.
export function LinkedCounterSheet({ open, onClose, counters, linkedCounterId, onSelect }: LinkedCounterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Compteur lié">
      <p className={styles.helper}>
        Ajoute +1 à ce compteur à chaque rang validé, et -1 en cas de retour. Le rang affiché ici reste toujours celui du guide.
      </p>
      <div className={styles.list}>
        <button
          type="button"
          className={linkedCounterId === null ? styles.itemActive : styles.item}
          onClick={() => {
            onSelect(null)
            onClose()
          }}
        >
          Aucun
          {linkedCounterId === null && <Check size={18} strokeWidth={1.75} />}
        </button>
        {counters.map((counter) => (
          <button
            key={counter.id}
            type="button"
            className={linkedCounterId === counter.id ? styles.itemActive : styles.item}
            onClick={() => {
              onSelect(counter.id)
              onClose()
            }}
          >
            {counter.name}
            {linkedCounterId === counter.id && <Check size={18} strokeWidth={1.75} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
