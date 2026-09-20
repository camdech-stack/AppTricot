# CLAUDE.md — Tricot

Ce fichier est la référence de travail pour tout agent (Claude ou humain) qui intervient sur ce dépôt.

## Résumé de l'application

"Tricot" est une PWA personnelle et privée (un seul utilisateur, pas de compte, pas de paiement, aucune fonctionnalité sociale) pour centraliser :

- la gestion des projets de tricot/crochet (statut, patron associé, laine, notes, progression) ;
- des compteurs de rangs multiples par projet, plus un compteur autonome ;
- le suivi du temps de travail par session ;
- une bibliothèque de patrons PDF avec visionneuse intégrée ;
- des guides de patrons structurés (manuels, puis analysés par IA plus tard) avec mode tricot ;
- un stock de laine avec suivi de consommation et vérification de disponibilité ;
- des statistiques personnelles.

Cible principale : iPhone/iPad (Safari, installée sur l'écran d'accueil), utilisable d'une seule main pendant le tricot. Fonctionne aussi sur ordinateur. Offline-first, aucun backend pour l'instant. Hébergée sur GitHub Pages (site statique).

Le nom de l'application est centralisé dans `src/config/appInfo.ts` (`APP_NAME`) — c'est la seule chose à changer pour renommer l'app. Le manifest PWA garde sa propre copie de ce nom dans `vite.config.ts` (contrainte technique : le manifest est généré côté build, avant que le code applicatif ne soit exécuté) ; les deux doivent rester synchronisés, un commentaire le rappelle à chaque endroit.

Le cahier des charges complet est dans `docs/SPEC`. C'est la référence fonctionnelle, mais on n'implémente jamais tout d'un coup : on avance étape par étape (voir Feuille de route ci-dessous), une seule à la fois, validée par l'utilisateur avant de passer à la suivante.

## Stack

