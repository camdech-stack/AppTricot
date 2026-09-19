# Modèle de données — Guide de patron

Ce document décrit la structure interne d'un guide de patron : comment un patron
est décomposé, comment l'utilisateur (ou plus tard un import automatisé) le
construit, et comment l'application retient où en est le tricot. Il précède
l'implémentation (étapes 5a et 5b de la feuille de route) ; il sert de
contrat entre le schéma Dexie, l'éditeur de guide (étape 5a) et le mode
suivi (étape 5b).

Toutes les entités listées suivent la convention `BaseEntity` du projet
(`id`, `createdAt`, `updatedAt`, voir `src/data/types.ts`) : elle n'est pas
répétée à chaque interface ci-dessous, mais s'applique à toute entité
persistée séparément (le guide, chaque pièce, chaque section...). Les
sous-objets purement imbriqués (un rang à l'intérieur d'un bloc, par exemple)
n'ont pas besoin d'`updatedAt` propre : leur modification met à jour l'entité
parente qui les contient.

L'ensemble doit rester sérialisable en JSON strict (pas de `Map`, `Set`,
`Date`, fonctions...) pour permettre l'export/import (étape 7) et, plus tard,
la génération par IA (étape 9) : un guide produit automatiquement doit avoir
exactement la même forme qu'un guide saisi à la main.

## 1. Vue d'ensemble

Un guide appartient à un projet et décrit un patron sous forme de quatre
niveaux imbriqués :

```
Guide
 └─ Pièce            (ex : dos, devant, manche)
     └─ Section       (ex : bordure, corps, diminutions)
         └─ Bloc       (une instruction ou un groupe d'instructions)
             └─ Rang    (une ligne d'instruction, dans les blocs qui en contiennent)
```

Une pièce peut aussi porter une opération de départ et une opération
d'aboutissement, hors de toute section (voir §3). Un bloc peut contenir soit
des rangs, soit du texte libre, soit d'autres blocs (voir §5).

## 2. Racine : le guide

```ts
interface PatternGuide {
  projectId: string          // référence vers le projet propriétaire
  title: string
  source: 'manual' | 'aiGenerated'
  pieces: GuidePiece[]       // ordre = ordre d'affichage/de tricot
  progress: GuideProgress    // position de reprise, voir §7
}
```

`source` distingue un guide saisi manuellement d'un guide qui viendra plus
tard d'un import IA (étape 9) — le champ existe dès maintenant pour que le
schéma n'ait pas à changer de forme quand cette étape arrivera, même si seule
la valeur `'manual'` est produite pour l'instant.

## 3. Pièce

```ts
type PieceOperation =
  | { kind: 'castOn'; stitchCount?: number; instructions: string }
  | { kind: 'pickUpStitches'; stitchCount?: number; instructions: string }
  | { kind: 'join'; instructions: string }

type PieceCompletion =
  | { kind: 'bindOff'; instructions: string }
  | { kind: 'graft'; instructions: string }
  | { kind: 'threeNeedleBindOff'; instructions: string }

interface GuidePiece {
  guideId: string
  name: string
  position: number           // rang d'affichage parmi les pièces du guide
  opening?: PieceOperation    // absente si le patron ne le précise pas
  sections: GuideSection[]
  closing?: PieceCompletion
}
```

- `opening` et `closing` sont facultatives : une pièce reprise sur des
  mailles déjà en attente peut n'avoir aucune opération de départ propre, une
  pièce qui continue directement sur une autre peut n'avoir aucune opération
  de fin.
- `stitchCount` sur `castOn`/`pickUpStitches` est optionnel : le patron ne
  donne pas toujours un nombre de mailles fixe (taille variable, bord
  irrégulier...).
- Ces deux blocs se placent toujours respectivement avant la première section
  et après la dernière : ce ne sont pas des sections comme les autres, donc
  ils ne figurent pas dans le tableau `sections`.

## 4. Section

```ts
type WorkMethod = 'flat' | 'inTheRound'

interface GuideSection {
  pieceId: string
  name: string
  position: number
  method: WorkMethod
  blocks: GuideBlock[]
}
```

`method` détermine comment l'interface interprète l'endroit/l'envers d'un
rang (voir `GuideRow.side` au §6) : en va-et-vient, les rangs alternent
endroit/envers selon leur parité ; en rond, chaque rang se travaille à
l'endroit et la notion d'envers ne s'applique pas à la section. Une pièce
peut légitimement mélanger les deux (par exemple une bordure en rond suivie
d'un corps travaillé à plat après avoir coupé le fil) : la méthode se règle
section par section, jamais au niveau de la pièce.

## 5. Bloc

Un bloc est une union discriminée par `type`. Deux familles :

- les blocs **feuilles**, qui portent directement une instruction (`rows`,
  `freeText`) ;
- les blocs **conteneurs**, qui encadrent une condition d'arrêt ou de
  répétition et contiennent eux-mêmes une liste ordonnée d'autres blocs
  (`repeat`, `untilLength`, `untilStitchCount`).

```ts
type GuideBlock =
  | RowsBlock
  | FreeTextBlock
  | RepeatBlock
  | UntilLengthBlock
  | UntilStitchCountBlock

interface RowsBlock {
  type: 'rows'
  rows: GuideRow[]
}

interface FreeTextBlock {
  type: 'freeText'
  instructions: string
}

interface RepeatBlock {
  type: 'repeat'
  repeatCount: number         // nombre total d'exécutions, ≥ 1
  children: GuideBlock[]
}

interface UntilLengthBlock {
  type: 'untilLength'
  targetValue: number
  unit: LengthUnit             // réutilise le type existant de src/data/types.ts
  measuredFrom: 'pieceStart' | 'sectionStart' | 'blockStart'
  children: GuideBlock[]
}

interface UntilStitchCountBlock {
  type: 'untilStitchCount'
  targetStitchCount: number
  comparator: 'equalTo' | 'atMost' | 'atLeast'
  children: GuideBlock[]
}
```

Règles d'imbrication :

- `children` n'existe que sur les trois types conteneurs ; un bloc `rows` ou
  `freeText` est toujours une feuille de l'arbre.
- Un conteneur peut contenir n'importe quelle combinaison des cinq types de
  bloc, y compris un autre conteneur du même type ou d'un type différent (une
  cible de longueur peut par exemple envelopper une répétition, qui elle-même
  enveloppe un bloc de rangs) : il n'y a pas de limite de profondeur imposée
  par le modèle.
