import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import styles from './PdfViewerCore.module.css'
import { Sheet } from '../ui'
import { getPdfjs, STANDARD_FONT_DATA_URL } from '../../pdf/pdfjs'
import { clampPage, clampZoom, computeRenderBudget, DOUBLE_TAP_ZOOM, EDGE_SWIPE_GUARD_PX, MAX_ZOOM, MIN_ZOOM } from '../../pdf/viewerMath'
import { getPatternFile, getPatternViewState, savePatternViewState, touchPatternOpened } from '../../data'

const VIEW_STATE_SAVE_DELAY_MS = 500
const SWIPE_THRESHOLD_PX = 60
const TAP_MAX_MOVEMENT_PX = 8
const DOUBLE_TAP_MAX_DELAY_MS = 300

interface PdfViewerCoreProps {
  patternId: string
  projectId: string | null
  patternName: string
  // Shows a back button in the top bar when provided — omitted when
  // PdfViewerCore is embedded in the project work view, whose own pill
  // selector already handles navigation (see CLAUDE.md "Vue de travail").
  onBack?: () => void
}

interface SearchMatch {
  page: number
  count: number
}

type LoadState = 'loading' | 'ready' | 'error'

export function PdfViewerCore({ patternId, projectId, patternName, onBack }: PdfViewerCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const docRef = useRef<PDFDocumentProxy | null>(null)
  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const textCacheRef = useRef<Map<number, string>>(new Map())
  const restoredRef = useRef(false)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [chromeVisible, setChromeVisible] = useState(true)
  const [pageInputOpen, setPageInputOpen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([])
  const [searching, setSearching] = useState(false)

  const saveTimeoutRef = useRef<number | undefined>(undefined)
  const panRef = useRef(pan)
  panRef.current = pan
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pageRef = useRef(page)
  pageRef.current = page

  // --- Load the document -----------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      const fileRecord = await getPatternFile(patternId)
      if (!fileRecord) {
        if (!cancelled) {
          setLoadState('error')
          setErrorMessage('Fichier introuvable.')
        }
        return
      }
      const bytes = await fileRecord.blob.arrayBuffer()

      const pdfjs = await getPdfjs()
      const loadingTask = pdfjs.getDocument({ data: bytes, standardFontDataUrl: STANDARD_FONT_DATA_URL })
      loadingTaskRef.current = loadingTask

      try {
        const doc = await loadingTask.promise
        if (cancelled) {
          await loadingTask.destroy()
          return
        }
        docRef.current = doc
        setPageCount(doc.numPages)

        const savedState = await getPatternViewState(patternId, projectId)
        if (savedState) {
          setPage(clampPage(savedState.page, doc.numPages))
          setZoom(clampZoom(savedState.zoom))
          setPan({ x: savedState.offsetX, y: savedState.offsetY })
        }
        restoredRef.current = true

        void touchPatternOpened(patternId)
        setLoadState('ready')
      } catch (error) {
        if (cancelled) return
        if (error instanceof pdfjs.PasswordException) {
          setErrorMessage('Ce PDF est protégé par un mot de passe (non pris en charge pour l’instant).')
        } else {
          setErrorMessage('Ce fichier est invalide ou corrompu.')
        }
        setLoadState('error')
      }
    }

    void load()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      docRef.current = null
      void loadingTaskRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternId, projectId])

  // --- Persist view state -------------------------------------------------
  const flushViewState = useCallback(() => {
    if (!restoredRef.current) return
    window.clearTimeout(saveTimeoutRef.current)
    void savePatternViewState(patternId, projectId, {
      page: pageRef.current,
      zoom: zoomRef.current,
      offsetX: panRef.current.x,
      offsetY: panRef.current.y,
    })
  }, [patternId, projectId])

  const scheduleSaveViewState = useCallback(() => {
    if (!restoredRef.current) return
    window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(flushViewState, VIEW_STATE_SAVE_DELAY_MS)
  }, [flushViewState])

  useEffect(() => {
    scheduleSaveViewState()
  }, [page, zoom, pan, scheduleSaveViewState])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flushViewState()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushViewState)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushViewState)
      window.clearTimeout(saveTimeoutRef.current)
      flushViewState()
    }
  }, [flushViewState])

  // --- Render the current page --------------------------------------------
  const renderPage = useCallback(async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!doc || !canvas || !container) return

    renderTaskRef.current?.cancel()

    const pdfPage = await doc.getPage(pageRef.current)
    const baseViewport = pdfPage.getViewport({ scale: 1 })
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const fitScale = containerWidth / baseViewport.width

    const effectiveScale = fitScale * zoomRef.current
    const cssWidth = baseViewport.width * effectiveScale
    const cssHeight = baseViewport.height * effectiveScale

    const budget = computeRenderBudget(cssWidth, cssHeight, window.devicePixelRatio || 1)
    const renderScale = budget.canvasWidth / baseViewport.width
    const viewport = pdfPage.getViewport({ scale: renderScale })

    canvas.width = budget.canvasWidth
    canvas.height = budget.canvasHeight
    canvas.style.width = `${budget.cssWidth}px`
    canvas.style.height = `${budget.cssHeight}px`

    const maxPanX = Math.max(0, (cssWidth - containerWidth) / 2)
    const maxPanY = Math.max(0, (cssHeight - containerHeight) / 2)
    const clampedPan = {
      x: Math.min(maxPanX, Math.max(-maxPanX, panRef.current.x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, panRef.current.y)),
    }
    if (clampedPan.x !== panRef.current.x || clampedPan.y !== panRef.current.y) {
      setPan(clampedPan)
    }
    canvas.style.transform = `translate(${clampedPan.x}px, ${clampedPan.y}px)`

    const context = canvas.getContext('2d')
    if (!context) return

    const task = pdfPage.render({ canvas, canvasContext: context, viewport })
    renderTaskRef.current = task
    try {
      await task.promise
    } catch {
      // Cancelled render (page/zoom changed mid-flight) — safe to ignore.
    }
  }, [])

  useEffect(() => {
    if (loadState !== 'ready') return
    void renderPage()
  }, [loadState, page, zoom, renderPage])

  useEffect(() => {
    if (loadState !== 'ready') return
    const observer = new ResizeObserver(() => void renderPage())
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [loadState, renderPage])

  // --- Gestures ------------------------------------------------------------
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>
    mode: 'none' | 'pan' | 'pinch' | 'swipe'
    startPan: { x: number; y: number }
    startZoom: number
    startDistance: number
    startMidpoint: { x: number; y: number }
    lastTapAt: number
    lastTapX: number
    lastTapY: number
    startX: number
    startY: number
    moved: boolean
  }>({
    pointers: new Map(),
    mode: 'none',
    startPan: { x: 0, y: 0 },
    startZoom: 1,
    startDistance: 0,
    startMidpoint: { x: 0, y: 0 },
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  })

  function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)

    if (gesture.pointers.size === 1) {
      gesture.startX = event.clientX
      gesture.startY = event.clientY
      gesture.moved = false
      gesture.startPan = { ...panRef.current }
      gesture.mode = zoomRef.current > MIN_ZOOM ? 'pan' : 'swipe'
    } else if (gesture.pointers.size === 2) {
      const [a, b] = Array.from(gesture.pointers.values())
      gesture.mode = 'pinch'
      gesture.startDistance = distanceBetween(a!, b!)
      gesture.startZoom = zoomRef.current
      gesture.startMidpoint = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
      gesture.startPan = { ...panRef.current }
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture.pointers.has(event.pointerId)) return
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const canvas = canvasRef.current
    if (!canvas) return

    if (gesture.mode === 'pinch' && gesture.pointers.size === 2) {
      const [a, b] = Array.from(gesture.pointers.values())
      const distance = distanceBetween(a!, b!)
      const ratio = gesture.startDistance > 0 ? distance / gesture.startDistance : 1
      const liveZoom = clampZoom(gesture.startZoom * ratio)
      canvas.style.transform = `translate(${gesture.startPan.x}px, ${gesture.startPan.y}px) scale(${liveZoom / gesture.startZoom})`
      canvas.dataset.liveZoom = String(liveZoom)
      return
    }

    if (gesture.mode === 'pan') {
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      if (Math.abs(dx) > TAP_MAX_MOVEMENT_PX || Math.abs(dy) > TAP_MAX_MOVEMENT_PX) gesture.moved = true
      canvas.style.transform = `translate(${gesture.startPan.x + dx}px, ${gesture.startPan.y + dy}px)`
      return
    }

    if (gesture.mode === 'swipe') {
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      if (Math.abs(dx) > TAP_MAX_MOVEMENT_PX || Math.abs(dy) > TAP_MAX_MOVEMENT_PX) gesture.moved = true
      if (Math.abs(dx) > Math.abs(dy)) {
        canvas.style.transform = `translate(${dx}px, 0px)`
      }
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    const canvas = canvasRef.current
    gesture.pointers.delete(event.pointerId)

    if (gesture.mode === 'pinch' && gesture.pointers.size < 2) {
      const liveZoom = canvas?.dataset.liveZoom ? Number(canvas.dataset.liveZoom) : zoomRef.current
      if (canvas) delete canvas.dataset.liveZoom
      setZoom(clampZoom(liveZoom))
      gesture.mode = 'none'
      return
    }

    if (gesture.pointers.size > 0) return

    if (gesture.mode === 'pan') {
      if (canvas) {
        const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(canvas.style.transform)
        if (match) {
          setPan({ x: Number(match[1]), y: Number(match[2]) })
        }
      }
      if (!gesture.moved) handleTapGesture(event.clientX, event.clientY)
      gesture.mode = 'none'
      return
    }

    if (gesture.mode === 'swipe') {
      const dx = event.clientX - gesture.startX
      if (canvas) canvas.style.transform = 'translate(0px, 0px)'
      const startedNearEdge = gesture.startX < EDGE_SWIPE_GUARD_PX || gesture.startX > window.innerWidth - EDGE_SWIPE_GUARD_PX
      if (!startedNearEdge && Math.abs(dx) > SWIPE_THRESHOLD_PX) {
        setPage((current) => clampPage(current + (dx < 0 ? 1 : -1), pageCount))
      } else if (!gesture.moved) {
        handleTapGesture(event.clientX, event.clientY)
      }
      gesture.mode = 'none'
    }
  }

  function handleTapGesture(x: number, y: number) {
    const gesture = gestureRef.current
    const now = Date.now()
    const isDoubleTap =
      now - gesture.lastTapAt < DOUBLE_TAP_MAX_DELAY_MS && distanceBetween({ x, y }, { x: gesture.lastTapX, y: gesture.lastTapY }) < 40

    if (isDoubleTap) {
      gesture.lastTapAt = 0
      setZoom((current) => (current > MIN_ZOOM ? MIN_ZOOM : DOUBLE_TAP_ZOOM))
      setPan({ x: 0, y: 0 })
      return
    }

    gesture.lastTapAt = now
    gesture.lastTapX = x
    gesture.lastTapY = y
    setChromeVisible((visible) => !visible)
  }

  // --- Search ---------------------------------------------------------------
  async function ensureTextCache(): Promise<void> {
    const doc = docRef.current
    if (!doc) return
    if (textCacheRef.current.size === doc.numPages) return
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      if (textCacheRef.current.has(pageNumber)) continue
      const pdfPage = await doc.getPage(pageNumber)
      const content = await pdfPage.getTextContent()
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      textCacheRef.current.set(pageNumber, text)
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      await ensureTextCache()
      const needle = query.trim().toLowerCase()
      const results: SearchMatch[] = []
      for (const [pageNumber, text] of textCacheRef.current.entries()) {
        const lower = text.toLowerCase()
        let count = 0
        let index = lower.indexOf(needle)
        while (index !== -1) {
          count += 1
          index = lower.indexOf(needle, index + needle.length)
        }
        if (count > 0) results.push({ page: pageNumber, count })
      }
      results.sort((a, b) => a.page - b.page)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }

  // --- Toolbar handlers -------------------------------------------------
  function goToPage(next: number) {
    setPage(clampPage(next, pageCount))
    setPan({ x: 0, y: 0 })
  }

  function zoomBy(delta: number) {
    setZoom((current) => clampZoom(current + delta))
    if (canvasRef.current) canvasRef.current.style.transform = ''
  }

  function fitToWidth() {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }

  const errorReasonIsPassword = errorMessage?.includes('mot de passe') ?? false

  const displayedPatternName = useMemo(() => patternName || 'Patron', [patternName])

  return (
    <div className={styles.wrap}>
      {chromeVisible && (
        <div className={styles.topBar}>
          {onBack && (
            <button type="button" className={styles.iconAction} aria-label="Retour" onClick={onBack}>
              <ArrowLeft size={20} strokeWidth={1.75} />
            </button>
          )}
          <span className={styles.title}>{displayedPatternName}</span>
          <button type="button" className={styles.iconAction} aria-label="Rechercher dans le texte" onClick={() => setSearchOpen(true)}>
            <Search size={20} strokeWidth={1.75} />
          </button>
          <Link to={`/patrons/${patternId}`} className={styles.iconAction} aria-label="Fiche du patron">
            <BookOpen size={20} strokeWidth={1.75} />
          </Link>
        </div>
      )}

      <div
        ref={containerRef}
        className={styles.viewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {loadState === 'loading' && <p className={styles.status}>Chargement du PDF…</p>}

        {loadState === 'error' && (
          <div className={styles.errorBox}>
            <AlertTriangle size={32} strokeWidth={1.5} />
            <p>{errorMessage}</p>
            {!errorReasonIsPassword && (
              <Link to={`/patrons/${patternId}`} className={styles.errorLink}>
                Remplacer le fichier
              </Link>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className={loadState === 'ready' ? styles.canvas : styles.canvasHidden} />
      </div>

      {chromeVisible && loadState === 'ready' && (
        <div className={styles.bottomBar}>
          <button type="button" className={styles.navButton} disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Page précédente">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.pageIndicator}
            onClick={() => {
              setPageInputValue(String(page))
              setPageInputOpen(true)
            }}
          >
            {page} / {pageCount}
          </button>
          <button type="button" className={styles.navButton} disabled={page >= pageCount} onClick={() => goToPage(page + 1)} aria-label="Page suivante">
            <ChevronRight size={20} strokeWidth={1.75} />
          </button>
          <div className={styles.zoomGroup}>
            <button type="button" className={styles.navButton} disabled={zoom <= MIN_ZOOM} onClick={() => zoomBy(-0.5)} aria-label="Zoom arrière">
              <Minus size={18} strokeWidth={1.75} />
            </button>
            <button type="button" className={styles.navButton} onClick={fitToWidth} aria-label="Ajuster à la largeur">
              <Maximize size={18} strokeWidth={1.75} />
            </button>
            <button type="button" className={styles.navButton} disabled={zoom >= MAX_ZOOM} onClick={() => zoomBy(0.5)} aria-label="Zoom avant">
              <Plus size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      <Sheet open={pageInputOpen} onClose={() => setPageInputOpen(false)} title="Aller à la page">
        <form
          className={styles.pageForm}
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(pageInputValue)
            if (Number.isFinite(value)) goToPage(value)
            setPageInputOpen(false)
          }}
        >
          <input
            className={styles.pageInput}
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            value={pageInputValue}
            onChange={(event) => setPageInputValue(event.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.pageFormSubmit}>
            Aller
          </button>
        </form>
      </Sheet>

      <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Rechercher dans le texte">
        <div className={styles.searchField}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(event) => void handleSearch(event.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button type="button" className={styles.searchClear} onClick={() => void handleSearch('')} aria-label="Effacer">
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        {searching && <p className={styles.status}>Recherche…</p>}
        {!searching && searchQuery && searchResults.length === 0 && <p className={styles.status}>Aucun résultat.</p>}
        <div className={styles.searchResults}>
          {searchResults.map((match) => (
            <button
              key={match.page}
              type="button"
              className={styles.searchResultRow}
              onClick={() => {
                goToPage(match.page)
                setSearchOpen(false)
              }}
            >
              <span>Page {match.page}</span>
              <span className={styles.searchResultCount}>
                {match.count} occurrence{match.count > 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
