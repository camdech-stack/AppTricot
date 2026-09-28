# Modèle des guides de patron

Ce document décrit la structure d'un guide de patron tel qu'implémenté à
l'étape 5a : comment un patron est décomposé, comment l'éditeur manuel le
construit, et comment l'application le sérialise. Il fait foi sur le
modèle — le code de référence vit dans `src/data/guideModel.ts` (types) et
`src/data/guideTree.ts` (fonctions pures de lecture/écriture/validation).

## 1. Vue d'ensemble

Un guide décrit un patron sous forme de quatre niveaux imbriqués :

```
Guide
 └─ Pièce            (ex : dos, devant, manche)
     └─ Section       (ex : côtes, corps, façonnage de l'emmanchure)
         └─ Bloc       (une instruction ou un groupe d'instructions)
             └─ Rang    (une ligne d'instruction, dans les blocs qui en contiennent)
```

Une pièce porte en plus une opération de montage (avant sa première
section) et une opération de finition (après sa dernière) — ce ne sont
pas des sections, elles ne figurent donc pas dans le tableau `sections`.

Contrairement à l'ancien brouillon de ce document (pré-implémentation), un
guide n'appartient **pas** à un seul projet : c'est un modèle réutilisable,
associable à plusieurs projets (`projectGuides`, un lien par couple
projet/guide) et éventuellement à un patron PDF (`guides.patternId`,
nullable). La progression de lecture — où en est-on dans le guide pour un
projet donné — n'est **jamais** stockée dans l'arbre lui-même : depuis
l'étape 5b, elle vit dans une table séparée (`guideProgress`, un
enregistrement par couple projet/guide), pour que le même guide serve de
modèle à plusieurs tricots en parallèle sans qu'ils se marchent dessus —
voir §9.

## 2. Identifiants stables

Chaque nœud (pièce, section, bloc, rang, opération) a un `id` (UUID) qui ne
change **jamais** tant que le nœud existe : le modifier, le déplacer ou le
réordonner ne touche pas à son id. Seule une duplication crée de nouveaux
ids, pour tout le sous-arbre dupliqué. C'est indispensable pour deux
raisons :

- l'étape 5b accrochera la progression et les compteurs à ces ids ;
- l'étape 9 (génération par IA) devra produire des guides dans exactement
  ce format, avec des ids stables dès la génération.

## 3. Pièce

Une pièce a un nom, un type optionnel (`category` — liste fermée : devant,
dos, manche, corps, empiècement, col, capuche, poche, ceinture, ou `other`
avec un libellé libre dans `customCategory` — en plus du nom, jamais à sa
place), des notes libres, une opération de montage optionnelle, une
opération de finition optionnelle, et une liste ordonnée de sections. Le
champ est nommé `category` et non `type` pour ne jamais entrer en
collision avec le `type` discriminant d'un bloc (voir §5) : `updateNode`
retire toute clé `type` d'un patch, quel que soit le nœud visé.

- **Montage** (`castOn`) : `cast_on` (monter les mailles), `pick_up`
  (reprendre des mailles déjà tricotées) ou `join` (joindre en rond ou
  avec un nouveau fil).
- **Finition** (`finish`) : `bind_off` (rabattre), `graft` (greffe/
  Kitchener) ou `three_needle_bind_off` (rabat aux 3 aiguilles).

Une opération porte un nombre de mailles optionnel (les patrons ne le
précisent pas toujours — taille variable, bord irrégulier...), une note
libre, et pour `join` uniquement un mode (`round` ou `new_yarn`).

## 4. Section

Une section a un nom (texte libre, avec des suggestions courantes dans
l'éditeur : côtes/ourlet, corps/motif principal, façonnage de la taille,
de l'emmanchure, des épaules, encolure — mais rien n'empêche d'en saisir
un autre), un type optionnel (`category` — liste fermée : côtes, corps,
mise en forme, jacquard, encolure, épaules, ou `other` avec un libellé
libre dans `customCategory`, même logique additive que pour la pièce), une
méthode de travail (`flat` = à plat, `round` = en rond) et une liste
ordonnée de blocs.

