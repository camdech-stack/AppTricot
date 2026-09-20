import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui'
import { useNavigate } from 'react-router-dom'
import styles from './RavelryDiagnosticPage.module.css'
import { getLastRavelryCall, type LastRavelryCall } from '../client'

// Hidden screen (never linked from the app nav) for reporting a mismapped
// Ravelry field back during development — see CLAUDE.md. Reads only the
// in-memory last-call record; nothing here is persisted.
export function RavelryDiagnosticPage() {
  const navigate = useNavigate()
  const [call, setCall] = useState<LastRavelryCall | null>(getLastRavelryCall())

  useEffect(() => {
    const interval = setInterval(() => setCall(getLastRavelryCall()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.page}>
      <PageHeader title="Diagnostic Ravelry" onBack={() => navigate('/reglages')} />
      {!call ? (
        <p>Aucun appel Ravelry effectué depuis le dernier chargement de l'application.</p>
      ) : (
        <>
          <div className={styles.section}>
            <strong>Chemin</strong>
            <pre className={styles.pre}>{call.path}</pre>
          </div>
          <div className={styles.section}>
            <strong>Statut HTTP</strong>
            <pre className={styles.pre}>{call.status ?? '—'}</pre>
          </div>
          <div className={styles.section}>
            <strong>Champs de premier niveau (réponse brute)</strong>
            <pre className={styles.pre}>{JSON.stringify(call.topLevelFields, null, 2)}</pre>
          </div>
          <div className={styles.section}>
            <strong>Champs du premier résultat</strong>
            <pre className={styles.pre}>{JSON.stringify(call.firstResultFields, null, 2)}</pre>
          </div>
          <div className={styles.section}>
            <strong>Résultat du mapping</strong>
            <pre className={styles.pre}>{JSON.stringify(call.mappedResult, null, 2)}</pre>
          </div>
        </>
      )}
    </div>
  )
}
