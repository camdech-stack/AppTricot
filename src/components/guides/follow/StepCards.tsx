import styles from './StepCards.module.css'
import { Pill } from '../../ui'
import { blockTypeMeta } from '../editor/blockTypeMeta'
import type { CursorStep, InnermostContainerInfo, RowSide } from '../../../data'

interface StepCardsProps {
  cursorStep: CursorStep
  rowLabel: string | null
  rowIndexInBlock: number | null
  rowCountInBlock: number | null
  side: RowSide | null
  innermostContainer: InnermostContainerInfo | null
}

// The two stat cards ("Rang" / "Répétition ou passage") at the top of a
// live or previewed step — see CLAUDE.md "Décisions d'interface (étape 5b,
// refonte visuelle)". Reuses the editor's own per-block-type colors/icons
// (`blockTypeMeta`) for the répétition/passage card, and the same rs/ws
// colors already used for a row's card border in the editor's RowsScreen,
// so following and editing read as the same visual language.
export function StepCards({ cursorStep, rowLabel, rowIndexInBlock, rowCountInBlock, side, innermostContainer }: StepCardsProps) {
  const showRowCard = cursorStep === 'row'
  const showContainerCard = innermostContainer !== null && cursorStep !== 'checkpoint'
  if (!showRowCard && !showContainerCard) return null

  const rowsMeta = blockTypeMeta('rows')
  const rowColorVar = side === 'rs' ? 'var(--color-primary)' : side === 'ws' ? 'var(--color-blue)' : rowsMeta.colorVar
  const rowColorSoftVar = side === 'rs' ? 'var(--color-primary-soft)' : side === 'ws' ? 'var(--color-blue-soft)' : rowsMeta.colorSoftVar

  const containerMeta = innermostContainer ? blockTypeMeta(innermostContainer.kind) : null
  const containerLabel = innermostContainer?.kind === 'repeat' ? 'Répétition' : 'Passage'
  const containerValue = innermostContainer
    ? innermostContainer.total != null
      ? `${innermostContainer.pass} / ${innermostContainer.total}`
      : `${innermostContainer.pass}`
    : ''

  return (
    <div className={styles.row}>
      {showRowCard && (
        <div className={styles.card} style={{ background: rowColorSoftVar, color: rowColorVar }}>
          <div className={styles.cardLabel}>
            <rowsMeta.icon size={18} strokeWidth={1.75} />
            Rang
            {side && <Pill color={side === 'rs' ? 'primary' : 'blue'}>{side === 'rs' ? 'END' : 'ENV'}</Pill>}
          </div>
          <div className={styles.cardValue}>
            {rowIndexInBlock != null && rowCountInBlock != null ? `${rowIndexInBlock} / ${rowCountInBlock}` : (rowLabel ?? '—')}
          </div>
        </div>
      )}
      {showContainerCard && containerMeta && (
        <div className={styles.card} style={{ background: containerMeta.colorSoftVar, color: containerMeta.colorVar }}>
          <div className={styles.cardLabel}>
            <containerMeta.icon size={18} strokeWidth={1.75} />
            {containerLabel}
          </div>
          <div className={styles.cardValue}>{containerValue}</div>
        </div>
      )}
    </div>
  )
}