La méthode détermine si le côté d'un rang a un sens : en rond, chaque rang
se travaille à l'endroit et `side` reste toujours `null` ; à plat, un rang
peut préciser `rs` (endroit) ou `ws` (envers). Une pièce peut mélanger les
deux méthodes selon ses sections (une bordure en rond suivie d'un corps à
plat après avoir coupé le fil, par exemple) : la méthode se règle section
par section, jamais au niveau de la pièce.

## 5. Bloc

Un bloc est une union discriminée par `type`, avec deux familles :

- **Feuilles**, qui ne contiennent pas d'autres blocs :
  - `rows` — une suite de rangs numérotés (voir §6) ;
  - `text` — une instruction ou une remarque en texte libre, qui ne se
    découpe pas en rangs (ex. « placer les mailles des manches en attente
    sur un fil auxiliaire »).
- **Conteneurs**, qui encadrent une liste ordonnée d'autres blocs
  (`blocks`), de n'importe quel type, y compris un autre conteneur :
  - `repeat` — répète son contenu `times` fois (entier ≥ 1). Exemple :
    « répéter les rangs 1 et 2, 10 fois » se modélise comme un bloc
    `repeat` (`times: 10`) contenant un bloc `rows` de 2 rangs, soit 20
    rangs comptés au total ;
  - `measure` — répète son contenu jusqu'à atteindre une longueur
    (`length` + `unit`, `cm` ou `in`) mesurée depuis un repère libre
    (`from`, ex. « le montage »), avec des `instructions` libres optionnelles
    (ex. « en augmentant régulièrement ») ;
  - `stitch_count` — répète son contenu jusqu'à atteindre un nombre de
    mailles cible (`target`, entier ≥ 0), avec les mêmes `instructions`
    libres optionnelles (ex. « en diminuant tous les 2 rangs »).

L'imbrication de blocs est limitée à `MAX_BLOCK_NESTING_DEPTH` (4) niveaux
— un bloc directement dans une section est au niveau 1, un bloc dans un
conteneur de niveau 1 est au niveau 2, etc. La limite s'applique à tout
type de bloc, pas seulement aux conteneurs : un patron nécessitant un
5ᵉ niveau est presque certainement une erreur de saisie. `canNest` (dans
`guideTree.ts`) vérifie cette règle avant chaque ajout, et l'éditeur ne
propose que les types encore permis à l'endroit visé.

`countRows`/`computeGuideStats` comptent les rangs « connus » (rangs
directs et répétitions à nombre fixe multipliées) ; un bloc `measure` ou
`stitch_count` a une longueur qui dépend du tricot réel, donc jamais
estimée — il est simplement signalé (`hasVariableLength: true`).

## 6. Rang

Un rang appartient toujours à un bloc `rows`. Il porte :

- `number` — un numéro entier, ou `null` si le patron n'en donne pas ;
- `side` — `rs` (endroit) ou `ws` (envers), toujours `null` dans une
  section en rond ;
- `instructions` — le texte du rang ;
- `stitchesAfter` — le nombre de mailles restantes après ce rang, optionnel.

`parsePastedRows` (utilisé par « Coller plusieurs rangs » dans l'éditeur)
transforme un texte collé (une ligne = un rang) en rangs structurés : elle
détecte un préfixe de numéro (« Rang 12 : », « R12 », « Rg 12 », « 12. »)
et un marqueur de côté (« (END) »/« (ENV) ») n'importe où dans la ligne,
supprime les lignes vides, et propose la numérotation suivante quand
aucun numéro n'est donné.

## 7. Format JSON

Le contenu d'un guide (table `guideContents`, un par guide) est un objet
JSON strict — uniquement des objets, tableaux, chaînes, nombres et
booléens, jamais de `Date`, `Map` ni fonction, pour rester sérialisable
tel quel (export/import à l'étape 7, génération par IA à l'étape 9) :

```jsonc
{
  "schemaVersion": 1,
  "pieces": [
    {
      "id": "piece-1",
      "name": "Dos",
      "category": "back",
      "customCategory": "",
      "castOn": { "id": "op-1", "kind": "cast_on", "stitches": 80, "joinMode": null, "note": "" },
      "sections": [
        {
          "id": "section-1",
          "name": "Côtes",
          "category": "ribbing",
          "customCategory": "",
          "method": "flat",
          "blocks": [
            {
              "id": "block-1",
              "type": "repeat",
              "times": 10,
              "blocks": [
                {
                  "id": "block-2",
                  "type": "rows",
                  "rows": [
                    { "id": "row-1", "number": 1, "side": "rs", "instructions": "*2 m end, 2 m env*, rép.", "stitchesAfter": null },
                    { "id": "row-2", "number": 2, "side": "ws", "instructions": "tricoter les mailles comme elles se présentent", "stitchesAfter": null }
                  ]
                }
              ]
            },
            {
              "id": "block-3",
              "type": "measure",
              "length": 14,
              "unit": "cm",
              "from": "le montage",
              "instructions": "",
              "blocks": [
                { "id": "block-4", "type": "text", "instructions": "Continuer en jersey endroit." }
              ]
            }
          ]
        }
      ],
      "finish": { "id": "op-2", "kind": "bind_off", "stitches": null, "joinMode": null, "note": "" },
      "notes": ""
    }
  ]
}
```

Ce fragment illustre la forme du format, pas un patron réel — le dépôt
étant public, aucun contenu de patron ou de guide réel n'y figure (voir
CLAUDE.md « Confidentialité »).

