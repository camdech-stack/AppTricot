import { NavLink } from 'react-router-dom'
import styles from './AppHeader.module.css'
import { SettingsIcon } from '../icons'
import { Logo } from '../Logo'

export function AppHeader() {
  return (
    <header className={styles.header}>
      <Logo />
      <NavLink to="/reglages" className={styles.settingsLink} aria-label="Réglages">
        <SettingsIcon size={22} />
      </NavLink>
    </header>
  )
}
