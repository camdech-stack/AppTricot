import { Rows3 } from 'lucide-react'
import styles from './HomePage.module.css'
import { SectionTitle, SquareTile } from '../components/ui'

export function HomePage() {
  return (
    <div className={styles.page}>
      <h1>Accueil</h1>

      <section className={styles.section}>
        <SectionTitle title="Outils" />
        <div className={styles.tools}>
          <SquareTile to="/compteur" icon={<Rows3 size={28} strokeWidth={1.75} />} label="Compteur de rang" />
        </div>
      </section>

      <p className={styles.note}>
        La reprise rapide de vos projets récents et vos statistiques arriveront ici (étape 6).
      </p>
    </div>
  )
}