## 8. Validation et migration

- `validateGuideContent(unknown)` vérifie la structure, les types, les
  contraintes ci-dessus (ids uniques, opérations de montage/finition du
  bon type, profondeur maximale, cohérence section en rond/côté de rang)
  et renvoie une liste d'erreurs lisibles, ou un tableau vide si tout est
  valide.
- `normalizeGuideContent(unknown)` répare ce qui est réparable : ids
  manquants ou en double régénérés, valeurs hors bornes ramenées à un
  défaut sûr, types de bloc inconnus supprimés, sous-arbres au-delà de la
  profondeur maximale tronqués. L'étape 9 s'en servira pour fiabiliser la
  sortie d'un modèle d'IA avant qu'elle n'entre dans l'arbre.
- `migrateGuideContent(content)` est le point d'entrée pour une future
  version de schéma — identité pour la v1 actuelle.

## 9. Suivi et progression

Depuis l'étape 5b, l'application peut suivre un guide pas à pas dans un
projet donné et se souvenir exactement où on en est. Cette section décrit
ce modèle — le code de référence vit dans `src/data/guideProgress.ts`
(moteur de parcours pur et testé) et `src/data/guideProgressRepository.ts`
(couche transactionnelle Dexie construite dessus).

### 9.1 Principe

Un guide (§1-8) reste un modèle immuable pendant qu'on le suit : le
suivre ne modifie jamais `guideContents`. La progression est un objet
séparé, **un par couple (projet, guide)** — le même guide suivi dans deux
projets différents (deux pulls tricotés avec le même patron) a chacun sa
propre position, sans interférence.

Les pièces d'un guide se tricotent **toujours dans l'ordre du tableau
`pieces`, jamais en parallèle ni hors ordre** : on ne peut pas commencer
la manche avant d'avoir fini le dos. La seule exception est la relecture :
une fois une pièce marquée « faite », on peut y revenir consulter ou
corriger un rang sans la rouvrir ni perturber la pièce réellement active.

