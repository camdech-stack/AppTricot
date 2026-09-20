import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, Plus, Search } from 'lucide-react'
import styles from './PatternsPage.module.css'
import { PatternCard } from '../components/patterns/PatternCard'
import { PatternFilterSheet } from '../components/patterns/PatternFilterSheet'
import { ImportPatternSheet } from '../components/patterns/ImportPatternSheet'
import { Button, IconButton } from '../components/ui'
import { usePatternLibraryContext } from '../hooks/usePatternLibraryContext'
import { DEFAULT_PATTERN_FILTERS, filterAndSortPatterns, type PatternListItem, type PatternSortOption } from '../data'

const SORT_OPTIONS: { value: PatternSortOption; label: string }[] = [
  { value: 'recent', label: 'Récents' },
  { value: 'name', label: 'Nom' },
  { value: 'lastOpened', label: 'Dernière ouverture' },
]

export function PatternsPage() {
  const navigate = useNavigate()
  const context = usePatternLibraryContext()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PatternSortOption>('recent')
  const [filters, setFilters] = useState(DEFAULT_PATTERN_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const items = useMemo<PatternListItem[]>(() => {
    if (!context) return []
    return context.patterns.map((pattern) => ({
      pattern,
      linkedProjectIds: context.projectPatterns.filter((link) => link.patternId === pattern.id).map((link) => link.projectId),
    }))
  }, [context])

  const allTags = useMemo(() => {
    if (!context) return []
    const set = new Set<string>()
    for (const pattern of context.patterns) {
      for (const tag of pattern.tags) set.add(tag)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [context])

  const filtered = useMemo(() => filterAndSortPatterns(items, { ...filters, query }, sort), [items, filters, query, sort])

  const activeFilterCount = (filters.craft !== 'all' ? 1 : 0) + (filters.tag !== 'all' ? 1 : 0) + (filters.linked !== 'all' ? 1 : 0)

  if (context === undefined) {
    return <div className={styles.page} />
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Patrons</h1>
        <div className={styles.headerActions}>
          <IconButton
            icon={<Filter strokeWidth={1.75} />}
            label="Filtrer"
            className={activeFilterCount > 0 ? styles.filterButtonActive : undefined}
            onClick={() => setFilterSheetOpen(true)}
          />
          <Button icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
            Importer
          </Button>
        </div>
      </div>

      {context.patterns.length > 0 && (
        <>
          <p className={styles.summary}>
            {context.patterns.length} patron{context.patterns.length > 1 ? 's' : ''}
          </p>
          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <Search size={18} strokeWidth={1.75} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Rechercher un patron, un tag…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select className={styles.sortSelect} value={sort} onChange={(event) => setSort(event.target.value as PatternSortOption)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {context.patterns.length === 0 ? (
        <div className={styles.empty}>
          <p>Importe ton premier patron.</p>
          <Button onClick={() => setImportOpen(true)}>Importer un patron</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Aucun patron ne correspond à cette recherche.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <PatternCard key={item.pattern.id} pattern={item.pattern} />
          ))}
        </div>
      )}

      <PatternFilterSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} filters={filters} onChange={setFilters} allTags={allTags} />

      <ImportPatternSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(pattern) => {
          setImportOpen(false)
          navigate(`/patrons/${pattern.id}`)
        }}
        allTags={allTags}
      />
    </div>
  )
}
