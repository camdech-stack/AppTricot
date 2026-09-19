import { Plus } from 'lucide-react'
import styles from './CounterCard.module.css'
import { Pill, StripedProgressBar } from '../ui'
import type { CounterRecord } from '../../data'

interface CounterCardProps {
  counter: CounterRecord
  onSelect: () => void
  onIncrement: () => void
}

export function CounterCard({ counter, onSelect, onIncrement }: CounterCardProps) {
  const goalReached = counter.goal != null && counter.value >= counter.goal

  return (
    <div
      className={goalReached ? styles.cardGoalReached : styles.card}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.name}>{counter.name}</span>
          <span className={styles.value}>
            {counter.value}
            {counter.goal != null && ` / ${counter.goal}`}
          </span>
        </div>
        <button
          type="button"
          className={styles.incrementButton}
          onClick={(event) => {
            event.stopPropagation()
            onIncrement()
          }}
          aria-label={`+1 sur ${counter.name}`}
        >
          <Plus size={20} strokeWidth={1.75} />
        </button>
      </div>
      {goalReached && <Pill color="sage">Objectif atteint</Pill>}
      {counter.goal != null && !goalReached && (
        <StripedProgressBar progress={counter.value / counter.goal} label={`Progression ${counter.name}`} />
      )}
    </div>
  )
}
