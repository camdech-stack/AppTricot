import { Outlet } from 'react-router-dom'
import styles from './AppLayout.module.css'
import { AppHeader } from './AppHeader'
import { BottomTabBar } from './BottomTabBar'
import { SideNav } from './SideNav'

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <SideNav />
      <div className={styles.main}>
        <AppHeader />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
      <BottomTabBar />
    </div>
  )
}
