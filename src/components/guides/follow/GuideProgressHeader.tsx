import type { ReactNode } from 'react'
import styles from './GuideProgressHeader.module.css'

interface GuideProgressHeaderProps {
  pieceName: string
  sectionName?: string | null
  percent: number
  // The chrono button, in live follow mode — omitted in preview mode, which
  // has no session/chrono at all (see CLAUDE.md "Aperçu du guide").
  chronoSlot?: ReactNode
}

// Piece name + a plain progress bar + percentage, shared by the live follow
// screen and the read-only preview — always the whole piece's progress
// (getPieceProgress), never a section or block's own, for consistency with
// the rest of the app (Plan du guide, fiche projet).
export function GuideProgressHeader({ pieceName, sectionName, percent, chronoSlot }: GuideProgressHeaderProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div className={styles.section}>
      <div className={styles.pieceName}>{pieceName}</div>
      {sectionName && <div className={styles.sectionName}>{sectionName}</div>}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression de la pièce : ${clamped} %`}
      >
        <div className={styles.fill} style={{ width: `${clamped}%` }} />
      </div>
      <div className={styles.row}>
        <span className={styles.percent}>{clamped}%</span>
        {chronoSlot}
      </div>
    </div>
  )
}
