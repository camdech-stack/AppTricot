import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Plus, Search } from 'lucide-react'
import styles from './YarnPage.module.css'
import { YarnCard } from '../components/yarn/YarnCard'
import { YarnFilterSheet } from '../components/yarn/YarnFilterSheet'
import { Button, IconButton } from '../components/ui'
import { useYarnStockContext } from '../hooks/useYarnStockContext'
import { useSettings } from '../hooks/useSettings'
import {
  DEFAULT_YARN_FILTERS,
  computeYarnStockSummary,
  filterAndSortYarns,
  type YarnListItem,
  type YarnSortOption,
  type YarnStockSummary,
} from '../data'

const SORT_OPTIONS: { value: YarnSortOption; label: string }[] = [
  { value: 'recent', label: 'Récents' },
  { value: 'name', label: 'Nom' },
  { value: 'brand', label: 'Marque' },
  { value: 'available', label: 'Quantité disponible' },
]

export function YarnPage() {
  const context = useYarnStockContext()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<YarnSortOption>('recent')
  const [filters, setFilters] = useState(DEFAULT_YARN_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const stockByYarnId = useMemo(() => {
    const map = new Map<string, YarnStockSummary>()
    if (!context) return map
    for (const yarn of context.yarns) {
      map.set(yarn.id, computeYarnStockSummary(yarn, context.usages, context.projectYarns, context.projects))
    }
    return map
  }, [context])

  const items = useMemo<YarnListItem[]>(() => {
    if (!context) return []
    return context.yarns.map((yarn) => {
      const linkedProjectIds = context.projectYarns.filter((link) => link.yarnId === yarn.id).map((link) => link.projectId)
      return { yarn, availableSkeins: stockByYarnId.get(yarn.id)?.availableSkeins ?? null, linkedProjectIds }
    })
  }, [context, stockByYarnId])

  const filtered = useMemo(
    () => filterAndSortYarns(items, { ...filters, query }, sort),
    [items, filters, query, sort],
  )

  const activeFilterCount =
    (filters.weightCategory !== 'all' ? 1 : 0) +
    (filters.colorFamily !== 'all' ? 1 : 0) +
    (filters.projectId !== 'all' ? 1 : 0) +
    (filters.stockState !== 'all' ? 1 : 0) +
    (filters.minMetersPerSkein !== null ? 1 : 0)

  if (context === undefined) {
    return <div className={styles.page} />
  }

  const totalSkeins = context.yarns.reduce((sum, yarn) => sum + yarn.skeinCount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Laine</h1>
        <div className={styles.headerActions}>
          <IconButton
            icon={<Filter strokeWidth={1.75} />}
            label="Filtrer"
            className={activeFilterCount > 0 ? styles.filterButtonActive : undefined}
            onClick={() => setFilterSheetOpen(true)}
          />
          <Link to="/laine/nouveau">
            <Button icon={<Plus size={18} strokeWidth={1.75} />}>Ajouter</Button>
          </Link>
        </div>
      </div>

      {context.yarns.length > 0 && (
        <p className={styles.summary}>
          {context.yarns.length} fil{context.yarns.length > 1 ? 's' : ''} · {totalSkeins} pelote
          {totalSkeins > 1 ? 's' : ''}
        </p>
      )}

      {context.yarns.length > 0 && (
        <div className={styles.searchRow}>
          <div className={styles.searchField}>
            <Search size={18} strokeWidth={1.75} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Rechercher un fil, une marque, une couleur…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(event) => setSort(event.target.value as YarnSortOption)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {context.yarns.length === 0 ? (
        <div className={styles.empty}>
          <p>Vous n'avez pas encore de fil dans votre stock.</p>
          <Link to="/laine/nouveau">
            <Button>Ajouter mon premier fil</Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Aucun fil ne correspond à cette recherche.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const stock = stockByYarnId.get(item.yarn.id)
            return stock ? <YarnCard key={item.yarn.id} yarn={item.yarn} stock={stock} /> : null
          })}
        </div>
      )}

      <YarnFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        projects={context.projects}
        lengthUnit={settings?.lengthUnit ?? 'm'}
      />
    </div>
  )
}
