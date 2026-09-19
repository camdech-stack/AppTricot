import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import styles from './ProjectsPage.module.css'
import { useProjects } from '../hooks/useProjects'
import { ProjectCard } from '../components/projects/ProjectCard'
import { Button } from '../components/ui'
import { STATUS_FILTER_ORDER, STATUS_LABELS } from '../components/projects/statusMeta'
import type { ProjectStatus } from '../data'

type StatusFilter = 'all' | ProjectStatus

export function ProjectsPage() {
  const projects = useProjects()
  const [filter, setFilter] = useState<StatusFilter>('all')

  if (projects === undefined) {
    return <div className={styles.page} />
  }

  const counts: Record<StatusFilter, number> = {
    all: projects.length,
    todo: 0,
    in_progress: 0,
    paused: 0,
    done: 0,
  }
  for (const project of projects) counts[project.status] += 1

  const filtered = (filter === 'all' ? projects : projects.filter((project) => project.status === filter))
    .slice()
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Projets</h1>
        <Link to="/projets/nouveau">
          <Button icon={<Plus size={18} strokeWidth={1.75} />}>Nouveau</Button>
        </Link>
      </div>

      <div className={styles.pills} role="tablist" aria-label="Filtrer par statut">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? styles.pillActive : styles.pill}
          onClick={() => setFilter('all')}
        >
          Tous ({counts.all})
        </button>
        {STATUS_FILTER_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={filter === status}
            className={filter === status ? styles.pillActive : styles.pill}
            onClick={() => setFilter(status)}
          >
            {STATUS_LABELS[status]} ({counts[status]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {projects.length === 0 ? (
            <>
              <p>Vous n'avez pas encore de projet.</p>
              <Link to="/projets/nouveau">
                <Button>Créer mon premier projet</Button>
              </Link>
            </>
          ) : (
            <p>Aucun projet dans ce filtre.</p>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
