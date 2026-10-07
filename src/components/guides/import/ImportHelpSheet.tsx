import { Sheet } from '../../ui'
import styles from './GuideImport.module.css'

interface ImportHelpSheetProps {
  open: boolean
  onClose: () => void
}

export function ImportHelpSheet({ open, onClose }: ImportHelpSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Comment ça marche ?">
      <div className={styles.help}>
        <p>Cette app ne contacte aucun service d’intelligence artificielle, et rien de ce que tu importes ici ne quitte ton appareil.</p>
        <p>Pour convertir un patron PDF en guide :</p>
        <ol>
          <li>Ouvre une conversation avec l’assistant IA de ton choix (comme Claude) et joins ton patron PDF.</li>
          <li>Demande-lui de le convertir au format de guide attendu par cette app (pièces, sections, blocs, rangs), en JSON.</li>
          <li>Copie le résultat, ou enregistre-le dans un fichier .json.</li>
          <li>Reviens ici : colle le texte ou choisis le fichier, puis touche « Vérifier ».</li>
        </ol>
        <p>Tu verras un aperçu et la liste des problèmes éventuels avant que quoi que ce soit soit créé. Si le résultat contient des erreurs, tu peux copier le détail technique et le renvoyer à l’assistant pour qu’il corrige.</p>
        <p>Le format exact est documenté dans <code>docs/Guidespatrons.md</code> du projet, pour toute personne qui voudrait écrire son propre modèle de conversion. Les champs facultatifs <code>name</code>, <code>craft</code> (« knitting » ou « crochet ») et <code>sizeLabel</code>, à côté de <code>pieces</code>, préremplissent le formulaire.</p>
      </div>
    </Sheet>
  )
}
