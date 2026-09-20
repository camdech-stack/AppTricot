import styles from './YarnStockBar.module.css'
import { formatYarnQuantity } from '../../utils/formatYarnQuantity'
import { computeYarnStockBarSegments } from '../../data'
import type { LengthUnit, YarnQuantityUnit, YarnRecord, YarnStockSummary } from '../../data'

interface YarnStockBarProps {
  yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>
  stock: YarnStockSummary
  displayUnit: YarnQuantityUnit
  lengthUnit: LengthUnit
}

// Visual breakdown of a yarn's stock (option 1 of the quantities mockup):
// one bar, split into consumed/reserved/available widths, with a bracket
// under the last two showing they sum to "restante". Falls back to text
// alone for what the bar itself can't represent — a reservation bigger
// than what's left (negative "disponible"), or stock consumed past the
// initial quantity altogether.
export function YarnStockBar({ yarn, stock, displayUnit, lengthUnit }: YarnStockBarProps) {
  const segments = computeYarnStockBarSegments(stock)
  const format = (skeins: number | null) => formatYarnQuantity(skeins, yarn, displayUnit, lengthUnit)

  const reservationExceedsStock = !segments.stockExceeded && stock.availableSkeins !== null && stock.availableSkeins < 0

  return (
    <div className={styles.card}>
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Quantité initiale</span>
        <span className={styles.totalValue}>{format(stock.initialSkeins)}</span>
      </div>

      <div className={styles.bar}>
        <div className={styles.segConsumed} style={{ width: `${segments.consumedRatio * 100}%` }} />
        <div className={styles.segReserved} style={{ width: `${segments.reservedRatio * 100}%` }} />
        <div className={styles.segAvailable} style={{ width: `${segments.availableRatio * 100}%` }} />
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: 'var(--color-primary)' }} />
            Consommée
          </span>
          <div className={styles.legendValue}>
            {format(stock.consumedSkeins)}
            {stock.consumedRatio !== null && (
              <span className={styles.legendPercent}> · {Math.round(stock.consumedRatio * 100)} %</span>
            )}
          </div>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: 'var(--color-gold)' }} />
            Réservée
          </span>
          <div className={styles.legendValue}>{format(stock.reservedSkeins)}</div>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLabel}>
            <span className={styles.legendDot} style={{ background: 'var(--color-sage)' }} />
            Disponible
          </span>
          <div className={styles.legendValue}>{format(stock.availableSkeins)}</div>
        </div>
      </div>

      {!segments.stockExceeded && (
        <div className={styles.bracket}>
          <div className={styles.bracketTick} style={{ marginLeft: `${segments.consumedRatio * 100}%` }} />
          <div className={styles.bracketText}>
            Restante = <b>{format(stock.remainingSkeins)}</b>
          </div>
        </div>
      )}

      {segments.stockExceeded && (
        <p className={styles.alert}>
          <b>Stock dépassé.</b> La consommation enregistrée dépasse la quantité initiale de ce fil.
        </p>
      )}
      {reservationExceedsStock && (
        <p className={styles.alert}>
          <b>Disponible : {format(stock.availableSkeins)}.</b> Les réservations en cours dépassent ce qu'il reste
          en stock.
        </p>
      )}
    </div>
  )
}
