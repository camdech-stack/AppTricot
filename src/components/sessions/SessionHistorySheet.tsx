import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import styles from './SessionHistorySheet.module.css'
import { Button, ConfirmDialog, Sheet } from '../ui'
import { formatDuration } from '../../utils/formatDuration'
import { useNow } from '../../hooks/useNow'
import {
  addManualSession,
  deleteSession,
  getLiveSessionId,
  getSessionDuration,
  getSessionsForTarget,
  updateSessionTimes,
  type SessionRecord,
  type SessionTarget,
} from '../../data'

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

function localDayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function defaultFormValues(): { startedAt: string; endedAt: string } {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 60_000)
  return { startedAt: toLocalInputValue(start.toISOString()), endedAt: toLocalInputValue(now.toISOString()) }
}

type View =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; session: SessionRecord }
  | { kind: 'delete'; session: SessionRecord }

interface SessionHistorySheetProps {
  target: SessionTarget
  onClose: () => void
}

// Reused as-is from the project's "Temps" card and the standalone counter's
// menu (see CLAUDE.md, "Historique des sessions"). Mounted only while open,
// so a fresh mount is enough to reset internal state each time.
export function SessionHistorySheet({ target, onClose }: SessionHistorySheetProps) {
  const sessions = useLiveQuery(() => getSessionsForTarget(target), [target.projectId])
  const [view, setView] = useState<View>({ kind: 'list' })
  const liveSessionId = getLiveSessionId()
  const now = useNow(10_000)

  function backToList() {
    setView({ kind: 'list' })
  }

  function handleSheetClose() {
    if (view.kind === 'list') onClose()
    else backToList()
  }

  if (view.kind === 'delete') {
    return (
      <ConfirmDialog
        open
        title="Supprimer la session"
        message="Supprimer cette session ? Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          void deleteSession(view.session.id)
          backToList()
        }}
        onCancel={backToList}
      />
    )
  }

  if (view.kind === 'add' || view.kind === 'edit') {
    return (
      <SessionForm
        target={target}
        session={view.kind === 'edit' ? view.session : undefined}
        onClose={handleSheetClose}
        onSaved={backToList}
      />
    )
  }

  const groups = new Map<string, SessionRecord[]>()
  for (const session of sessions ?? []) {
    const key = localDayKey(session.startedAt)
    const list = groups.get(key) ?? []
    list.push(session)
    groups.set(key, list)
  }

  return (
    <Sheet open onClose={handleSheetClose} title="Historique des sessions">
      <Button className={styles.addButton} onClick={() => setView({ kind: 'add' })}>
        <Plus size={18} strokeWidth={1.75} />
        Ajouter une session manuelle
      </Button>

      {(sessions ?? []).length === 0 ? (
        <p className={styles.empty}>Aucune session pour l'instant.</p>
      ) : (
        [...groups.entries()].map(([key, daySessions]) => (
          <div key={key} className={styles.day}>
            <div className={styles.dayLabel}>{DAY_LABEL_FORMAT.format(new Date(`${key}T00:00:00`))}</div>
            <ul className={styles.list}>
              {daySessions.map((session) => {
                const isOpen = session.endedAt === null
                const durationMs = getSessionDuration(session, now, liveSessionId)
                return (
                  <li key={session.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.times}>
                        {TIME_FORMAT.format(new Date(session.startedAt))} –{' '}
                        {isOpen ? 'en cours' : TIME_FORMAT.format(new Date(session.endedAt!))}
                      </span>
                      <span className={styles.duration}>{formatDuration(durationMs)}</span>
                      {session.source === 'manual' && <span className={styles.manualPill}>manuelle</span>}
                    </div>
                    {!isOpen && (
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.iconAction}
                          aria-label="Modifier la session"
                          onClick={() => setView({ kind: 'edit', session })}
                        >
                          <Pencil size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconActionDanger}
                          aria-label="Supprimer la session"
                          onClick={() => setView({ kind: 'delete', session })}
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </Sheet>
  )
}

interface SessionFormProps {
  target: SessionTarget
  session?: SessionRecord
  onClose: () => void
  onSaved: () => void
}

function SessionForm({ target, session, onClose, onSaved }: SessionFormProps) {
  const [values, setValues] = useState(() =>
    session
      ? { startedAt: toLocalInputValue(session.startedAt), endedAt: toLocalInputValue(session.endedAt!) }
      : defaultFormValues(),
  )
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const startedAt = fromLocalInputValue(values.startedAt)
    const endedAt = fromLocalInputValue(values.endedAt)
    if (!startedAt || !endedAt) {
      setError('Merci de renseigner un début et une fin.')
      return
    }

    try {
      if (session) {
        await updateSessionTimes(session.id, startedAt, endedAt)
      } else {
        await addManualSession(target, startedAt, endedAt)
      }
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer cette session.')
    }
  }

  return (
    <Sheet open onClose={onClose} title={session ? 'Modifier la session' : 'Ajouter une session manuelle'}>
      <div className={styles.form}>
        <label className={styles.field}>
          <span>Début</span>
          <input
            type="datetime-local"
            className={styles.input}
            value={values.startedAt}
            onChange={(event) => setValues((current) => ({ ...current, startedAt: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          <span>Fin</span>
          <input
            type="datetime-local"
            className={styles.input}
            value={values.endedAt}
            onChange={(event) => setValues((current) => ({ ...current, endedAt: event.target.value }))}
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <Button className={styles.saveButton} onClick={() => void handleSave()}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}