Un guide peut aussi se parcourir sans aucun projet ni progression du tout
(« Aperçu », menu de l'éditeur) : cette lecture-là ne crée jamais de ligne
dans `guideProgress` — la position vit uniquement en mémoire le temps de
l'aperçu, et l'ordre des pièces n'y est plus contraint puisque rien n'est
réellement tricoté. Voir CLAUDE.md « Aperçu du guide (lecture seule, sans
projet) ».

### 9.2 La table `guideProgress`

Un enregistrement `GuideProgressRecord` (schéma Dexie v12) contient :

- `projectId`, `guideId` — la clé du couple (index composé
  `[projectId+guideId]`) ;
- `activePieceId` — la pièce en cours, ou `null` si aucune n'a encore été
  choisie (avant le premier « Commencer ») ou si le guide est entièrement
  terminé ;
- `pieces` — un objet `{ [pieceId]: PieceProgress }`, une entrée par
  pièce déjà touchée (une pièce jamais commencée n'a simplement pas
  d'entrée) ;
- `linkedCounterId` — l'id d'un compteur du projet à incrémenter/
  décrémenter en miroir de chaque rang validé/annulé, ou `null` (voir
  §9.6) ;
- `startedAt`, `lastAdvancedAt`, `completedAt` (nullable, posé quand
  toutes les pièces sont faites).

Un `PieceProgress` contient :

- `status` — `todo` (jamais commencée), `in_progress` ou `done` ;
- `cursor` — la position exacte dans la pièce (voir §9.3), ou `null` tant
  qu'elle n'a pas démarré ;
- `history` — jusqu'à 100 positions précédentes (la plus récente en
  dernier), pour que « Précédent » retrouve la position exacte d'où l'on
  vient plutôt que de la recalculer ;
- `stepsDone` — le nombre de pas franchis, recalculé entièrement à chaque
  action (jamais accumulé), ce qui le garde juste quel que soit le chemin
  emprunté pour y arriver (un pas normal, un saut via le plan, plusieurs
  passages d'une répétition d'un coup...).

### 9.3 La position (`Cursor`)

Un curseur pointe une position précise **à l'intérieur d'une seule
pièce** — il ne traverse jamais une frontière de pièce, changer de pièce
veut dire charger/créer l'entrée `PieceProgress` de cette autre pièce.

Le parcours d'une pièce suit toujours le même ordre : son montage (s'il y
en a un), puis les blocs de chacune de ses sections dans l'ordre, puis sa
finition (s'il y en a une). À l'intérieur, un bloc `rows` déroule ses
rangs un par un, un bloc `text` est un seul pas, un bloc `repeat(N fois)`
boucle automatiquement sur ses N passages, et un bloc `measure`/
`stitch_count` ne boucle **jamais** tout seul : la fin de chaque passage
de son contenu ouvre systématiquement un point de contrôle qui demande
« Longueur/nombre de mailles atteint ? » (voir §9.4). Un bloc vide, ou un
bloc `rows` sans aucun rang, ne représente aucun pas à franchir.

Le curseur lui-même a quatre champs :

- `nodeId` — l'id du rang, du bloc texte, de l'opération de montage/
  finition, ou du bloc mesure/nombre de mailles concerné ;
- `step` — laquelle de ces cinq natures de position `nodeId` représente
  (`operation`, `row`, `text`, `single` = un bloc mesure/nombre de
  mailles sans enfant à dérouler, ou `checkpoint` = ce même type de bloc
  mais à son point de contrôle) ;
- `blockId` — pour un rang seulement, l'id de son bloc `rows` (sert à
  retomber sur un autre rang du même bloc si le rang exact a été
  supprimé, voir §9.5) ;
- `passages` — combien de fois chaque répétition/mesure/comptage de
  mailles ancêtre de cette position a déjà été parcouru, reconstruit
  entièrement à chaque calcul (jamais recopié tel quel, pour ne jamais
  garder une entrée qui ne correspond plus à rien).

### 9.4 Avancer, reculer, sauter

- **Avancer** (« Rang suivant » / « J'ai fini » / « Continuer », selon la
  nature du pas courant) déroule le pas normal suivant. À l'intérieur
  d'une répétition, ça enchaîne automatiquement sur le passage suivant
  tant qu'il en reste, puis continue après elle une fois épuisée. En
  sortant d'un bloc mesure/nombre de mailles, ça ouvre son point de
  contrôle plutôt que d'avancer tout seul.
- **Le point de contrôle** d'un bloc mesure/nombre de mailles offre trois
  réponses : « Oui, continuer » (sort du bloc et avance après lui),
  « Pas encore, refaire un passage » (redémarre son contenu pour un
  passage de plus) et « Terminer ce bloc maintenant » (sort tout de suite,
  quel que soit l'avancement du passage en cours — utile pour un bloc
  qu'on a en fait déjà dépassé en tricotant). Ce dernier choix est aussi
  proposé directement depuis n'importe quel pas *à l'intérieur* d'un tel
  bloc, pas seulement à son point de contrôle.
- **Reculer** (« Précédent ») retrouve d'abord la position exacte
  précédente dans l'historique quand il y en a une. Sans historique, il
  la recalcule structurellement — ce qui n'est pas toujours possible :
  une fois qu'on a quitté un bloc mesure/nombre de mailles, combien de
  passages il a réellement pris n'est plus récupérable (rien ne l'a
  enregistré) — dans ce cas précis, reculer ne bouge simplement pas
  plutôt que de deviner un nombre arbitraire.
