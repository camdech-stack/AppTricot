import { useCallback, useEffect, useRef, useState } from 'react'
import { saveGuideContent, type GuideContent } from '../../../data'

const AUTOSAVE_DELAY_MS = 400

export type AutosaveStatus = 'saved' | 'saving' | 'error'

// Debounced write (400ms) plus an immediate flush on visibilitychange
// (hidden), pagehide and unmount — see CLAUDE.md "Enregistrement
// automatique". Always writes the whole content tree; never clears it from
// memory on failure (e.g. QuotaExceededError), so the user's work stays on
// screen even if it couldn't be persisted yet.
export function useGuideAutosave(guideId: string, content: GuideContent, lastEditedNodeId: string | null): { status: AutosaveStatus; flush: () => void } {
  const [status, setStatus] = useState<AutosaveStatus>('saved')
  const latestRef = useRef({ content, lastEditedNodeId })
  latestRef.current = { content, lastEditedNodeId }
  const savedContentRef = useRef(content)
  const timeoutRef = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
    const { content: pendingContent, lastEditedNodeId: pendingNodeId } = latestRef.current
    if (pendingContent === savedContentRef.current) return
    setStatus('saving')
    saveGuideContent(guideId, pendingContent, pendingNodeId)
      .then(() => {
        savedContentRef.current = pendingContent
        setStatus('saved')
      })
      .catch((error: unknown) => {
        console.error('Failed to autosave guide content', error)
        setStatus('error')
      })
  }, [guideId])

  useEffect(() => {
    if (content === savedContentRef.current) return
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeoutRef.current)
  }, [content, lastEditedNodeId, flush])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return { status, flush }
}
