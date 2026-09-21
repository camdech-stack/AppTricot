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
- `pdfjs-dist` (étape 4) pour la bibliothèque de patrons et sa visionneuse, isolé dans `src/pdf/`, chargé uniquement à la demande (voir CLAUDE.md "pdf.js")
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

- Schéma Dexie en version 6 (`src/data/db.ts`) : v3 ajoute `projects`, `counters`, `counterEvents`, `coverImages` ; v4 ajoute `sequence` sur `counterEvents` ; v5 ajoute `targetEndDate` sur `projects` ; v6 ajoute `sessions` et `settings.trackingEnabled` (voir "Suivi du temps").
- `projects` : name, craft (tricot/crochet), description, status (à faire/en cours/en pause/terminé), colorKey (une des 6 couleurs de projet — source unique `ProjectColorKey` dans `src/data/types.ts`, réexportée en `ProjectColor` par `StripedProgressBar`), notes, startedAt/completedAt/targetEndDate (dates calendaires `YYYY-MM-DD`, nullable, modifiables à la main — `targetEndDate` est la date de fin *prévue*, distincte de `completedAt` qui est la date de fin *réelle*, posée seulement quand le statut passe à "Terminé"), lastActivityAt, activeCounterId.
- `counters` : projectId (`null` = compteur autonome — jamais indexé par IndexedDB, `getCounters` fait un scan complet uniquement pour ce cas), name, value, goal, position, isMain, lastTappedAt. Un projet a toujours un compteur principal "Rangs" créé avec lui, non supprimable.
- `counterEvents` : counterId, type (increment/decrement/reset/set), delta, valueBefore, valueAfter, undoneAt, sequence (entier strictement croissant par compteur, voir "Fiabilité du compteur"). Jamais supprimé à l'annulation, seulement marqué `undoneAt`.
- `coverImages` : id = projectId (relation 1:1), blob compressé (max 1200 px, JPEG qualité 0,8, orientation EXIF respectée via `createImageBitmap`, avec repli sans cette option si le navigateur la rejette). Compressée dès la sélection du fichier (pas à la soumission du formulaire) : l'original brut n'est jamais décodé dans un `<img>` ni conservé.
- `computeProjectProgress` (`src/data/progress.ts`) est une fonction pure isolée et testée : progression du compteur principal s'il a un objectif, sinon moyenne des compteurs qui en ont un, sinon nombre de rangs affiché tel quel. Sera remplacée par la progression du guide à l'étape 5b. Les cartes de la liste des projets (`ProjectCard`) n'affichent cependant jamais ce nombre de rangs : sans pourcentage calculable, la carte affiche 100 % si le projet est "Terminé", 0 % sinon (voir "Décisions d'interface").

## Modèle de données (étape 3a — stock de laine)

