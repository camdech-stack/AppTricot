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
- Composants de base réutilisables dans `src/components/ui` : `Button`, `IconButton`, `Card`, `HeroCard`, `Pill`, `StatTile`, `ProgressRing`, `StripedProgressBar`, `WaveDivider`, `PageHeader`, `SectionTitle`. Aucun ne contient de logique métier.
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

## Feuille de route

| Étape | Contenu | Statut |
| --- | --- | --- |
| 0 | Fondations : projet, PWA installable, navigation squelette, couche de données Dexie, réglages minimaux, déploiement GitHub Pages | ✅ Fait |
| 1 | Projets + compteurs (plusieurs compteurs par projet, objectif, +/-, annulation, historique, compteur autonome) | ⬜ À faire |
| 2 | Suivi du temps et sessions | ⬜ À faire |
| 3 | Stock de laine, consommation, vérification de disponibilité | ⬜ À faire |
| 4 | Bibliothèque de patrons PDF + visionneuse (pdf.js) | ⬜ À faire |
| 5 | Guides manuels, mode tricot, répétitions, notes associées aux rangs | ⬜ À faire |
| 6 | Accueil avec reprise rapide + statistiques | ⬜ À faire |
| 7 | Recherche globale + export/import + sauvegarde complète (PDF inclus) | ⬜ À faire |
| 8 | Cartes exportables en image (projets et laine) | ⬜ À faire |
| 9 | Analyseur IA de patrons + système de crédits | ⬜ À faire |
| 10 | Diagrammes | ⬜ À faire |
| 11 | Synchronisation multi-appareils (optionnelle) | ⬜ À faire |

Les étapes 9 et 11 demandent des décisions d'architecture (appel à une API IA sans exposer de clé dans un site statique ; synchronisation multi-appareils). Elles ne sont pas implémentées, mais la porte reste ouverte : UUID, `updatedAt` et couche de données isolée sont déjà en place depuis l'étape 0.
