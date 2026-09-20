import { ExternalLink } from 'lucide-react'
import { Pill } from '../../components/ui'
import styles from './RavelryCatalogPill.module.css'

// Shown on the yarn form right after a catalog result prefills it — a
// reminder to double check the values before saving (see CLAUDE.md).
export function RavelryPrefilledPill() {
  return <Pill color="gold">Prérempli depuis le catalogue : vérifie les valeurs</Pill>
}

// Shown on the yarn detail page for anything sourced from Ravelry — no other
// catalog data (photos, descriptions, reviews) is ever shown alongside it.
export function RavelryCatalogPill({ permalink }: { permalink: string }) {
  return (
    <div className={styles.row}>
      <Pill color="blue">Source : catalogue Ravelry</Pill>
      <a href={permalink} target="_blank" rel="noopener noreferrer" className={styles.link}>
        Voir sur Ravelry
        <ExternalLink size={16} strokeWidth={1.75} />
      </a>
    </div>
  )
}