- Un conteneur avec un tableau `children` vide est valide à l'état
  intermédiaire (pendant l'édition) mais ne doit pas être considéré comme
  terminé : l'interface d'édition doit inviter à ajouter au moins un bloc
  enfant avant de quitter l'éditeur.
- L'ordre des éléments dans `sections`, `blocks`, `children` et `rows` est
  toujours significatif et porté par la position dans le tableau — pas de
  champ `position` séparé à ce niveau, contrairement aux pièces et sections
  qui sont des entités indépendantes réordonnables indépendamment de leur
  tableau parent.

## 6. Rang

```ts
type RowSide = 'right' | 'wrong'

interface GuideRow {
  label?: string               // numéro ou repère tel qu'écrit dans le patron, ex. "12" ou "12a"
  side?: RowSide                // absent quand la section est en rond
  instructions: string
}
```

- `label` est un texte libre plutôt qu'un entier : certains patrons numérotent
  avec des suffixes ou des sauts volontaires, et le guide doit pouvoir
  reproduire cette numérotation sans la recalculer.
- `side` ne se renseigne que pour les sections `flat` ; il reste absent pour
  une section `inTheRound`, où chaque rang est implicitement à l'endroit.

## 7. Progression et reprise

Le guide retient la position courante pour permettre une reprise immédiate
(section 15 du cahier des charges). La position se décrit comme un chemin
dans l'arbre plutôt que par un identifiant unique, car les rangs et les
blocs imbriqués n'ont pas forcément d'identité stable en dehors de leur
position dans leurs tableaux parents :

```ts
interface BlockPathStep {
  blockIndex: number            // index dans le tableau `blocks`/`children` parcouru
  iteration?: number             // itération courante si ce bloc est un `repeat`
}

interface GuideProgress {
  pieceIndex: number
  sectionIndex: number
  blockPath: BlockPathStep[]     // un élément par niveau d'imbrication traversé
  rowIndex?: number              // position dans `rows` si le bloc courant est de type `rows`
  note?: string
}
```

- `blockPath` contient un élément par niveau de conteneur traversé pour
  atteindre le bloc actif ; sa longueur varie donc selon la profondeur
  d'imbrication du patron à cet endroit précis.
- `iteration` n'a de sens que pour un pas dont le bloc référencé est de type
  `repeat` ; il mémorise combien de passages ont déjà été effectués pour
  savoir si le prochain « rang suivant » boucle ou sort du bloc.
- Cette structure ne duplique pas les compteurs de rangs de l'étape 1
  (compteurs multiples par projet) : elle indique *où* on en est dans le
  texte du guide, tandis qu'un compteur associé indique *combien* de rangs
  ont été tricotés. Les deux coexistent et peuvent être liés par un futur
  champ, à définir au moment de l'implémentation du mode suivi (étape 5b).

## 8. Invariants à valider côté application

Ces règles ne sont pas exprimables par le seul système de types et doivent
être vérifiées par le code d'accès aux données ou l'éditeur :

1. `pieces`, `sections`, `blocks`, `children` et `rows` ne sont jamais vides
   une fois le guide marqué comme terminé (voir §5) — vide est seulement
   toléré pendant une édition en cours.
2. `repeatCount` est un entier strictement positif.
3. `position` (pièces, sections) est unique et contiguë au sein de son
   parent ; un réordonnancement réécrit les `position` de tous les éléments
   du même parent plutôt que d'introduire des trous.
4. `GuideProgress` doit toujours pointer vers un chemin qui existe réellement
   dans le guide au moment de la lecture ; toute suppression d'une pièce,
   section, bloc ou rang situé avant ou sur la position courante doit
   recalculer `progress` pour éviter un pointeur invalide.
5. `side` sur `GuideRow` est incohérent (et doit être ignoré ou refusé à la
   saisie) si la section englobante est `inTheRound`.

## 9. Exemple minimal (illustratif, pas un patron réel)

Un fragment montrant une section en rond avec une cible de longueur
enveloppant une répétition :

```json
{
  "name": "Corps",
  "method": "inTheRound",
  "blocks": [
    {
      "type": "untilLength",
      "targetValue": 18,
      "unit": "m",
      "measuredFrom": "sectionStart",
      "children": [
        {
          "type": "repeat",
          "repeatCount": 6,
          "children": [
            {
              "type": "rows",
              "rows": [
                { "label": "1-3", "instructions": "tout en jersey" },
                { "label": "4", "instructions": "1 diminution répartie" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Ce fragment illustre uniquement l'imbrication ; le contenu textuel des rangs
est arbitraire et ne provient d'aucun patron réel.
