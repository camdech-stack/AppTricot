import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import styles from './SettingsPage.module.css'
import { useSettings } from '../hooks/useSettings'
import { formatFileSize } from '../utils/formatFileSize'
import { getPatterns, isStoragePersisted, requestPersistentStorage, updateSettings, type LengthUnit, type YarnQuantityUnit } from '../data'
import { RavelrySettingsSection } from '../ravelry'

// TEMPORARY: diagnosing a bottom safe-area rendering bug on a real iPhone,
// which can't be reproduced or measured from this dev environment. Remove
// this whole block (and its section below) once the bug is fixed.
function useSafeAreaDebugInfo(): string {
  const [info, setInfo] = useState('…')

  useEffect(() => {
    function measure() {
      const probe = document.createElement('div')
      probe.style.paddingBottom = 'env(safe-area-inset-bottom)'
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      document.body.appendChild(probe)
      const envSafeBottom = getComputedStyle(probe).paddingBottom
      document.body.removeChild(probe)

      const bar = document.querySelector('[data-diagnostic="bottom-tab-bar"]')
      const rect = bar?.getBoundingClientRect()
      const vv = window.visualViewport

      setInfo(
        JSON.stringify(
          {
            envSafeBottom,
            windowInnerHeight: window.innerHeight,
            documentClientHeight: document.documentElement.clientHeight,
            visualViewportHeight: vv?.height,
            visualViewportOffsetTop: vv?.offsetTop,
            barRectTop: rect?.top,
            barRectBottom: rect?.bottom,
            barRectHeight: rect?.height,
            gapBelowBar: rect ? window.innerHeight - rect.bottom : null,
            displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
          },
          null,
          2,
        ),
      )
    }

    measure()
    const interval = setInterval(measure, 1000)
    window.visualViewport?.addEventListener('resize', measure)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(interval)
      window.visualViewport?.removeEventListener('resize', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  return info
}

const LENGTH_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'm', label: 'Mètres' },
  { value: 'yd', label: 'Yards' },
]

const YARN_QUANTITY_OPTIONS: { value: YarnQuantityUnit; label: string }[] = [
  { value: 'skein', label: 'Pelotes' },
  { value: 'weight', label: 'Poids' },
  { value: 'length', label: 'Longueur' },
]

export function SettingsPage() {
  const settings = useSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const safeAreaDebugInfo = useSafeAreaDebugInfo()
  const patterns = useLiveQuery(() => getPatterns(), [])
  const patternsSizeBytes = (patterns ?? []).reduce((sum, pattern) => sum + pattern.sizeBytes, 0)

  useEffect(() => {
    isStoragePersisted().then(setPersisted).catch(() => setPersisted(false))
  }, [])

  async function handlePersistRequest() {
    const granted = await requestPersistentStorage()
    setPersisted(granted)
  }

  return (
    <div className={styles.page}>
      <h1>Réglages</h1>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Unités</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Longueur</span>
            <div className={styles.segmented} role="group" aria-label="Unité de longueur">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={settings?.lengthUnit === option.value}
                  onClick={() => updateSettings({ lengthUnit: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Poids</span>
            <span className={styles.rowValue}>Grammes (g)</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Quantités de laine</span>
            <div className={styles.segmented} role="group" aria-label="Unité d'affichage de la laine">
              {YARN_QUANTITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={settings?.yarnQuantityUnit === option.value}
                  onClick={() => updateSettings({ yarnQuantityUnit: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Suivi du temps</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Suivi automatique</span>
            <button
              type="button"
              className={styles.toggle}
              role="switch"
              aria-checked={settings?.trackingEnabled ?? true}
              aria-label="Activer le suivi du temps"
              onClick={() => updateSettings({ trackingEnabled: !(settings?.trackingEnabled ?? true) })}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
          <p className={styles.helperText}>
            Le chrono démarre automatiquement au premier appui sur un compteur, et s'arrête quand l'application est
            quittée ou quand vous l'arrêtez vous-même.
          </p>
        </div>
      </section>

      <RavelrySettingsSection />

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Stockage</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Patrons</span>
            <span className={styles.rowValue}>
              {patterns === undefined
                ? '…'
                : `${patterns.length} fichier${patterns.length > 1 ? 's' : ''} · ${formatFileSize(patternsSizeBytes)}`}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Stockage persistant</span>
            {persisted === null ? (
              <span className={styles.status}>…</span>
            ) : persisted ? (
              <span className={`${styles.status} ${styles.statusOk}`}>Activé</span>
            ) : (
              <button type="button" className={styles.persistButton} onClick={handlePersistRequest}>
                Activer
              </button>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>À propos</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Version</span>
            <span className={styles.rowValue}>{__APP_VERSION__}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Diagnostic temporaire</div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontSize: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-12)',
          }}
        >
          {safeAreaDebugInfo}
        </pre>
      </section>
    </div>
  )
}
