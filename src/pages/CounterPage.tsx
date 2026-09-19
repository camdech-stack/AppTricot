import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ListOrdered, RotateCcw, Plus, Settings, Square, Target, Undo2 } from 'lucide-react'
import styles from './CounterPage.module.css'
import { IconButton, Pill, StripedProgressBar, WaveDivider, ConfirmDialog } from '../components/ui'
import { CounterCard } from '../components/counters/CounterCard'
import { CounterMenuSheet } from '../components/counters/CounterMenuSheet'
import { TextPromptSheet } from '../components/counters/TextPromptSheet'
import { GoalSheet } from '../components/counters/GoalSheet'
import { SetValueSheet } from '../components/counters/SetValueSheet'
import { HistorySheet } from '../components/counters/HistorySheet'
import { useProject } from '../hooks/useProject'
import { useCounters } from '../hooks/useCounters'
import { useCounter } from '../hooks/useCounter'
import { useCounterEvents } from '../hooks/useCounterEvents'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { useWakeLock } from '../hooks/useWakeLock'
import { useElapsedTimer } from '../hooks/useElapsedTimer'
import { formatDuration } from '../utils/formatDuration'
import {
  addCounter,
  applyCounterDelta,
  deleteCounter,
  getOrCreateStandaloneCounter,
  renameCounter,
  resetCounter,
  setCounterGoal,
  setCounterValue,
  undoLastEvent,
  updateProject,
} from '../data'

type ActiveSheet =
  | 'menu'
  | 'rename'
  | 'addCounter'
  | 'goal'
  | 'setValue'
  | 'history'
  | 'resetConfirm'
  | 'deleteConfirm'
  | null

export function CounterPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const isStandalone = !projectId

  const project = useProject(projectId)
  const counters = useCounters(projectId ?? null)
  const timer = useElapsedTimer()

  useEffect(() => {
    if (!isStandalone) return
    getOrCreateStandaloneCounter().catch((error: unknown) => {
      console.error('Failed to load standalone counter', error)
    })
  }, [isStandalone])

  useWakeLock(true)

  const mainCounter = counters?.find((counter) => counter.isMain)
  const activeCounterId = isStandalone ? counters?.[0]?.id : (project?.activeCounterId ?? mainCounter?.id)
  const activeCounter = useCounter(activeCounterId)
  const otherCounters = (counters ?? []).filter((counter) => counter.id !== activeCounterId)

  const lastTapped = useRelativeTime(activeCounter?.lastTappedAt)
  const [sheet, setSheet] = useState<ActiveSheet>(null)
  const closeSheet = () => setSheet(null)

  const events = useCounterEvents(sheet === 'history' ? activeCounter?.id : undefined)

  function handleBack() {
    navigate(projectId ? `/projets/${projectId}` : '/')
  }

  function handleDelta(delta: number) {
    if (!activeCounter) return
    timer.start()
    void applyCounterDelta(activeCounter.id, delta)
  }

  function handleSelectCounter(counterId: string) {
    if (!projectId) return
    void updateProject(projectId, { activeCounterId: counterId })
  }

  const goalReached = activeCounter?.goal != null && activeCounter.value >= activeCounter.goal

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.topBar}>
          <IconButton
            icon={<ArrowLeft strokeWidth={1.75} />}
            label="Retour"
            className={styles.heroIconButton}
            onClick={handleBack}
          />
          {isStandalone ? (
            <div className={styles.avatar}>
              <ListOrdered size={22} strokeWidth={1.75} />
            </div>
          ) : (
            <div className={styles.projectName}>{project?.name}</div>
          )}
          <IconButton
            icon={<Settings strokeWidth={1.75} />}
            label="Menu du compteur"
            className={styles.heroIconButton}
            onClick={() => setSheet('menu')}
          />
        </div>
      </div>
      <WaveDivider />

      <div className={styles.scrollArea}>
        <div className={styles.countingZone}>
          <div className={goalReached ? styles.centralCardGoalReached : styles.centralCard}>
            <div className={styles.counterName}>{activeCounter?.name ?? '…'}</div>
            <div key={activeCounter?.value ?? 0} className={styles.bigNumber}>
              {activeCounter?.value ?? 0}
            </div>
            {lastTapped && <div className={styles.lastTap}>Dernier appui : {lastTapped}</div>}
            {timer.started && (
              <div className={styles.timerRow}>
                <span className={styles.timerText}>{formatDuration(timer.elapsedMs)}</span>
                {timer.running ? (
                  <button
                    type="button"
                    className={styles.timerStopButton}
                    onClick={timer.stop}
                    aria-label="Arrêter le chronomètre"
                  >
                    <Square size={12} strokeWidth={1.75} fill="currentColor" />
                  </button>
                ) : (
                  <span className={styles.timerStoppedLabel}>Arrêté</span>
                )}
              </div>
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
              <IconButton
                icon={<Plus strokeWidth={1.75} />}
                label="Ajouter un compteur"
                onClick={() => setSheet('addCounter')}
              />
            </div>
            <div className={styles.othersList}>
              {otherCounters.map((counter) => (
                <CounterCard
                  key={counter.id}
                  counter={counter}
                  onSelect={() => handleSelectCounter(counter.id)}
                  onIncrement={() => {
                    timer.start()
                    void applyCounterDelta(counter.id, 1)
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <CounterMenuSheet
        open={sheet === 'menu'}
        onClose={closeSheet}
        isMain={Boolean(activeCounter?.isMain)}
        onRename={() => setSheet('rename')}
        onSetGoal={() => setSheet('goal')}
        onSetValue={() => setSheet('setValue')}
        onShowHistory={() => setSheet('history')}
        onDelete={() => setSheet('deleteConfirm')}
      />

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
        <GoalSheet
          currentGoal={activeCounter.goal}
          onClose={closeSheet}
          onSave={(goal) => void setCounterGoal(activeCounter.id, goal)}
        />
      )}

      {sheet === 'setValue' && activeCounter && (
        <SetValueSheet
          currentValue={activeCounter.value}
          onClose={closeSheet}
          onSave={(value) => void setCounterValue(activeCounter.id, value)}
        />
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
}
