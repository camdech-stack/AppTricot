import { NavLink } from 'react-router-dom'
import styles from './AppHeader.module.css'
import { SettingsIcon } from '../icons'
import { APP_NAME } from '../../config/appInfo'

export function AppHeader() {
  return (
    <header className={styles.header}>
      <span className={styles.title}>{APP_NAME}</span>
      <NavLink to="/reglages" className={styles.settingsLink} aria-label="Réglages">
        <SettingsIcon />
      </NavLink>
    </header>
  )
}
