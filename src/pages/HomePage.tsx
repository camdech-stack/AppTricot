import { Link } from 'react-router-dom'
import { CalendarCheck, ListOrdered, Timer, Layers, Hourglass } from 'lucide-react'
import styles from './HomePage.module.css'
import { Button, Card, SectionTitle, StatTile } from '../components/ui'
import { ResumeCard } from '../components/home/ResumeCard'
import { BackupReminderBanner } from '../components/backup/BackupReminderBanner'
import { useHomeDashboard } from '../hooks/useHomeDashboard'
import { useSettings } from '../hooks/useSettings'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { formatDuration, formatTotalDuration } from '../utils/formatDuration'
import { formatSkeins } from '../utils/formatYarnQuantity'
import { getGreeting } from '../utils/greeting'
import type { RecentSession } from '../data'

const MAX_RESUME_CARDS = 5

function RecentSessionRow({ entry }: { entry: RecentSession }) {
  const ago = useRelativeTime(entry.session.startedAt)
  return (
    <li className={styles.sessionRow}>
      <div className={styles.sessionName}>{entry.projectName}</div>
      <div className={styles.sessionMeta}>
        {entry.isOpen ? 'en cours' : formatDuration(entry.durationMs)} · {ago}
      </div>
    </li>
  )
}

export function HomePage() {
  const home = useHomeDashboard()
  const settings = useSettings()
  const showTime = settings?.trackingEnabled ?? true

  if (home === undefined) {
    return <div className={styles.page} />
  }

  const { active, dashboard, weekTime, monthYarn, recentSessions } = home
  const resumeCards = active.slice(0, MAX_RESUME_CARDS)

  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>{getGreeting(new Date())}</h1>

      <BackupReminderBanner />

      <section className={styles.section}>
        <SectionTitle title="Reprendre" />
        {resumeCards.length === 0 ? (
          <Card className={styles.empty}>
            <p>Aucun projet en cours.</p>
            <Link to="/projets">
              <Button variant="secondary">Va voir tes projets</Button>
            </Link>
          </Card>
        ) : (
          <div className={styles.resumeGrid}>
            {resumeCards.map((summary) => (
              <ResumeCard key={summary.project.id} summary={summary} showTime={showTime} />
            ))}
          </div>
        )}
        {active.length > MAX_RESUME_CARDS && (
          <Link to="/projets?statut=in_progress" className={styles.moreLink}>
            Voir tous mes projets en cours ({active.length})
          </Link>
        )}
      </section>

      <section className={styles.section}>
        <Link to="/compteur" className={styles.counterShortcut}>
          <ListOrdered size={24} strokeWidth={1.75} />
          <span>Compteur de rang</span>
        </Link>
      </section>

      <section className={styles.section}>
        <SectionTitle title="En un coup d'œil" />
        <Card className={styles.statsGrid}>
          {showTime && (
            <StatTile icon={<Timer />} value={formatTotalDuration(weekTime.totalMs)} label="Tricoté cette semaine" />
          )}
          <StatTile icon={<Hourglass />} value={dashboard.byStatus.in_progress} label="Projets en cours" color="blue" />
          <StatTile icon={<CalendarCheck />} value={dashboard.completedThisMonth} label="Terminés ce mois" color="sage" />
          <StatTile icon={<Layers />} value={formatSkeins(monthYarn.totalSkeins)} label="Pelotes ce mois" color="terracotta" />
        </Card>
        <Link to="/stats" className={styles.moreLink}>
          Voir toutes les statistiques
        </Link>
      </section>

      {showTime && recentSessions.length > 0 && (
        <section className={styles.section}>
          <SectionTitle title="Sessions récentes" />
          <Card>
            <ul className={styles.sessionList}>
              {recentSessions.map((entry) => (
                <RecentSessionRow key={entry.session.id} entry={entry} />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
