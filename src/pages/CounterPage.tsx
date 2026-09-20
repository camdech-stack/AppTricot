import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ListOrdered, Settings } from 'lucide-react'
import styles from './CounterPage.module.css'
import { IconButton, WaveDivider } from '../components/ui'
import { CounterPanel, type CounterPanelHandle } from '../components/counters/CounterPanel'
import { useProject } from '../hooks/useProject'
import { useWakeLock } from '../hooks/useWakeLock'
import { getOrCreateStandaloneCounter } from '../data'

export function CounterPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const isStandalone = !projectId

  const project = useProject(projectId)
  const panelRef = useRef<CounterPanelHandle>(null)

  useEffect(() => {
    if (!isStandalone) return
    getOrCreateStandaloneCounter().catch((error: unknown) => {
      console.error('Failed to load standalone counter', error)
    })
  }, [isStandalone])

  useWakeLock(true)

  function handleBack() {
    navigate(projectId ? `/projets/${projectId}` : '/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.topBar}>
          <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" className={styles.heroIconButton} onClick={handleBack} />
          {isStandalone ? (
            <div className={styles.avatar}>
              <ListOrdered size={22} strokeWidth={1.75} />
            </div>
          ) : (
            <div className={styles.projectName}>{project?.name}</div>
          )}
          <IconButton
            icon={<Settings strokeWidth={1.75} />}
            label="Menu du compteur"
            className={styles.heroIconButton}
            onClick={() => panelRef.current?.openMenu()}
          />
        </div>
      </div>
      <WaveDivider />

      <CounterPanel ref={panelRef} projectId={projectId ?? null} project={project} isStandalone={isStandalone} />
    </div>
  )
}