- **Sauter** (« Aller ici », depuis le plan du guide) place le curseur
  directement sur un rang/bloc choisi, sans redérouler ce qu'il y a entre
  les deux. Chaque répétition/mesure/comptage ancêtre reprend au passage 1,
  sauf celle qui contient directement la cible : elle garde le passage où
  l'on était déjà si on y était, sinon 1. Sauter vers une pièce autre que
  celle en cours n'est permis que si cette pièce est déjà entièrement
  faite — c'est la seule façon de revoir/corriger une pièce terminée sans
  jamais la rouvrir ni toucher au compteur lié.

### 9.5 Le guide change pendant qu'on le suit

Rien n'empêche de corriger une coquille, ou de supprimer le rang courant,
pendant qu'on suit un guide (« Corriger », voir CLAUDE.md « Décisions
d'interface (étape 5b) »). Après une telle modification, le curseur est
réparé au mieux, dans cet ordre : (1) si le rang exact a disparu mais que
son bloc `rows` existe encore avec au moins un autre rang, on retombe sur
son premier rang restant ; (2) sinon, on cherche le conteneur ancêtre
(répétition/mesure/comptage de mailles) le plus proche qui existe encore,
et on retombe sur son premier pas ; (3) en dernier recours, on retombe
tout au début de la pièce. Une répétition simplement raccourcie (moins de
passages qu'avant) n'est pas traitée comme « disparue » : le passage
enregistré est juste ramené à la dernière valeur encore valide. Il n'y a
pas de copie de l'arbre tel qu'il était avant la modification, donc
« le plus proche » ici veut dire « le plus proche atteignable avec ce
qui reste », pas forcément le voisin exact d'avant.

### 9.6 Compteur intégré (optionnel)

Un guide suivi dans un projet peut être associé à l'un des compteurs de
ce projet (`linkedCounterId`, menu de l'écran de suivi). Une fois
associé, chaque rang validé ajoute +1 à ce compteur et chaque retour en
arrière sur un rang lui retire -1 (jamais en dessous de 0) — via
exactement la même fonction transactionnelle qu'un appui direct sur
l'écran compteur (étape 1), pour garantir la même fiabilité en cas
d'appuis rapides. Le rang affiché sur l'écran de suivi reste toujours
celui du guide lui-même ; le compteur lié n'est qu'un miroir optionnel,
pratique pour retrouver le même chiffre qu'affichait un patron papier. Un
pas qui n'est pas un rang (texte, montage/finition, point de contrôle) ne
touche jamais le compteur lié.

### 9.7 Chrono et sessions

Suivre un guide alimente le suivi du temps de l'étape 2 exactement comme
un compteur : chaque action d'avancement (« Rang suivant », « Précédent »,
réponse à un point de contrôle...) ouvre ou prolonge une session avec
`origin: 'guide'` sur le projet suivi, via la même `recordActivity` qu'un
appui de compteur. Démarrer le guide (« Commencer »/« Reprendre ») démarre
la session ; ouvrir l'écran de suivi, ou modifier le guide depuis
« Corriger », ne démarre jamais rien tout seul. Le bouton de chrono de
l'écran de suivi est le même composant (`ChronoButton`) que celui de
l'écran compteur.

### 9.8 Progression du projet

Depuis l'étape 5b, la progression affichée sur la fiche projet et dans la
liste des projets (`computeProjectProgress`) privilégie les guides liés
au projet dès que l'un d'eux a au moins un pas connu : c'est la somme
« pas faits / pas connus » de tous les guides liés au projet qui devient
le pourcentage affiché, plutôt que le calcul par compteur des étapes
précédentes (qui reste le repli pour un projet sans guide utilisable).
Un bloc mesure/nombre de mailles ne compte qu'un seul passage dans le
total « connu », même si plus de passages sont réellement faits, pour ne
jamais faire dépasser 100 % à un projet.

`getResumeSummary`/`getProjectResumeSummary` (respectivement dans
`guideProgress.ts` et `guideProgressRepository.ts`) donnent une
description prête à afficher (pièce, section, rang ou libellé de bloc,
pourcentage) de la position courante — pensées pour l'étape 6 (« reprise
rapide » de l'accueil), déjà utilisées par la carte « Guide de patron » de
la fiche projet.
