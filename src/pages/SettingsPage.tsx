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
    </div>
  )
}
