import { useEffect, useRef, useState } from 'react'
import styles from './RavelrySettingsSection.module.css'
import { Button, ConfirmDialog } from '../../components/ui'
import { useSettings } from '../../hooks/useSettings'
import { updateSettings } from '../../data'
import { testRavelryConnection } from '../client'
import { describeRavelryError } from '../errors'
import { countRavelryYarns, purgeRavelryData } from '../catalogSync'
import { RavelryError, type RavelryErrorKind } from '../types'

type TestResult = { kind: 'connected' } | { kind: RavelryErrorKind }

export function RavelrySettingsSection() {
  const settings = useSettings()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const seededRef = useRef(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeCount, setPurgeCount] = useState<number | null>(null)
  const [purging, setPurging] = useState(false)
  const [purgeDone, setPurgeDone] = useState<number | null>(null)

  // Settings arrive asynchronously via liveQuery: seed the local inputs once
  // rather than on every settings change, so typing isn't clobbered by our
  // own onBlur write coming back through the subscription.
  useEffect(() => {
    if (seededRef.current || !settings) return
    seededRef.current = true
    setUsername(settings.ravelryUsername ?? '')
    setPassword(settings.ravelryPassword ?? '')
  }, [settings])

  const enabled = settings?.ravelryEnabled ?? false
  const hasCredentials = Boolean(settings?.ravelryUsername && settings?.ravelryPassword)

  async function handleTestConnection() {
    if (!settings?.ravelryUsername || !settings.ravelryPassword) return
    setTesting(true)
    setTestResult(null)
    try {
      if (!navigator.onLine) {
        setTestResult({ kind: 'network_unreachable' })
        return
      }
      await testRavelryConnection({ username: settings.ravelryUsername, password: settings.ravelryPassword })
      setTestResult({ kind: 'connected' })
    } catch (error) {
      const kind = error instanceof RavelryError ? error.kind : 'unexpected_response'
      if (kind !== 'cancelled') setTestResult({ kind })
    } finally {
      setTesting(false)
    }
  }

  async function handleClearCredentials() {
    await updateSettings({ ravelryUsername: null, ravelryPassword: null })
    setUsername('')
    setPassword('')
    setTestResult(null)
  }

  async function handleOpenPurge() {
    setPurgeCount(await countRavelryYarns())
    setPurgeDone(null)
    setPurgeOpen(true)
  }

  async function handleConfirmPurge() {
    setPurging(true)
    try {
      const count = await purgeRavelryData()
      setPurgeDone(count)
    } finally {
      setPurging(false)
      setPurgeOpen(false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>Catalogue Ravelry (optionnel)</div>
      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Activer la recherche Ravelry</span>
          <button
            type="button"
            className={styles.toggle}
            role="switch"
            aria-checked={enabled}
            aria-label="Activer le catalogue Ravelry"
            onClick={() => void updateSettings({ ravelryEnabled: !enabled })}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Nom d'utilisateur</span>
          <input
            className={styles.input}
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onBlur={() => void updateSettings({ ravelryUsername: username.trim() || null })}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Mot de passe</span>
          <input
            className={styles.input}
            type="password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => void updateSettings({ ravelryPassword: password || null })}
          />
        </label>

        <p className={styles.helperText}>
          Créez des identifiants de lecture seule dans votre propre compte sur ravelry.com — n'utilisez jamais votre
          clé personnelle.
        </p>

        <div className={styles.actionsRow}>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasCredentials || testing}
            onClick={() => void handleTestConnection()}
          >
            {testing ? 'Test en cours…' : 'Tester la connexion'}
          </Button>
          <Button type="button" variant="ghost" disabled={!hasCredentials} onClick={() => void handleClearCredentials()}>
            Effacer mes identifiants
          </Button>
        </div>

        {testResult && (
          <p className={`${styles.result} ${testResult.kind === 'connected' ? styles.resultOk : styles.resultError}`}>
            {testResult.kind === 'connected' ? '✓ Connecté à Ravelry' : describeRavelryError(testResult.kind)}
          </p>
        )}

        <p className={styles.disclaimer}>Non affilié à Ravelry.</p>
        <p className={styles.transparency}>
          {
            "Quand vous lancez une recherche : le texte recherché et vos identifiants de lecture sont envoyés à Ravelry, uniquement à ce moment-là.\nCe qui est stocké sur cet appareil : le texte technique du fil choisi (nom, marque, épaisseur, métrage, poids, composition), son identifiant et un lien vers sa page — jamais de photo.\nRien n'est partagé ailleurs.\nVous pouvez tout supprimer ci-dessous, ou en effaçant vos identifiants."
          }
        </p>

        <div className={styles.dangerRow}>
          <Button type="button" variant="ghost" onClick={() => void handleOpenPurge()}>
            Supprimer les données Ravelry
          </Button>
          {purgeDone !== null && (
            <p className={styles.result}>
              {purgeDone === 0 ? 'Aucun fil concerné.' : `${purgeDone} fil(s) nettoyé(s).`}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={purgeOpen}
        title="Supprimer les données Ravelry"
        message={
          purgeCount === null
            ? 'Vérification en cours…'
            : purgeCount === 0
              ? "Aucun fil n'est actuellement issu du catalogue Ravelry."
              : `${purgeCount} fil(s) seront concernés : les champs encore issus du catalogue seront vidés, le reste (stock, couleur, lot, photo, notes, prix, dates) est conservé.`
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleConfirmPurge()}
        onCancel={() => setPurgeOpen(false)}
      >
        {purging && <p className={styles.helperText}>Suppression en cours…</p>}
      </ConfirmDialog>
    </section>
  )
}
