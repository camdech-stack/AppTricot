import { NavLink } from 'react-router-dom'
import styles from './BottomTabBar.module.css'
import { NAV_ITEMS } from './navItems'

export function BottomTabBar() {
  return (
    <nav className={styles.bar} aria-label="Navigation principale">
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
