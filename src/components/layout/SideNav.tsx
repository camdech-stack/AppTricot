import { NavLink } from 'react-router-dom'
import styles from './SideNav.module.css'
import { NAV_ITEMS } from './navItems'
import { APP_NAME } from '../../config/appInfo'

export function SideNav() {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <div className={styles.brand}>{APP_NAME}</div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