- Schéma Dexie en version 7 (`src/data/db.ts`) : v7 ajoute `yarns`, `yarnImages`, `projectYarns`, `yarnUsages` et `settings.yarnQuantityUnit` (défaut `'weight'`).
- **Aucun appel réseau dans cette étape.** `yarns.catalogSource` vaut toujours `'manual'`, `ravelryYarnId` toujours `null`. L'étape 3b (recherche dans le catalogue Ravelry, à faire) branchera un appel API pour préremplir le formulaire via le type `YarnDraft` (déjà présent, accepté par `YarnFormPage` et exposé par `toDuplicateDraft`) — jusque-là ces champs ne servent à rien.
- `yarns` : name (obligatoire), brand, line, colorName, colorRef, colorFamily (`YarnColorFamily`, nullable), weightCategory (`YarnWeightCategory`, nullable), fiber, skeinCount (nombre ≥ 0, décimales autorisées), metersPerSkein/gramsPerSkein (nullable), dyeLot, notes, price (nullable), purchasedAt (nullable, `YYYY-MM-DD`), ravelryYarnId (nullable), catalogSource (`'manual' | 'ravelry'`).
- `yarnImages` : id = yarnId (relation 1:1, même schéma que `coverImages`), blob compressé via `compressCoverImage` (réutilisé tel quel depuis l'étape 1, malgré son nom).
- `projectYarns` : un lien par (projectId, yarnId) — `linkYarnToProject` met à jour le lien existant plutôt que d'en créer un second. plannedValue + plannedUnit (`'g' | 'm' | 'skein'`).
- `yarnUsages` : journal de consommation, jamais résumé ailleurs. yarnId, projectId (nullable = non rattaché à un projet), value + unit, usedAt (`YYYY-MM-DD`), note.
- Stockage en système métrique uniquement (grammes, mètres) : les yards ne servent qu'à la saisie/l'affichage, convertis via `yardsToMeters`/`metersToYards` (`src/data/yarnMath.ts`, 1 yd = 0,9144 m) à la frontière UI — jamais stockés tels quels.
- `settings.yarnQuantityUnit` (`'skein' | 'weight' | 'length'`) est le réglage d'unité d'affichage des quantités de laine ; le cas `'length'` réutilise `settings.lengthUnit` (m/yd, déjà existant) pour choisir entre mètres et yards. `formatYarnQuantity`/`formatYarnAmount` (`src/utils/formatYarnQuantity.ts`) centralisent ce formatage.

## Règles de calcul de la laine (étape 3a)

Tout est calculé en pelotes en interne (`src/data/yarnMath.ts`, fonctions pures et testées), converties via `metersPerSkein`/`gramsPerSkein` ; `toSkeins`/`fromSkeins` renvoient `null` quand la conversion est impossible (figure par pelote manquante).

- `computeYarnStockSummary(yarn, usages, projectYarns, projects)` : initiale = `skeinCount` ; consommée = somme de tous les `yarnUsages` du fil (tous projets confondus, y compris `projectId: null`) ; restante = initiale − consommée (`null` si négative → afficher "stock dépassé", jamais une valeur négative) ; réservée = somme, sur les projets liés au statut "à faire"/"en cours"/"en pause", de `max(prévu − consommé par ce projet, 0)` (un projet "terminé" ne réserve plus rien) ; disponible = restante − réservée (peut être négatif : signale une réservation supérieure à ce qu'il reste, distinct du cas "stock dépassé").
- `checkProjectYarnAvailability(link, yarn, usages, projectYarns, projects)` : besoin = prévu − déjà consommé par ce projet ; stock = restante − réservée par les **autres** projets ; résultat `'ok' | 'missing' | 'unknown'` (`'unknown'` si la conversion est impossible — message "Vérification impossible : renseigne le poids ou le métrage par pelote du fil").
- `computeProjectYarnLinkProgress` : consommé/prévu d'un lien projet-fil, pour la StripedProgressBar et le pourcentage.
- `computeYarnStockBarSegments(stock)` : traduit un `YarnStockSummary` en trois largeurs (0–1, somme ≤ 1) pour la barre segmentée de la fiche fil (`YarnStockBar`) — voir "Décisions d'interface (étape 3a)".
- `computeProjectYarnSummary(projectId)` (`src/data/yarnsRepository.ts`) : laine prévue/consommée/restante/pourcentage d'un projet tous fils confondus (en pelotes, seule unité qui peut les combiner) — exposée pour l'étape 6.
- Recherche/tri/filtres : fonction pure `filterAndSortYarns` (`src/data/yarnSearch.ts`), testée séparément des écrans.

## Modèle de données (étape 3b — recherche Ravelry)

- Schéma Dexie en version 8 (`src/data/db.ts`) : v8 ajoute `ravelryPermalink`/`catalogFields`/`catalogFetchedAt` sur `yarns` et `ravelryEnabled`/`ravelryUsername`/`ravelryPassword` sur `settings`.
- `yarns.ravelryPermalink` (nullable) : lien vers la page du fil sur Ravelry, affiché sur la fiche fil. `yarns.catalogFields` (`string[]`, vide par défaut) : noms des champs dont la valeur vient encore du catalogue — un champ en sort dès qu'il est modifié après le préremplissage (voir `computeRemainingCatalogFields`, `src/ravelry/catalogSync.ts`). `yarns.catalogFetchedAt` (nullable) : horodatage de la recherche qui a rempli le fil. `ravelryYarnId` et `catalogSource` existent depuis l'étape 3a.
- `settings.ravelryEnabled` (défaut `false`), `ravelryUsername`/`ravelryPassword` (nullables) : identifiants de lecture seule créés par l'utilisateur sur ravelry.com. **Ce sont des secrets** : jamais logués (console ou message d'erreur), jamais dans une URL. **L'étape 7 (export/sauvegarde) devra explicitement exclure ces trois champs de tout export.**
- Champs préremplissables par le catalogue (`YarnCatalogFieldKey`, `src/ravelry/catalogSync.ts`) : `name`, `brand`, `line`, `weightCategory`, `fiber`, `metersPerSkein`, `gramsPerSkein`. Couleur, lot de teinture, nombre de pelotes, prix, dates et photo restent toujours saisis à la main.

## Règles de la licence Ravelry (résumé)

L'API Ravelry est utilisée uniquement en lecture, avec les identifiants personnels en lecture seule de l'utilisateur (jamais une clé applicative partagée). Règles appliquées dans le code :

- Aucune affiliation suggérée : mention "Non affilié à Ravelry" dans les Réglages et près de la recherche, pas de logo ni de couleur de marque Ravelry, nom de l'app inchangé.
- Seul du texte technique est conservé (nom, marque, épaisseur, métrage, poids, composition, identifiant, lien) — jamais de photo, description ou avis du catalogue.
- Aucune donnée Ravelry n'est mise en cache : le service worker exclut explicitement `api.ravelry.com` (`src/ravelry/serviceWorkerRule.ts`, stratégie NetworkOnly, vérifié par `serviceWorkerRule.test.ts` et par une inspection du `sw.js` généré).
- La recherche ne se déclenche qu'à la demande explicite de l'utilisateur (bouton "Rechercher"), jamais en arrière-plan ni au chargement.
- Le repo ne contient aucune donnée réelle de Ravelry : tous les tests utilisent des fils et identifiants inventés.
- L'utilisateur peut tout supprimer à la demande : "Effacer mes identifiants" (Réglages) et "Supprimer les données Ravelry" (purge des champs encore issus du catalogue sur chaque fil, voir `purgeRavelryData`).

## Isolation du module Ravelry

Tout le code vit dans `src/ravelry/` (client HTTP, mapping tolérant, limiteur de débit, composants, pages), avec un point d'entrée unique `src/ravelry/index.ts`. Pour retirer complètement la fonctionnalité :

1. Supprimer le dossier `src/ravelry/`.
2. Retirer l'import et le rendu de `RavelrySettingsSection` dans `src/pages/SettingsPage.tsx`.
3. Retirer le bouton "Rechercher dans le catalogue", le message vers les Réglages, la pill "Prérempli…" et `<RavelrySearchSheet>` dans `src/pages/YarnFormPage.tsx`, ainsi que les états/handlers `catalog*`/`ravelry*` qui leur sont propres.
4. Retirer `<RavelryCatalogPill>` dans `src/pages/YarnDetailPage.tsx`.
5. Retirer la route `/diagnostic-ravelry` et son import dans `src/app/router.tsx`.
6. Retirer l'import de `RAVELRY_RUNTIME_CACHING_RULE` et l'option `runtimeCaching` dans `vite.config.ts`.

Les champs `ravelryYarnId`/`catalogSource`/`ravelryPermalink`/`catalogFields`/`catalogFetchedAt` sur `yarns` et `ravelryEnabled`/`ravelryUsername`/`ravelryPassword` sur `settings` peuvent rester dans le schéma (jamais renseignés, sans effet) : un schéma Dexie déjà publié ne se modifie jamais rétroactivement (voir la convention de migration en tête de `src/data/db.ts`).

## Suppression et laine

- Supprimer un fil (`deleteYarn`) : cascade sur ses `projectYarns`, ses `yarnUsages` et sa photo.
- Supprimer un projet (`deleteProject(id, keepYarnUsage = true)`) : ses `projectYarns` sont toujours supprimés (un prévu n'a pas de sens sans projet) ; `keepYarnUsage` (case à cocher "Conserver la laine consommée dans le stock" dans `ProjectFormPage`, cochée par défaut) décide du sort de ses `yarnUsages` — `true` les réattribue à `projectId: null` (la laine reste déduite du stock), `false` les supprime (la laine est rendue au stock).

## Modèle de données (étape 4 — bibliothèque de patrons)

- Schéma Dexie en version 9 (`src/data/db.ts`) : v9 ajoute `patterns`, `patternFiles`, `patternCovers`, `projectPatterns`, `patternViewStates` et `projects.lastWorkTab` (défaut `null`).
- `patterns` : name, craft (`'knitting' | 'crochet' | null`), tags (`string[]`, normalisés via `src/data/tagUtils.ts` — espaces retirés/collapsés, dédoublonnage insensible à la casse, index Dexie `*tags` multiEntry), source, notes, pageCount, sizeBytes, fileName, fileHash (SHA-256 hexadécimal, `src/data/patternHash.ts`, sert à la détection de doublon), fileVersion (entier, 1 au départ, incrémenté à chaque remplacement de fichier), fileUpdatedAt, lastOpenedAt (nullable, mis à jour par `touchPatternOpened` à l'ouverture dans la visionneuse).
- `patternFiles` et `patternCovers` : relation 1:1 avec leur patron (id = patternId, même convention que `coverImages`/`yarnImages`), remplacées en place plutôt que versionnées — l'ancien blob est écrasé, jamais conservé. `patternCovers.kind` (`'auto' | 'custom'`) distingue le rendu automatique de la première page (régénéré à chaque remplacement de fichier tant que l'utilisateur n'a pas choisi sa propre couverture) d'une photo choisie à la main (jamais touchée par un remplacement de fichier).
- `projectPatterns` : projectId, patternId, position — un seul lien par couple (comme `projectYarns`), plusieurs patrons par projet et plusieurs projets par patron possibles.
- `patternViewStates` : patternId, projectId (nullable = ouvert depuis la bibliothèque, pas depuis un projet), page, zoom, offsetX, offsetY (normalisés, indépendants de la taille d'écran). Un seul état par couple (patternId, projectId) — recherché par l'index `patternId` seul et filtré en JS pour le cas `projectId: null`, IndexedDB n'indexant jamais les valeurs `null` (même contrainte que `counters.projectId`/`sessions.projectId`, voir plus haut).
- `projects.lastWorkTab` (`'pattern' | 'counter' | 'guide' | null`) : dernier onglet actif de la vue de travail (étape 4), lu par l'étape 6 pour "Reprendre" et par le bouton "Continuer" de la fiche projet.
- Import atomique (`importPattern`, `src/data/patternsRepository.ts`) : métadonnées, fichier et couverture écrits dans une seule transaction Dexie — un échec (dont `QuotaExceededError`) fait annuler toute la transaction par IndexedDB, rien n'est jamais écrit partiellement.
- Remplacement de version (`replacePatternFile`) : nouveau fichier, `fileVersion + 1`, nouvelles métadonnées de page/taille/hash, couverture auto régénérée si elle l'était encore ; métadonnées, tags et liens projet conservés ; chaque `patternViewStates.page` de ce patron est ramené dans `[1, nouveau pageCount]`.
- Suppression d'un patron (`deletePattern`) : cascade sur son fichier, sa couverture, ses `projectPatterns` et ses `patternViewStates`. Suppression d'un projet (`deleteProject`) : supprime ses `projectPatterns` et `patternViewStates`, ne touche jamais au patron lui-même (même logique que pour la laine).
- Lecture et rendu du PDF isolés dans `src/pdf/` (`pdfjs.ts` charge pdf.js et son worker en différé via `import()`, jamais depuis le chemin statique — voir "pdf.js" plus bas ; `extractPdfMetadata.ts` lit le nombre de pages/le titre et rend la couverture automatique ; `viewerMath.ts` regroupe les fonctions pures testées de bornage page/zoom et de budget mémoire de rendu, utilisées par `PdfViewerCore`).

## pdf.js

- `pdfjs-dist` (v6, dépendance unique ajoutée à l'étape 4) n'a plus qu'un seul build ESM moderne — l'ancien build "legacy" pour navigateurs pré-2021 n'existe plus dans cette version, donc le choix ne s'est pas posé : c'est ce build qui est utilisé, et il convient très bien puisque l'app ne tourne que sur Safari iOS/iPadOS récent (installée sur l'écran d'accueil).
- `src/pdf/pdfjs.ts` charge la bibliothèque et son worker (`pdfjs-dist/build/pdf.worker.min.mjs?url`, importé dynamiquement) uniquement à la demande : ni la bibliothèque de patrons ni la fiche projet ne l'importent statiquement, seuls l'import d'un PDF et la visionneuse le font, tous deux déjà derrière un `import()`. Résultat vérifié au build : le chunk principal de l'app ne contient pas pdf.js, qui forme ses propres chunks (bibliothèque ~430 Ko, worker ~1,3 Mo) chargés uniquement à l'ouverture d'un PDF.
- Polices standard non intégrées : `standardFontDataUrl` pointe vers `public/pdf/standard-fonts/` (copié depuis `node_modules/pdfjs-dist/standard_fonts` par `scripts/copy-pdfjs-assets.mjs`, lancé avant `dev`/`build` — jamais commité, voir `.gitignore`) pour un rendu correct même hors ligne. Les CMaps (`node_modules/pdfjs-dist/cmaps`, ~1,7 Mo, essentiellement des encodages CJK) ne sont volontairement pas embarquées : les patrons de cette app sont en français/anglais, le poids ne se justifie pas.
- Précache du service worker : `vite.config.ts` ajoute `mjs`/`pfb`/`ttf` à `globPatterns` (le worker pdf.js garde l'extension `.mjs`, les polices standard `.pfb`/`.ttf`) et relève `maximumFileSizeToCacheInBytes` à 4 Mo (le worker minifié pèse à lui seul ~1,3 Mo, au-dessus de la limite par défaut de workbox). Aucune requête réseau n'est faite par la bibliothèque ni la visionneuse : ni `cMapUrl` (CMaps non embarquées, voir ci-dessus) ni aucun appel à `api.ravelry.com` ou équivalent.
- `extractPdfMetadata` clone toujours le buffer avant de le passer à `pdfjs.getDocument({ data })` (`data.slice(0)`) : pdf.js transfère (détache) l'`ArrayBuffer` qu'on lui donne vers son worker, alors que l'appelant (import, remplacement de fichier) réutilise ce même buffer juste après pour le hasher et l'enregistrer comme fichier du patron — sans ce clone, le fichier stocké se retrouvait vide.
- Pas de recherche de texte dans la visionneuse (retirée après l'étape 4 : `page.getTextContent()` existe dans pdf.js mais construire un index par page à la demande sans expérience solide de surbrillance n'apportait pas assez pour sa complexité). À reconsidérer plus tard si le besoin se confirme.

## Fiabilité du compteur

- Chaque +1/-1/+5/remise à zéro/valeur manuelle/annulation passe par une seule transaction Dexie (`src/data/countersRepository.ts`) qui lit la valeur courante dans la transaction (jamais depuis l'état React), met à jour le compteur, ajoute l'événement et touche `lastActivityAt` du projet. Les transactions Dexie sur les mêmes tables sont sérialisées par IndexedDB : des appuis en rafale ne perdent jamais de comptage (testé avec 30 appels concurrents dans `countersRepository.test.ts`).
- Les événements sont ordonnés par `sequence` (entier croissant calculé dans la même transaction que l'écriture), jamais par `createdAt` seul : deux appuis assez rapides pour tomber dans la même milliseconde donneraient sinon un ordre indéterminé, et l'annulation répétée pourrait restaurer la mauvaise valeur.
- L'annulation restaure `valueBefore` du dernier événement non annulé et le marque `undoneAt` ; répétable indéfiniment, pas de "rétablir" pour l'instant.
- Écran allumé via l'API Wake Lock (`useWakeLock`), avec repli silencieux si indisponible, refusée, ou en cas d'échec (à confirmer sur iOS réel).

## Suivi du temps (étape 2)

Le temps est mesuré par des sessions (`sessions`, schéma Dexie v6 dans `src/data/db.ts`) : id, createdAt, updatedAt, projectId (`null` = compteur autonome, même scan complet que `counters` pour ce cas), startedAt, endedAt (nullable), lastHeartbeatAt, source (`auto` | `manual`), origin (`counter` | `guide` | `manual`), endReason (nullable : `user_stop` | `app_hidden` | `switched` | `recovered`). Réglage `settings.trackingEnabled` (défaut `true`) désactive tout nouvel enregistrement sans toucher aux sessions déjà enregistrées.

Règles de session :
- Une session démarre automatiquement au premier appui qui modifie un compteur (+1/-1/+5/remise à zéro/valeur manuelle/annulation — l'annulation compte comme une activité comme les autres), qu'il s'agisse d'un compteur de projet ou du compteur autonome. Ouvrir un écran sans appuyer ne démarre rien.
- Une seule session ouverte à la fois dans toute l'app. Un appui sur un compteur d'une autre cible (autre projet, ou projet vs compteur autonome) clôt la session en cours (`endReason: 'switched'`) et en ouvre une nouvelle, sans chevauchement. Un appui sur un autre compteur du même projet continue la session en cours.
- La session s'arrête quand l'app quitte le premier plan (`visibilitychange` → hidden, et `pagehide`, `endReason: 'app_hidden'`) ou par le bouton de chrono (`endReason: 'user_stop'`). Après un arrêt manuel, les appuis sur des compteurs de la même cible ne redémarrent pas le chrono ; seul le bouton le relance (nouvelle session, `source: 'manual'`). Ce statut « arrêté à la main » vit uniquement en mémoire (`src/data/sessionTrackingState.ts`, jamais persisté) et est effacé quand l'app quitte le premier plan, quand le chrono est relancé, ou quand un compteur d'une autre cible est tapé.
- Attribution du temps : une session avec `projectId` non nul compte dans le temps de ce projet ; une session `projectId: null` (compteur autonome) n'est jamais comptée dans le temps d'un projet mais entre dans les statistiques globales (voir `computeGlobalTimeStats`).
- Fiabilité : `lastHeartbeatAt` est écrit toutes les 10 s pendant qu'une session est ouverte et l'app visible (et à chaque activité), uniquement pour permettre la récupération — jamais un délai d'inactivité. `closeOrphanSessions()` clôt toute session ouverte qui n'appartient pas au contexte courant (`endedAt = lastHeartbeatAt`, `endReason: 'recovered'`), appelée au lancement, au retour au premier plan et avant chaque écriture d'activité (perte max 10 s si l'app est tuée sans prévenir).

API (`src/data/sessionsRepository.ts`, jamais Dexie dans les composants) :
- `recordActivity(target, at, tx, options)` : appelée depuis la même transaction qu'un appui sur un compteur (`countersRepository.ts` passe désormais `db.sessions`/`db.settings` et le `tx` de la transaction) — garantit qu'une session correcte est ouverte selon les règles ci-dessus. **L'étape 5b appellera `recordActivity`/`startSession` avec `origin: 'guide'` et le `projectId` du guide**, exactement comme un compteur aujourd'hui.
- `startSession(target, origin)` / `stopSession(reason)` : démarrage/arrêt manuels (bouton de chrono).
- `closeOrphanSessions()`, `handleForegroundLoss()`, `touchHeartbeat()` : cycle de vie, appelés depuis `useSessionTracking` (monté une fois dans `App.tsx`), pas depuis les écrans.
- `getOpenSession`, `getSessionsForTarget`, `getAllSessions`, `addManualSession`, `updateSessionTimes`, `deleteSession`, `validateSessionTimes` (pure : futur interdit, fin après début, pas de chevauchement avec une autre session tous targets confondus) pour l'historique des sessions.
- Fonctions pures dans `src/data/timeStats.ts` (isolées et testées comme `progress.ts`, réutilisables à l'étape 6) : `getSessionDuration` (fin effective = `now` pour la session live de ce contexte, `lastHeartbeatAt` sinon — jamais un chronomètre en mémoire), `computeProjectTimeStats`, `computeGlobalTimeStats`, `aggregateTimeByPeriod` (répartit une session à cheval sur minuit sur les jours concernés, semaine du lundi au dimanche, heure locale). Formatage français unique dans `src/utils/formatDuration.ts` (`"12 h 30"`, `"45 min"`, `"< 1 min"`).
- Suppression d'un projet : cascade sur ses sessions (`deleteProjectSessions`) ; les sessions du compteur autonome ne sont jamais supprimées par ça.

## Décisions d'interface (étape 1)

- La fiche projet, le formulaire de création/modification et l'écran compteur vivent hors `AppLayout` (routes de premier niveau dans `src/app/router.tsx`) : ils dessinent leur propre en-tête (retour + action), et `PageHeader` réserve donc lui-même la zone de sécurité haute (safe-top) puisque rien d'autre ne le fait sur ces routes. Seules la liste et la fiche projet gardent le `FloatingTabBar` ; l'écran compteur le masque entièrement pour maximiser la place et éviter les faux appuis. Ces pages doivent gérer leur propre défilement (hauteur + `overflow-y: auto`) : `#root` a `overflow: hidden`, donc une page qui ne le fait pas rend son contenu en bas d'écran inatteignable sur un écran court (bug corrigé une fois sur `ProjectFormPage`).
- Feuilles modales génériques `Sheet` et `ConfirmDialog` (`src/components/ui`) réutilisées par tous les éditeurs de compteur (renommer, objectif, valeur, historique) et toutes les confirmations obligatoires (suppression, remise à zéro), ainsi que par le filtre par statut de la liste des projets.
- **Accueil** : contient déjà une section "Outils" avec une tuile `SquareTile` vers le compteur de rangs (`/#/compteur`), en anticipation de l'étape 6 — décision explicite de l'utilisateur, en dehors du périmètre normal de l'étape 1 (qui ne devait pas toucher l'accueil). Le reste de la page (reprise rapide, statistiques) reste à faire à l'étape 6.
- **Compteur de rangs** ("Compteur libre" renommé) : icône `ListOrdered` partout où il apparaît (accueil, avatar du compteur autonome) — même icône que la tuile "Rangs tricotés"/"Rangs actuels" pour rester cohérent. Compteur autonome créé automatiquement au premier accès à `/#/compteur`, mêmes composants et logique transactionnelle qu'un compteur de projet, sans section "Autres compteurs" (un seul compteur, pas de projet associé). Son bouton retour renvoie à l'accueil (d'où il est accessible), pas à la liste des projets.
- **Écran compteur d'un projet** : affiche le nom du projet dans l'en-tête (texte), jamais sa photo — seul le compteur autonome affiche un avatar/icône. Boutons -1/+1/+5 en texte seul, sans icône. Bouton de chrono réel sous "Dernier appui" (`useCounterChrono`) — voir "Suivi du temps".
- **Liste des projets** : grille 2 colonnes dès mobile (3 à partir de 1024px). Les pills de filtre par statut ne sont plus toujours visibles : elles vivent dans une feuille ouverte par une icône à côté de "+ Nouveau" (icône en surbrillance quand un filtre autre que "Tous" est actif).
- **Carte projet** (`ProjectCard`) : tuile avec photo (ou motif rayé dans la couleur du projet) plein cadre, encadré de la couleur du projet, pill de statut et badge de progression qui chevauchent la photo (registre volontairement moins figé que le reste de l'interface), badge vert quand le projet est terminé, date de fin prévue en surimpression. Affiche toujours un pourcentage (jamais un nombre de rangs, voir "Modèle de données").
- **Fiche projet** : en-tête en photo du projet (avec dégradé sombre pour la lisibilité) quand il y en a une, sinon dégradé dans la couleur du projet (`projectGradient`) — pas d'emplacement photo séparé plus bas. Date de début et date de fin prévue (ou date de fin réelle si "Terminé") affichées sous les pills de statut/type, suivies d'une pill "durée" (temps total du projet, voir "Suivi du temps") quand il est non nul. Badge vert à côté du nom si "Terminé". Statistiques en deux colonnes : anneau de progression à gauche (coloré selon le projet), grille 2×2 à droite (jours depuis le début, temps travaillé — réel depuis l'étape 2, rangs tricotés = somme de tous les compteurs, dernière activité) ; la colonne de droite est naturellement plus large que l'anneau à gauche. Carte "Temps" (`TimeCard`) sous les notes : totaux + histogramme jour/semaine/mois, ouvre l'historique des sessions. Bouton "Continuer" coloré selon le projet, ouvre le compteur. Petit bouton désactivé "Guide de patron (bientôt)" en dessous : le guide n'existe pas encore (étape 5a/5b), ce bouton ne fait rien pour l'instant.

## Décisions d'interface (étape 2)

- **Bouton de chrono** (`useCounterChrono`, écran compteur) : lit la session ouverte pour toute l'app et compare son `projectId` à la cible affichée — n'apparaît pas si `settings.trackingEnabled` est `false`. Affiché au format `hh:mm:ss` (`formatClockDuration`, `src/utils/formatDuration.ts`), rafraîchi chaque seconde (`useNow`) mais toujours calculé depuis les horodatages stockés, jamais via un chronomètre en mémoire. Le `aria-label` reste en français (`formatDuration`) pour la lecture par un lecteur d'écran.
- **Historique des sessions** (`SessionHistorySheet`, `src/components/sessions`) : un seul composant, réutilisé tel quel depuis la carte "Temps" de la fiche projet et depuis le menu du compteur autonome (entrée "Historique des sessions" dans `CounterMenuSheet`, visible uniquement pour ce dernier — un projet y accède via sa carte "Temps"). Sessions groupées par jour ; la session actuellement ouverte n'est ni modifiable ni supprimable depuis cet écran (affichée "en cours").
- **Réglages** : section "Suivi du temps" avec un interrupteur (pas de composant `Toggle` partagé pour l'instant, un seul endroit en a besoin) et une phrase d'explication courte, au-dessus de la section "Stockage".

## Décisions d'interface (étape 3a)

- **Onglet Laine** (`YarnPage`, dans `AppLayout`, garde le `FloatingTabBar`) : recherche + tri + bouton de filtres dans une feuille (`YarnFilterSheet` : épaisseur, famille de couleur, projet associé, en stock/épuisé, métrage minimum par pelote — converti dans l'unité de longueur choisie). En-tête : nombre de fils et de pelotes. Grille 1 colonne sur iPhone, 2 à partir de 640px, 3 à partir de 1024px — `YarnCard` est une carte horizontale (miniature + infos), pas une tuile plein cadre comme `ProjectCard`.
- **Fiche fil** et **formulaire fil** vivent hors `AppLayout` (`YarnDetailPage`, `YarnFormPage`, mêmes routes de premier niveau que les projets) : la fiche garde le `FloatingTabBar`, le formulaire ne l'affiche pas — même convention que les projets. Le formulaire est en sections (identité, couleur, format, stock, achat, photo, notes) et accepte un `YarnDraft` optionnel via `location.state.draft` (prérempli par "Dupliquer pour une autre couleur", et futur point d'entrée de l'étape 3b).
- Consommation et réservation partagent deux feuilles réutilisables (`src/components/yarn`) : `LogUsageSheet` (fil fixe + projet libre depuis la fiche fil, ou projet fixe + fil à choisir parmi ceux liés depuis la carte "Laine" d'un projet) et `LinkYarnSheet` (ajouter un fil au projet avec recherche, ou modifier/retirer un lien existant). `AdjustStockSheet` ("j'ai acheté / retiré des pelotes") modifie `skeinCount` directement, distinct d'une consommation.
- **Fiche projet, carte "Laine"** (`ProjectYarnCard`, remplace la carte grisée — la grille "Bientôt" ne contient plus que Patron et Guide de patron, passée à 2 colonnes) : pill de disponibilité sage-soft "✓ Stock suffisant" / terracotta-soft "⚠ X manquants", texte toujours dans `--color-text` (jamais la couleur d'accent, voir "Système de design").
- **Réglages** : `settings.yarnQuantityUnit` en 3ᵉ option de la section "Unités" (pelotes/poids/longueur), sous les réglages existants de longueur/poids.
- **Bloc quantités de la fiche fil** (`YarnStockBar`) : une barre segmentée plutôt qu'une grille de chiffres — la largeur du tronçon consommée/réservée/disponible est calculée par `computeYarnStockBarSegments` (pure, testée, `src/data/yarnMath.ts`), proportions relatives à `initialSkeins`. Une accolade sous les tronçons réservée+disponible (bords qui remontent vers eux, ligne de jonction en bas) porte le libellé "Restante = X". Le tronçon "consommée" reprend le motif rayé de `StripedProgressBar` (métaphore des rangs déjà tricotés) ; réservée en doré, disponible en sage. Deux dégradations : réservation supérieure au restant (`disponible` négatif) → le tronçon "réservée" occupe tout l'espace restant de la barre (pas de dépassement visuel), la valeur négative s'affiche telle quelle dans la légende et un encadré d'alerte l'explicite ; stock dépassé (`remainingSkeins` nul) → barre entièrement "consommée", pas d'accolade, alerte dédiée.
- **`YarnCard`, encadré coloré** : bordure de la couleur de la famille de couleur du fil (12 tokens dédiés `--color-yarn-*`, `src/components/yarn/colorFamilyMeta.ts`), neutre (`--color-border`) si aucune famille n'est choisie. "Multicolore" n'a pas de teinte unique : `border-image` avec un dégradé fonctionne mais ignore `border-radius` (coins carrés) — la bordure dégradée utilise donc la double-`background` (fond uni en `padding-box` par-dessus le dégradé en `border-box`), seule technique qui respecte les coins arrondis de la carte.

## Décisions d'interface (étape 3b)

- **Réglages, section "Catalogue Ravelry (optionnel)"** (`RavelrySettingsSection`, sous "Suivi du temps") : interrupteur, champs identifiants (persistés à `onBlur`, jamais à chaque frappe), bouton "Tester la connexion" (états connecté/erreur classée), "Effacer mes identifiants", texte de transparence + mention "Non affilié à Ravelry" toujours visibles, bouton de purge avec confirmation affichant le nombre de fils concernés.
- **Formulaire fil** : bouton "Rechercher dans le catalogue" tout en haut du formulaire (visible seulement si `ravelryEnabled` et identifiants renseignés, sinon lien vers les Réglages), ouvre `RavelrySearchSheet` par-dessus le formulaire déjà ouvert (pas de navigation) — le préremplissage écrit directement dans l'état du formulaire en cours, jamais dans la base tant que "Enregistrer" n'est pas pressé.
- **Fiche fil** : `RavelryCatalogPill` (pill "Source : catalogue Ravelry" + lien "Voir sur Ravelry") juste au-dessus de la barre de stock, uniquement si `ravelryPermalink` est renseigné.
- **Écran de diagnostic** (`RavelryDiagnosticPage`, `/#/diagnostic-ravelry`) : lit uniquement l'état en mémoire du dernier appel (`getLastRavelryCall`, `src/ravelry/client.ts`), jamais persisté, rafraîchi chaque seconde.
- Limiteur de débit et annulation partagés (`ravelryRequestQueue`, `src/ravelry/requestQueue.ts`) : une seule requête à la fois (la précédente est annulée), 1 s minimum entre deux départs de requête, verrou de 10 s après un 429, timeout de 10 s par requête. Les fonctions de `src/ravelry/client.ts` acceptent une file en paramètre optionnel (par défaut la file partagée) uniquement pour permettre aux tests d'utiliser des files indépendantes.

## Décisions d'interface (étape 4)

- **Onglet Patrons** (`PatternsPage`, dans `AppLayout`) : grille 2 colonnes iPhone / 3 à 640px / 4 à 1024px, tuiles portrait plein cadre façon `ProjectCard` (couverture, nom, tags, pages, "Ouvert il y a X" ou "Page X / N" si déjà lu — `PatternCard`). Recherche + tri + filtres en feuille (`PatternFilterSheet` : type, tag, associé à un projet ou non), même convention que `YarnFilterSheet`. Import (`ImportPatternSheet`) : un seul fichier ouvre un formulaire pré-rempli (nom depuis le titre PDF ou le nom de fichier, type, source, tags avec suggestions, notes) avec avertissement au-dessus de 100 Mo et confirmation explicite en cas de doublon détecté par hash ; plusieurs fichiers à la fois sont importés immédiatement avec les valeurs par défaut (pas de tags/type/notes, pas de formulaire par fichier) — solution la plus simple sur iPhone, l'utilisateur affine ensuite depuis la fiche de chaque patron — puis un résumé liste chaque fichier et son résultat (importé, doublon ignoré, protégé par mot de passe, invalide).
- **Fiche d'un patron** (`PatternDetailPage`, route de premier niveau hors `AppLayout` mais garde le `FloatingTabBar`, même convention que Yarn) : tous les champs (nom, type, source, notes, tags) sont directement modifiables sur l'écran, sauvegarde automatique après un court délai (comme les notes de la fiche projet) sauf les tags qui s'enregistrent immédiatement. "Changer la couverture" (photo, `compressCoverImage` réutilisé), "Remplacer le fichier" (confirmation implicite par le remplacement lui-même, bornes de page recalées), "Supprimer" (`ConfirmDialog` listant les projets liés), projets liés (ajouter via `AssociateProjectSheet`, retirer), bouton "Ouvrir" vers la visionneuse.
- **Fiche projet, carte "Patron"** (`ProjectPatternCard`, remplace la carte grisée — la grille "Bientôt" ne contient plus qu'une seule carte, "Guide de patron") : patrons liés (miniature, ouvrir directement la visionneuse, retirer), "Associer un patron" (`AssociatePatternSheet`, recherche dans la bibliothèque). Le bouton "Continuer" ouvre la vue de travail si le projet a au moins un patron lié, sinon l'écran compteur comme avant ; un bouton "Compteur seul" apparaît à côté de "Guide de patron (bientôt)" uniquement quand un patron est lié (l'accès direct au patron seul se fait déjà depuis la carte "Patron").
- **Visionneuse** (`PdfViewerCore`, partagée entre la route dédiée `PatternViewerPage` et l'onglet Patron de la vue de travail) : barre du haut (retour si fourni, nom, icône crayon "Modifier le patron" vers la fiche du patron) et barre du bas (page précédente/suivante, indicateur de page ouvrant une feuille de saisie, zoom -/+, "Ajuster à la largeur") masquées/affichées par un appui au centre. Pincement, glissement et double-appui gérés à la main avec les événements pointeur (`touch-action: none`) ; transformation CSS pendant un geste, nouveau rendu net à la fin. Erreur de lecture (mot de passe ou fichier corrompu) : message clair, lien vers la fiche du patron pour remplacer le fichier si ce n'est pas un problème de mot de passe.
- L'icône "Modifier" et le lien "Remplacer le fichier" de la visionneuse passent `state: { returnTo }` (l'URL de la visionneuse elle-même, avec `?projet=` si ouverte depuis un projet) en naviguant vers `PatternDetailPage` : son propre bouton retour lit `location.state.returnTo` (repli sur `/patrons`) pour rouvrir exactement le même PDF dans le même contexte plutôt que d'atterrir sur la liste complète de la bibliothèque.
- **Vue de travail** (`ProjectWorkPage`, `/#/projets/:id/travail`, hors `AppLayout`, écran maintenu allumé) : sélecteur en pilule "Patron | Compteur | Guide" (Guide désactivé) sur téléphone et écrans étroits, dernier onglet mémorisé dans `projects.lastWorkTab` ; vue partagée PDF (~60 %) / compteur (~40 %) à partir de 1024px en paysage, pilules alors masquées. Les deux panneaux (`PdfViewerCore` et `CounterPanel`) restent montés en permanence quel que soit l'onglet actif (`display: none` plutôt que démontage), pour que la position du PDF survive à un aller-retour vers le compteur. `CounterPanel` (`src/components/counters/CounterPanel.tsx`) est le compteur extrait de `CounterPage` sans aucun changement de comportement, réutilisé tel quel ici et par l'écran compteur classique — `CounterPage` ne garde que son propre en-tête (retour, avatar/nom, réglages, qui ouvre le menu du compteur via une réf `CounterPanelHandle`). Si le projet a plusieurs patrons liés, un sélecteur discret apparaît au-dessus du PDF ; le dernier patron consulté est déduit de `patternViewStates` (le plus récemment mis à jour pour ce projet), pas d'un champ séparé.

## Feuille de route

| Étape | Contenu | Statut |
| --- | --- | --- |
| 0 | Fondations et design : projet, PWA installable, navigation squelette, couche de données Dexie, réglages minimaux, déploiement GitHub Pages | ✅ Fait |
| 1 | Projets + compteurs (plusieurs compteurs par projet, objectif, +/-, annulation, historique, compteur autonome) | ✅ Fait |
| 2 | Suivi du temps automatique | ✅ Fait |
| 3a | Stock de laine (saisie manuelle) : fils, pelotes, consommation, réservation, disponibilité, recherche/filtres, laine dans la fiche projet | ✅ Fait |
| 3b | Stock de laine — recherche dans le catalogue Ravelry (identifiants de lecture seule) pour préremplir une fiche fil | ✅ Fait |
| 4 | Bibliothèque de patrons PDF + visionneuse (pdf.js) | ✅ Fait |
| 5a | Guides — modèle de données + éditeur manuel | ⬜ À faire |
| 5b | Guides — mode suivi (compteur intégré, étape actuelle mémorisée) | ⬜ À faire |
| 6 | Accueil avec reprise rapide + statistiques | ⬜ À faire |
| 7 | Export/import + sauvegarde complète | ⬜ À faire |
| 8 | Cartes exportables en image (projets et laine) | ⬜ À faire |
| 9 | Analyseur IA de patrons (génère un guide au format du modèle défini à l'étape 5a) | ⬜ À faire |
| 10 | Synchronisation multi-appareils | ⬜ À faire |

Les étapes 9 et 10 demandent des décisions d'architecture (appel à une API IA sans exposer de clé dans un site statique ; synchronisation multi-appareils). Elles ne sont pas implémentées, mais la porte reste ouverte : UUID, `updatedAt` et couche de données isolée sont déjà en place depuis l'étape 0.

Les guides de patron (étapes 5a et 5b) s'ajouteront dans l'onglet "Guide" de la vue de travail (`ProjectWorkPage`, actuellement désactivé avec le libellé "Bientôt") et remplaceront la carte grisée "Guide de patron" de la fiche projet, sur le modèle de ce que l'étape 4 a fait pour "Patron". L'étape 7 (export/sauvegarde) devra explicitement inclure les fichiers PDF des patrons (`patternFiles`) dans la sauvegarde complète, en plus de leurs métadonnées — voir CLAUDE.md "Modèle de données (étape 4)" et le cahier des charges section 31 ("les fichiers PDF doivent être inclus dans la sauvegarde ou être sauvegardés séparément selon leur taille").
