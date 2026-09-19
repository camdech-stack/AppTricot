import styles from './HistorySheet.module.css'
import { Sheet } from '../ui'
import type { CounterEventRecord } from '../../data'

const TYPE_LABELS: Record<CounterEventRecord['type'], string> = {
  increment: 'Incrément',
  decrement: 'Décrément',
  reset: 'Remise à zéro',
  set: 'Valeur définie',
}

interface HistorySheetProps {
  open: boolean
  onClose: () => void
  events: CounterEventRecord[]
}

export function HistorySheet({ open, onClose, events }: HistorySheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Historique">
      {events.length === 0 ? (
        <p className={styles.empty}>Aucun événement pour l'instant.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id} className={event.undoneAt ? styles.rowUndone : styles.row}>
              <span className={styles.time}>
                {new Date(event.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>{TYPE_LABELS[event.type]}</span>
              <span className={styles.delta}>{event.delta > 0 ? `+${event.delta}` : event.delta}</span>
              <span className={styles.values}>
                {event.valueBefore} → {event.valueAfter}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
