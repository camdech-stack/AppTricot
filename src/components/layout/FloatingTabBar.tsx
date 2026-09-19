import { NavLink } from 'react-router-dom'
import styles from './FloatingTabBar.module.css'
import { NAV_ITEMS } from './navItems'

// One component with two renderings, switched by CSS media query (see
// FloatingTabBar.module.css): a floating pill on phones, a side rail on
// iPad/desktop. Keeping both in the DOM avoids re-mounting nav state at the
// breakpoint; the hidden one is display:none, so it's inert for a11y too.
export function FloatingTabBar() {
  return (
    <>
      <nav className={styles.pillBar} aria-label="Navigation principale">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) => `${styles.pillLink} ${isActive ? styles.pillLinkActive : ''}`}
          >
            <Icon size={22} />
            <span className={styles.pillLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <nav className={styles.sideBar} aria-label="Navigation principale">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `${styles.sideLink} ${isActive ? styles.sideLinkActive : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
