import { Outlet } from 'react-router-dom'
import styles from './AppLayout.module.css'
import { AppHeader } from './AppHeader'
import { FloatingTabBar } from './FloatingTabBar'

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <FloatingTabBar />
      <div className={styles.main}>
        <AppHeader />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
