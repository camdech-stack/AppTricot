import { useEffect, useState, type FormEvent } from 'react'
import styles from './RavelrySearchSheet.module.css'
import { Button, Sheet } from '../../components/ui'
import { useSettings } from '../../hooks/useSettings'
import { nowIso, type LengthUnit, type YarnDraft } from '../../data'
import { formatYarnAmount } from '../../utils/formatYarnQuantity'
import { getYarnCatalogDetail, searchYarnsCatalog } from '../client'
import { describeRavelryError } from '../errors'
import { ravelryRequestQueue } from '../requestQueue'
import { snapshotCatalogFields, type CatalogFieldSnapshot } from '../catalogSync'
import { RavelryError, type YarnCatalogSearchResult } from '../types'

export interface RavelrySearchSelection {
  draft: YarnDraft
  catalogFields: CatalogFieldSnapshot
  fetchedAt: string
}

interface RavelrySearchSheetProps {
  open: boolean
  onClose: () => void
  onSelect: (selection: RavelrySearchSelection) => void
  lengthUnit: LengthUnit
}

type Status = 'idle' | 'loading' | 'loading-more' | 'empty' | 'error'

export function RavelrySearchSheet({ open, onClose, onSelect, lengthUnit }: RavelrySearchSheetProps) {
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<YarnCatalogSearchResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const credentials =
    settings?.ravelryUsername && settings.ravelryPassword
      ? { username: settings.ravelryUsername, password: settings.ravelryPassword }
      : null

  async function runSearch(targetPage: number, mode: 'replace' | 'append') {
    if (!credentials) return
    if (ravelryRequestQueue.isRateLimited()) {
      setStatus('error')
      setErrorMessage(describeRavelryError('rate_limited'))
      return
    }
    setStatus(mode === 'replace' ? 'loading' : 'loading-more')
    setErrorMessage(null)
    try {
      const result = await searchYarnsCatalog(query.trim(), targetPage, credentials)
      setResults((previous) => (mode === 'replace' ? result.results : [...previous, ...result.results]))
      setHasMore(result.hasMore)
      setPage(targetPage)
      const total = mode === 'replace' ? result.results.length : results.length + result.results.length
      setStatus(total === 0 ? 'empty' : 'idle')
    } catch (error) {
      const kind = error instanceof RavelryError ? error.kind : 'unexpected_response'
      if (kind === 'cancelled') return
      setStatus('error')
      setErrorMessage(describeRavelryError(kind))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return
    void runSearch(1, 'replace')
  }

  async function handlePick(result: YarnCatalogSearchResult) {
    if (!credentials) return
    setLoadingDetailId(result.id)
    setErrorMessage(null)
    try {
      const detail = await getYarnCatalogDetail(result.id, credentials)
      if (!detail) {
        setStatus('error')
        setErrorMessage(describeRavelryError('unexpected_response'))
        return
      }
      const draft: YarnDraft = {
        name: detail.name,
        brand: detail.brand,
        line: detail.line,
        weightCategory: detail.weightCategory,
        fiber: detail.fiber,
        metersPerSkein: detail.metersPerSkein,
        gramsPerSkein: detail.gramsPerSkein,
        ravelryYarnId: detail.id,
        ravelryPermalink: detail.permalink,
        catalogSource: 'ravelry',
      }
      onSelect({ draft, catalogFields: snapshotCatalogFields(draft), fetchedAt: nowIso() })
    } catch (error) {
      const kind = error instanceof RavelryError ? error.kind : 'unexpected_response'
      if (kind === 'cancelled') return
      setStatus('error')
      setErrorMessage(describeRavelryError(kind))
    } finally {
      setLoadingDetailId(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Rechercher dans le catalogue Ravelry">
      <form className={styles.searchRow} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="search"
          placeholder="Nom du fil, marque…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!online}
        />
        <Button type="submit" disabled={!online || !query.trim() || status === 'loading'}>
          Rechercher
        </Button>
      </form>

      {!online && <p className={styles.message}>Recherche indisponible hors ligne. Le stock manuel reste utilisable.</p>}

      {online && status === 'loading' && <p className={styles.message}>Recherche en cours…</p>}
      {online && status === 'empty' && <p className={styles.message}>Aucun fil trouvé, essaie un autre nom ou ajoute-le à la main.</p>}
      {online && status === 'error' && errorMessage && <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>}

      {results.length > 0 && (
        <div className={styles.list}>
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className={styles.result}
              disabled={loadingDetailId !== null}
              onClick={() => void handlePick(result)}
            >
              <div className={styles.resultName}>{result.name}</div>
              <div className={styles.resultMeta}>
                {[
                  result.brand || null,
                  result.weightCategoryLabel || null,
                  result.metersPerSkein !== null ? formatYarnAmount(result.metersPerSkein, 'm', lengthUnit) : null,
                  result.gramsPerSkein !== null ? formatYarnAmount(result.gramsPerSkein, 'g', lengthUnit) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
              {loadingDetailId === result.id && <div className={styles.resultMeta}>Chargement…</div>}
            </button>
          ))}
          {hasMore && (
            <Button
              type="button"
              variant="secondary"
              className={styles.loadMore}
              disabled={status === 'loading-more'}
              onClick={() => void runSearch(page + 1, 'append')}
            >
              {status === 'loading-more' ? 'Chargement…' : 'Voir plus'}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}
