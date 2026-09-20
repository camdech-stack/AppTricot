import { forwardRef, useImperativeHandle, useState } from 'react'
import { Pause, Play, Plus, RotateCcw, Target, Undo2 } from 'lucide-react'
import styles from './CounterPanel.module.css'
import { IconButton, Pill, StripedProgressBar, ConfirmDialog } from '../ui'
import { CounterCard } from './CounterCard'
import { CounterMenuSheet } from './CounterMenuSheet'
import { TextPromptSheet } from './TextPromptSheet'
import { GoalSheet } from './GoalSheet'
import { SetValueSheet } from './SetValueSheet'
import { HistorySheet } from './HistorySheet'
import { SessionHistorySheet } from '../sessions/SessionHistorySheet'
import { useCounters } from '../../hooks/useCounters'
import { useCounter } from '../../hooks/useCounter'
import { useCounterEvents } from '../../hooks/useCounterEvents'
import { useRelativeTime } from '../../hooks/useRelativeTime'
import { useCounterChrono } from '../../hooks/useCounterChrono'
import { useSettings } from '../../hooks/useSettings'
import { formatClockDuration, formatDuration } from '../../utils/formatDuration'
import {
  addCounter,
  applyCounterDelta,
  deleteCounter,
  renameCounter,
  resetCounter,
  setCounterGoal,
  setCounterValue,
  undoLastEvent,
  updateProject,
  type ProjectRecord,
} from '../../data'

type ActiveSheet =
  | 'menu'
  | 'rename'
  | 'addCounter'
  | 'goal'
  | 'setValue'
  | 'history'
  | 'sessionHistory'
  | 'resetConfirm'
  | 'deleteConfirm'
  | null

interface CounterPanelProps {
  projectId: string | null
  // undefined for the standalone counter.
  project: ProjectRecord | undefined
  isStandalone: boolean
}

// Lets a page's own header (e.g. CounterPage's gear icon) open the counter
// menu sheet without lifting all of CounterPanel's sheet state out of it.
export interface CounterPanelHandle {
  openMenu: () => void
}

