import styles from './Logo.module.css'
import { YarnBallIcon } from './icons'
import { APP_NAME } from '../config/appInfo'

// Provisional: a real logo is still to be designed. Kept as one component
// so swapping it later doesn't touch every call site (header, side nav,
// styleguide).
export function Logo() {
  return (
    <span className={styles.logo}>
      <YarnBallIcon size={24} className={styles.mark} />
      <span className={styles.name}>{APP_NAME}</span>
    </span>
  )
}