- Vite + React + TypeScript (mode strict)
- Dexie (IndexedDB) pour les données, via un module d'accès unique (`src/data`)
- vite-plugin-pwa (manifest + service worker)
- React Router (`createHashRouter`, HashRouter — nécessaire sur GitHub Pages, qui ne sait pas réécrire les routes côté serveur)
- CSS Modules (pas de librairie UI), système de tokens dans `src/styles/tokens.css`
- lucide-react pour les icônes (+ `YarnBallIcon`, une icône perso pour l'onglet Laine)
- Polices variables installées en local (`@fontsource-variable/outfit`, `@fontsource-variable/dm-sans`), jamais de CDN
- Interface en français, code/variables/commentaires en anglais

Ne pas ajouter d'autre dépendance sans validation explicite de l'utilisateur. Si une alternative semble meilleure, la justifier en 2 lignes avant de l'utiliser.

## Conventions de code

- TypeScript strict partout (`strict: true` dans les deux tsconfig). Pas de `any` non justifié.
- Toute entité persistée a un `id` (UUID via `crypto.randomUUID()`, voir `src/data/id.ts`), un `createdAt` et un `updatedAt` (ISO string). Voir `BaseEntity` dans `src/data/types.ts`.
- Aucun appel Dexie direct dans les composants : tout passe par `src/data` (le module unique d'accès aux données) ou par un hook construit dessus (ex. `src/hooks/useSettings.ts`, basé sur `Dexie.liveQuery`).
- Schéma Dexie versionné : ne jamais modifier un `.version(n)` déjà publié. Toute évolution de schéma ajoute un nouveau `.version(n + 1)` avec `.upgrade()` si besoin d'une migration de données. Voir le commentaire en tête de `src/data/db.ts`.
- Composants et fichiers CSS associés en `Composant.module.css` à côté du composant.
- Pas de commentaire qui décrit ce que fait le code ; seulement le pourquoi quand ce n'est pas évident (contrainte cachée, choix technique non intuitif).

## Principes de design

- **Offline-first** : toute fonctionnalité listée à la section 25 du cahier des charges doit fonctionner sans réseau, y compris juste après l'installation. Les polices sont installées en local et précachées par le service worker (`globPatterns` inclut `woff2` dans `vite.config.ts`) pour la même raison.
- **Mobile-first** : on conçoit d'abord pour iPhone, puis on adapte à iPad/ordinateur (navigation latérale plutôt que pilule flottante au-delà de 768px, voir `src/components/layout/FloatingTabBar`).
- **Utilisable d'une seule main** : les actions fréquentes (compteurs, navigation principale) doivent être atteignables par le pouce, en bas d'écran.
- **Gros boutons tactiles** : zone tactile minimale 48px (`--tap-min`), boutons de comptage 72px minimum (`--counter-btn-min`).
- **Safe areas iOS** : toujours respecter `env(safe-area-inset-*)` (variables `--safe-top/bottom/left/right` définies dans `src/styles/tokens.css`) sur les éléments collés aux bords de l'écran (header, barre flottante, contenu plein écran), y compris en paysage sur iPad (safe areas gauche/droite).
- **Thème clair uniquement.** Ne pas ajouter de mode sombre sans demande explicite de l'utilisateur : pas de `prefers-color-scheme: dark`, pas de réglage de thème, pas de valeurs sombres dans les tokens. `color-scheme: light` et les meta iOS/manifest sont alignés sur le fond crème (`#FCF8F3`).
- Design 100 % original, style doux/chaleureux/artisanal inspiré du tricot (fond crème, framboise en couleur principale, cartes très arrondies, séparations ondulées, motif de rayures) : le cahier des charges s'inspire des fonctionnalités d'une app existante, mais on ne reprend ni son nom, ni son logo, ni son design visuel.

## Système de design

- Tous les tokens (couleurs, rayons, espacements, tailles de texte, ombres, transitions, zones tactiles, safe areas) vivent dans `src/styles/tokens.css`, seul fichier de ce type. Aucune valeur en dur dans les composants : toujours passer par un token.
- Motif de rayures (signature visuelle, rappel du tricot) : utilitaire CSS dans `src/styles/patterns.module.css` (`.stripes` + une classe par couleur de projet), utilisé par `StripedProgressBar` et à réutiliser pour les couvertures de projet par défaut.
- Composants de base réutilisables dans `src/components/ui` : `Button`, `IconButton`, `Card`, `HeroCard`, `Pill`, `StatTile`, `ProgressRing` (accepte `color`/`trackColor` pour une couleur personnalisée), `StripedProgressBar`, `WaveDivider`, `PageHeader`, `SectionTitle`, `Sheet` (feuille modale générique), `ConfirmDialog` (confirmation obligatoire, basé sur `Sheet`), `SquareTile` (raccourci carré type icône, pour la section "Outils" de l'accueil). Aucun ne contient de logique métier.
- Couleur d'un projet appliquée à son interface via `src/components/projects/colorMeta.ts` (`projectColorVar`, `projectColorSoftVar`, `projectGradient`) : en-tête de la fiche projet, anneau de progression, bouton "Continuer", encadré des cartes dans la liste.
- Navigation : `FloatingTabBar` (`src/components/layout`) est un seul composant à deux rendus pilotés par media query — pilule flottante sur mobile, navigation latérale à partir de 768px. Les Réglages restent accessibles via l'icône `Settings` dans `AppHeader`, pas dans la barre de navigation.
- Icônes : lucide-react (trait 1.75, tailles 20/24/28), wrappées dans `src/components/icons/lucide.tsx` pour appliquer le trait uniformément. `YarnBallIcon` (`src/components/icons/YarnBallIcon.tsx`) est une icône SVG perso pour l'onglet Laine et le `Logo` (`src/components/Logo.tsx`, provisoire, lit `APP_NAME`).
- Page `/#/styleguide` (`src/pages/StyleguidePage.tsx`) : référence visuelle vivante — palette, échelles, typographie, icônes, composants dans leurs variantes, couleurs de projet avec rayures, et un exemple de page type. À tenir à jour à chaque ajout de token ou de composant.
- Couleurs de projet (prune, pervenche, terracotta, pêche, rouge, rose) : chacune a une variante `-soft` dérivée via `color-mix()` dans les tokens. Le doré et le sage ne servent jamais pour du petit texte (contraste insuffisant sur fond crème) : uniquement fonds/icônes/barres/badges.
- Croquis de référence dans `docs/design/sketches/` (compteur, accueil, fiche projet), pour les étapes 1 et 6 :
  - Compteur : gros boutons dans la moitié basse de l'écran (zone du pouce), +1 nettement le plus grand, -1 plus petit et à l'écart de +1.
  - Accueil et fiche projet : même anneau de progression (`ProgressRing`) et même bouton d'action principal.

## Règles de travail

- **Une étape à la fois.** Ne jamais implémenter une fonctionnalité qui appartient à une étape future de la feuille de route, même si elle semble facile ou liée.
- Avant de commencer une étape, s'assurer d'avoir bien compris son périmètre exact ; poser des questions courtes en cas d'ambiguïté plutôt que de deviner un scope plus large.
- Commits petits et clairs, un sujet cohérent par commit (pas de "gros commit fourre-tout").
- À la fin de chaque étape : lancer typecheck, lint et build, corriger les erreurs, puis s'arrêter et attendre la validation de l'utilisateur avant de continuer.
- Ne pas committer de contenu personnel : PDF de patrons, sauvegardes, photos, clés API. Voir `.gitignore`.

## Fonctionnalités explicitement exclues

D'après la section « Confidentialité » du cahier des charges (l'app est mono-utilisateur, aucune fonctionnalité sociale n'est nécessaire), ne jamais implémenter :

- profils publics ;
- followers / abonnés ;
- likes ;
- commentaires ;
- fil d'actualité ;
- messagerie ;
- partage communautaire / publication sociale intégrée.

Par ailleurs, pas de compte utilisateur ni de système de paiement/abonnement (section 1). Les patrons importés restent privés et ne doivent jamais servir à entraîner un modèle d'IA (section 32).

## Modèle de données (étape 1)

- Schéma Dexie en version 5 (`src/data/db.ts`) : v3 ajoute `projects`, `counters`, `counterEvents`, `coverImages` ; v4 ajoute `sequence` sur `counterEvents` ; v5 ajoute `targetEndDate` sur `projects`. `settings` n'a jamais été touché.
- `projects` : name, craft (tricot/crochet), description, status (à faire/en cours/en pause/terminé), colorKey (une des 6 couleurs de projet — source unique `ProjectColorKey` dans `src/data/types.ts`, réexportée en `ProjectColor` par `StripedProgressBar`), notes, startedAt/completedAt/targetEndDate (dates calendaires `YYYY-MM-DD`, nullable, modifiables à la main — `targetEndDate` est la date de fin *prévue*, distincte de `completedAt` qui est la date de fin *réelle*, posée seulement quand le statut passe à "Terminé"), lastActivityAt, activeCounterId.
- `counters` : projectId (`null` = compteur autonome — jamais indexé par IndexedDB, `getCounters` fait un scan complet uniquement pour ce cas), name, value, goal, position, isMain, lastTappedAt. Un projet a toujours un compteur principal "Rangs" créé avec lui, non supprimable.
- `counterEvents` : counterId, type (increment/decrement/reset/set), delta, valueBefore, valueAfter, undoneAt, sequence (entier strictement croissant par compteur, voir "Fiabilité du compteur"). Jamais supprimé à l'annulation, seulement marqué `undoneAt`.
- `coverImages` : id = projectId (relation 1:1), blob compressé (max 1200 px, JPEG qualité 0,8, orientation EXIF respectée via `createImageBitmap`, avec repli sans cette option si le navigateur la rejette). Compressée dès la sélection du fichier (pas à la soumission du formulaire) : l'original brut n'est jamais décodé dans un `<img>` ni conservé.
- `computeProjectProgress` (`src/data/progress.ts`) est une fonction pure isolée et testée : progression du compteur principal s'il a un objectif, sinon moyenne des compteurs qui en ont un, sinon nombre de rangs affiché tel quel. Sera remplacée par la progression du guide à l'étape 5b. Les cartes de la liste des projets (`ProjectCard`) n'affichent cependant jamais ce nombre de rangs : sans pourcentage calculable, la carte affiche 100 % si le projet est "Terminé", 0 % sinon (voir "Décisions d'interface").

## Fiabilité du compteur

- Chaque +1/-1/+5/remise à zéro/valeur manuelle/annulation passe par une seule transaction Dexie (`src/data/countersRepository.ts`) qui lit la valeur courante dans la transaction (jamais depuis l'état React), met à jour le compteur, ajoute l'événement et touche `lastActivityAt` du projet. Les transactions Dexie sur les mêmes tables sont sérialisées par IndexedDB : des appuis en rafale ne perdent jamais de comptage (testé avec 30 appels concurrents dans `countersRepository.test.ts`).
- Les événements sont ordonnés par `sequence` (entier croissant calculé dans la même transaction que l'écriture), jamais par `createdAt` seul : deux appuis assez rapides pour tomber dans la même milliseconde donneraient sinon un ordre indéterminé, et l'annulation répétée pourrait restaurer la mauvaise valeur.
- L'annulation restaure `valueBefore` du dernier événement non annulé et le marque `undoneAt` ; répétable indéfiniment, pas de "rétablir" pour l'instant.
- Écran allumé via l'API Wake Lock (`useWakeLock`), avec repli silencieux si indisponible, refusée, ou en cas d'échec (à confirmer sur iOS réel).

## Décisions d'interface (étape 1)

- La fiche projet, le formulaire de création/modification et l'écran compteur vivent hors `AppLayout` (routes de premier niveau dans `src/app/router.tsx`) : ils dessinent leur propre en-tête (retour + action), et `PageHeader` réserve donc lui-même la zone de sécurité haute (safe-top) puisque rien d'autre ne le fait sur ces routes. Seules la liste et la fiche projet gardent le `FloatingTabBar` ; l'écran compteur le masque entièrement pour maximiser la place et éviter les faux appuis. Ces pages doivent gérer leur propre défilement (hauteur + `overflow-y: auto`) : `#root` a `overflow: hidden`, donc une page qui ne le fait pas rend son contenu en bas d'écran inatteignable sur un écran court (bug corrigé une fois sur `ProjectFormPage`).
- Feuilles modales génériques `Sheet` et `ConfirmDialog` (`src/components/ui`) réutilisées par tous les éditeurs de compteur (renommer, objectif, valeur, historique) et toutes les confirmations obligatoires (suppression, remise à zéro), ainsi que par le filtre par statut de la liste des projets.
- **Accueil** : contient déjà une section "Outils" avec une tuile `SquareTile` vers le compteur de rangs (`/#/compteur`), en anticipation de l'étape 6 — décision explicite de l'utilisateur, en dehors du périmètre normal de l'étape 1 (qui ne devait pas toucher l'accueil). Le reste de la page (reprise rapide, statistiques) reste à faire à l'étape 6.
- **Compteur de rangs** ("Compteur libre" renommé) : icône `ListOrdered` partout où il apparaît (accueil, avatar du compteur autonome) — même icône que la tuile "Rangs tricotés"/"Rangs actuels" pour rester cohérent. Compteur autonome créé automatiquement au premier accès à `/#/compteur`, mêmes composants et logique transactionnelle qu'un compteur de projet, sans section "Autres compteurs" (un seul compteur, pas de projet associé). Son bouton retour renvoie à l'accueil (d'où il est accessible), pas à la liste des projets.
- **Écran compteur d'un projet** : affiche le nom du projet dans l'en-tête (texte), jamais sa photo — seul le compteur autonome affiche un avatar/icône. Boutons -1/+1/+5 en texte seul, sans icône. Chrono affiché sous "Dernier appui", démarrant au premier appui et arrêtable (`useElapsedTimer`) : **purement visuel, aucune persistance** — c'est un aperçu de ce que fera l'étape 2 (suivi du temps réel, sessions, reprise après fermeture), pas une implémentation partielle de cette étape.
- **Liste des projets** : grille 2 colonnes dès mobile (3 à partir de 1024px). Les pills de filtre par statut ne sont plus toujours visibles : elles vivent dans une feuille ouverte par une icône à côté de "+ Nouveau" (icône en surbrillance quand un filtre autre que "Tous" est actif).
- **Carte projet** (`ProjectCard`) : tuile avec photo (ou motif rayé dans la couleur du projet) plein cadre, encadré de la couleur du projet, pill de statut et badge de progression qui chevauchent la photo (registre volontairement moins figé que le reste de l'interface), badge vert quand le projet est terminé, date de fin prévue en surimpression. Affiche toujours un pourcentage (jamais un nombre de rangs, voir "Modèle de données").
- **Fiche projet** : en-tête en photo du projet (avec dégradé sombre pour la lisibilité) quand il y en a une, sinon dégradé dans la couleur du projet (`projectGradient`) — pas d'emplacement photo séparé plus bas. Date de début et date de fin prévue (ou date de fin réelle si "Terminé") affichées sous les pills de statut/type. Badge vert à côté du nom si "Terminé". Statistiques en deux colonnes : anneau de progression à gauche (coloré selon le projet), grille 2×2 à droite (jours depuis le début, temps travaillé — **placeholder fixe en attendant l'étape 2**, rangs tricotés = somme de tous les compteurs, dernière activité) ; la colonne de droite est naturellement plus large que l'anneau à gauche. Bouton "Continuer" coloré selon le projet, ouvre le compteur. Petit bouton désactivé "Guide de patron (bientôt)" en dessous : le guide n'existe pas encore (étape 5a/5b), ce bouton ne fait rien pour l'instant.

## Feuille de route

| Étape | Contenu | Statut |
| --- | --- | --- |
| 0 | Fondations et design : projet, PWA installable, navigation squelette, couche de données Dexie, réglages minimaux, déploiement GitHub Pages | ✅ Fait |
| 1 | Projets + compteurs (plusieurs compteurs par projet, objectif, +/-, annulation, historique, compteur autonome) | ✅ Fait |
| 2 | Suivi du temps automatique | ⬜ À faire |
| 3 | Stock de laine, consommation, vérification de disponibilité | ⬜ À faire |
| 4 | Bibliothèque de patrons PDF + visionneuse (pdf.js) | ⬜ À faire |
| 5a | Guides — modèle de données + éditeur manuel | ⬜ À faire |
| 5b | Guides — mode suivi (compteur intégré, étape actuelle mémorisée) | ⬜ À faire |
| 6 | Accueil avec reprise rapide + statistiques | ⬜ À faire |
| 7 | Export/import + sauvegarde complète | ⬜ À faire |
| 8 | Cartes exportables en image (projets et laine) | ⬜ À faire |
| 9 | Analyseur IA de patrons (génère un guide au format du modèle défini à l'étape 5a) | ⬜ À faire |
| 10 | Synchronisation multi-appareils | ⬜ À faire |

Les étapes 9 et 10 demandent des décisions d'architecture (appel à une API IA sans exposer de clé dans un site statique ; synchronisation multi-appareils). Elles ne sont pas implémentées, mais la porte reste ouverte : UUID, `updatedAt` et couche de données isolée sont déjà en place depuis l'étape 0.