// The counter UI and its transactional logic (+1/-1/+5/annulation/objectif/
// historique/chrono), extracted so the standalone counter screen and the
// project work view (step 4) share the exact same behavior — see CLAUDE.md
// "Vue de travail d'un projet".
export const CounterPanel = forwardRef<CounterPanelHandle, CounterPanelProps>(function CounterPanel(
  { projectId, project, isStandalone },
  ref,
) {
  const counters = useCounters(projectId)
  const settings = useSettings()
  const chrono = useCounterChrono({ projectId }, 'counter')

  const mainCounter = counters?.find((counter) => counter.isMain)
  const activeCounterId = isStandalone ? counters?.[0]?.id : (project?.activeCounterId ?? mainCounter?.id)
  const activeCounter = useCounter(activeCounterId)
  const otherCounters = (counters ?? []).filter((counter) => counter.id !== activeCounterId)

  const lastTapped = useRelativeTime(activeCounter?.lastTappedAt)
  const [sheet, setSheet] = useState<ActiveSheet>(null)
  const closeSheet = () => setSheet(null)

  useImperativeHandle(ref, () => ({ openMenu: () => setSheet('menu') }), [])

  const events = useCounterEvents(sheet === 'history' ? activeCounter?.id : undefined)

  function handleDelta(delta: number) {
    if (!activeCounter) return
    void applyCounterDelta(activeCounter.id, delta)
  }

  function handleSelectCounter(counterId: string) {
    if (!projectId) return
    void updateProject(projectId, { activeCounterId: counterId })
  }

  const goalReached = activeCounter?.goal != null && activeCounter.value >= activeCounter.goal

  return (
    <div className={styles.scrollArea}>
      <div className={styles.countingZone}>
        <div className={goalReached ? styles.centralCardGoalReached : styles.centralCard}>
          <div className={styles.counterName}>{activeCounter?.name ?? '…'}</div>
          <div key={activeCounter?.value ?? 0} className={styles.bigNumber}>
            {activeCounter?.value ?? 0}
          </div>
          {lastTapped && <div className={styles.lastTap}>Dernier appui : {lastTapped}</div>}
          {settings?.trackingEnabled !== false && (
            <button
              type="button"
              className={chrono.running ? styles.chronoButtonRunning : styles.chronoButton}
              onClick={chrono.toggle}
              aria-label={chrono.running ? `En cours : ${formatDuration(chrono.elapsedMs)}, arrêter le chrono` : chrono.label}
            >
              {chrono.running ? (
                <>
                  <span className={styles.chronoDot} aria-hidden="true" />
                  <span>En cours : {formatClockDuration(chrono.elapsedMs)}</span>
                  <Pause size={18} strokeWidth={1.75} />
                </>
              ) : (
                <>
                  <Play size={18} strokeWidth={1.75} />
                  <span>{chrono.label}</span>
                </>
              )}
            </button>
          )}
          {activeCounter?.goal != null && (
            <div className={styles.goalBlock}>
              <div className={styles.goalText}>
                {activeCounter.value} / {activeCounter.goal}
              </div>
              <StripedProgressBar
                progress={activeCounter.value / activeCounter.goal}
                projectColor={project?.colorKey}
                label="Progression vers l'objectif"
              />
            </div>
          )}
          {goalReached && <Pill color="sage">Objectif atteint</Pill>}
          <button type="button" className={styles.undoButton} onClick={() => activeCounter && void undoLastEvent(activeCounter.id)}>
            <Undo2 size={18} strokeWidth={1.75} />
            Annuler
          </button>
        </div>

        <div className={styles.buttonsRow}>
          <button
            type="button"
            className={styles.minusButton}
            disabled={!activeCounter || activeCounter.value === 0}
            onClick={() => handleDelta(-1)}
          >
            -1
          </button>
          <button type="button" className={styles.plusButton} onClick={() => handleDelta(1)}>
            +1
          </button>
          <button type="button" className={styles.plusFiveButton} onClick={() => handleDelta(5)}>
            +5
          </button>
        </div>

        <div className={styles.roundButtonsRow}>
          <button type="button" className={styles.roundButton} onClick={() => setSheet('resetConfirm')}>
            <RotateCcw size={24} strokeWidth={1.75} />
            <span>Remise à zéro</span>
          </button>
          <button type="button" className={styles.roundButton} onClick={() => setSheet('goal')}>
            <Target size={24} strokeWidth={1.75} />
            <span>Objectif</span>
          </button>
        </div>
      </div>

      {!isStandalone && (
        <div className={styles.othersSection}>
          <div className={styles.othersHeader}>
            <span>Autres compteurs</span>
            <IconButton icon={<Plus strokeWidth={1.75} />} label="Ajouter un compteur" onClick={() => setSheet('addCounter')} />
          </div>
          <div className={styles.othersList}>
            {otherCounters.map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                onSelect={() => handleSelectCounter(counter.id)}
                onIncrement={() => void applyCounterDelta(counter.id, 1)}
              />
            ))}
          </div>
        </div>
      )}

      <CounterMenuSheet
        open={sheet === 'menu'}
        onClose={closeSheet}
        isMain={Boolean(activeCounter?.isMain)}
        onRename={() => setSheet('rename')}
        onSetGoal={() => setSheet('goal')}
        onSetValue={() => setSheet('setValue')}
        onShowHistory={() => setSheet('history')}
        onShowSessionHistory={isStandalone ? () => setSheet('sessionHistory') : undefined}
        onDelete={() => setSheet('deleteConfirm')}
      />

      {sheet === 'sessionHistory' && <SessionHistorySheet target={{ projectId }} onClose={closeSheet} />}

      {sheet === 'rename' && activeCounter && (
        <TextPromptSheet
          title="Renommer le compteur"
          initialValue={activeCounter.name}
          onClose={closeSheet}
          onSave={(name) => void renameCounter(activeCounter.id, name)}
        />
      )}

      {sheet === 'addCounter' && projectId && (
        <TextPromptSheet
          title="Nouveau compteur"
          placeholder="Nom du compteur"
          saveLabel="Ajouter"
          onClose={closeSheet}
          onSave={(name) => void addCounter(projectId, name)}
        />
      )}

      {sheet === 'goal' && activeCounter && (
        <GoalSheet currentGoal={activeCounter.goal} onClose={closeSheet} onSave={(goal) => void setCounterGoal(activeCounter.id, goal)} />
      )}

      {sheet === 'setValue' && activeCounter && (
        <SetValueSheet currentValue={activeCounter.value} onClose={closeSheet} onSave={(value) => void setCounterValue(activeCounter.id, value)} />
      )}

      <HistorySheet open={sheet === 'history'} onClose={closeSheet} events={events ?? []} />

      <ConfirmDialog
        open={sheet === 'resetConfirm'}
        title="Remise à zéro"
        message={`Remettre "${activeCounter?.name ?? ''}" à zéro ? Cette action reste annulable.`}
        confirmLabel="Remettre à zéro"
        danger
        onConfirm={() => {
          if (activeCounter) void resetCounter(activeCounter.id)
          closeSheet()
        }}
        onCancel={closeSheet}
      />

      <ConfirmDialog
        open={sheet === 'deleteConfirm'}
        title="Supprimer le compteur"
        message={`Supprimer "${activeCounter?.name ?? ''}" et tout son historique ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          if (activeCounter) void deleteCounter(activeCounter.id)
          closeSheet()
        }}
        onCancel={closeSheet}
      />
    </div>
  )
})
