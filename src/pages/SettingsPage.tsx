import { useEffect, useState } from 'react'
import styles from './SettingsPage.module.css'
import { useSettings } from '../hooks/useSettings'
import {
  isStoragePersisted,
  requestPersistentStorage,
  updateSettings,
  type LengthUnit,
  type ThemePreference,
} from '../data'

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

      const bar = document.querySelector('nav[aria-label="Navigation principale"]')
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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const LENGTH_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'm', label: 'Mètres' },
  { value: 'yd', label: 'Yards' },
]

export function SettingsPage() {
  const settings = useSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const safeAreaDebugInfo = useSafeAreaDebugInfo()

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
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Apparence</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Thème</span>
            <div className={styles.segmented} role="group" aria-label="Thème">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={settings?.theme === option.value}
                  onClick={() => updateSettings({ theme: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Stockage</div>
        <div className={styles.card}>
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
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 12,
          }}
        >
          {safeAreaDebugInfo}
        </pre>
      </section>
    </div>
  )
}
