import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import styles from './GuidesLibraryView.module.css'
import { GuideCard } from './GuideCard'
import { CreateGuideSheet } from './CreateGuideSheet'
import { Button } from '../ui'
import { useGuideLibraryContext } from '../../hooks/useGuideLibraryContext'
import { useGuideContents } from '../../hooks/useGuideContents'

export function GuidesLibraryView() {
  const navigate = useNavigate()
  const context = useGuideLibraryContext()
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const contents = useGuideContents(context?.guides)

  if (context === undefined) {
    return <div className={styles.view} />
  }

  const needle = query.trim().toLowerCase()
  const filtered = needle ? context.guides.filter((guide) => guide.name.toLowerCase().includes(needle)) : context.guides

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <Button icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setCreateOpen(true)}>
          Nouveau guide
        </Button>
      </div>

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
          <Button onClick={() => setCreateOpen(true)}>Créer un guide</Button>
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
        onClose={() => setCreateOpen(false)}
        onCreated={(guide) => {
          setCreateOpen(false)
          navigate(`/guides/${guide.id}`)
        }}
        patterns={context.patterns}
      />
    </div>
  )
}
