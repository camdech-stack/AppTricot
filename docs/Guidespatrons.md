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
projet donné — n'est **jamais** stockée dans l'arbre lui-même : l'étape 5b
l'ajoutera dans une table séparée, indexée par (projet, guide, id de
nœud), pour que le même guide serve de modèle à plusieurs tricots en
parallèle sans qu'ils se marchent dessus.

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

Une pièce a un nom, des notes libres, une opération de montage optionnelle,
une opération de finition optionnelle, et une liste ordonnée de sections.

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
un autre), une méthode de travail (`flat` = à plat, `round` = en rond) et
une liste ordonnée de blocs.

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
    (`from`, ex. « le montage ») ;
  - `stitch_count` — répète son contenu jusqu'à atteindre un nombre de
    mailles cible (`target`, entier ≥ 0).

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
- `text` — l'instruction du rang ;
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
      "castOn": { "id": "op-1", "kind": "cast_on", "stitches": 80, "joinMode": null, "note": "" },
      "sections": [
        {
          "id": "section-1",
          "name": "Côtes",
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
                    { "id": "row-1", "number": 1, "side": "rs", "text": "*2 m end, 2 m env*, rép.", "stitchesAfter": null },
                    { "id": "row-2", "number": 2, "side": "ws", "text": "tricoter les mailles comme elles se présentent", "stitchesAfter": null }
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
              "blocks": [
                { "id": "block-4", "type": "text", "text": "Continuer en jersey endroit." }
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
