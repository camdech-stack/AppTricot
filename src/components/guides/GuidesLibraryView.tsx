import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import styles from './GuidesLibraryView.module.css'
import { GuideCard } from './GuideCard'
import { CreateGuideSheet } from './CreateGuideSheet'
import { Button } from '../ui'
import { useGuideLibraryContext } from '../../hooks/useGuideLibraryContext'
import { useGuideContents } from '../../hooks/useGuideContents'

interface GuidesLibraryViewProps {
  // The "+ Nouveau" button lives in the shared page header (PatternsPage,
  // at the same level as the title, like "+ Importer" for patterns) rather
  // than inside this view — both entry points (that button and the empty
  // state's own "Créer un guide") open the same sheet.
  createOpen: boolean
  onOpenCreate: () => void
  onCloseCreate: () => void
}

export function GuidesLibraryView({ createOpen, onOpenCreate, onCloseCreate }: GuidesLibraryViewProps) {
  const navigate = useNavigate()
  const context = useGuideLibraryContext()
  const [query, setQuery] = useState('')

  const contents = useGuideContents(context?.guides)

  if (context === undefined) {
    return <div className={styles.view} />
  }

  const needle = query.trim().toLowerCase()
  const filtered = needle ? context.guides.filter((guide) => guide.name.toLowerCase().includes(needle)) : context.guides

  return (
    <div className={styles.view}>
      {context.guides.length > 0 && (
        <>
          <p className={styles.summary}>
            {context.guides.length} guide{context.guides.length > 1 ? 's' : ''}
          </p>
          <div className={styles.searchField}>
            <Search size={18} strokeWidth={1.75} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Rechercher un guide…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </>
      )}

      {context.guides.length === 0 ? (
        <div className={styles.empty}>
          <p>Crée ton premier guide pour suivre un patron étape par étape.</p>
          <Button onClick={onOpenCreate}>Créer un guide</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Aucun guide ne correspond à cette recherche.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              content={contents[guide.id]}
              pattern={context.patterns.find((pattern) => pattern.id === guide.patternId)}
              linkedProjects={context.projectGuides
                .filter((link) => link.guideId === guide.id)
                .map((link) => context.projects.find((project) => project.id === link.projectId))
                .filter((project): project is NonNullable<typeof project> => Boolean(project))}
            />
          ))}
        </div>
      )}

      <CreateGuideSheet
        open={createOpen}
        onClose={onCloseCreate}
        onCreated={(guide) => {
          onCloseCreate()
          navigate(`/guides/${guide.id}`, { state: { returnTo: '/patrons?vue=guides' } })
        }}
        patterns={context.patterns}
      />
    </div>
  )
}
