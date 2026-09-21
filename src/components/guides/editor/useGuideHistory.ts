import { useCallback, useState } from 'react'
import type { GuideContent } from '../../../data'

// In-memory undo/redo for one editing session — never persisted. Capped at
// 30 past states, immutability makes each snapshot cheap to keep (see
// CLAUDE.md "Annuler / Rétablir").
const MAX_HISTORY = 30

interface HistoryState {
  past: GuideContent[]
  present: GuideContent
  future: GuideContent[]
}

export interface GuideHistory {
  content: GuideContent
  setContent: (next: GuideContent) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useGuideHistory(initial: GuideContent): GuideHistory {
  const [state, setState] = useState<HistoryState>({ past: [], present: initial, future: [] })

  const setContent = useCallback((next: GuideContent) => {
    setState((current) => {
      if (next === current.present) return current
      const past = [...current.past, current.present].slice(-MAX_HISTORY)
      return { past, present: next, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setState((current) => {
      const previous = current.past[current.past.length - 1]
      if (!previous) return current
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setState((current) => {
      const next = current.future[0]
      if (!next) return current
      return { past: [...current.past, current.present].slice(-MAX_HISTORY), present: next, future: current.future.slice(1) }
    })
  }, [])

  return { content: state.present, setContent, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}
