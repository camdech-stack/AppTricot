# Mon carnet de tricot

Application web personnelle (PWA) pour suivre mes projets de tricot et de crochet : compteurs de rangs, patrons, stock de laine, temps de travail et statistiques.

Privée, mono-utilisateur, offline-first, hébergée sur GitHub Pages.

Voir [CLAUDE.md](./CLAUDE.md) pour la feuille de route, les conventions de code et l'état d'avancement, et [docs/SPEC](./docs/SPEC) pour le cahier des charges complet.

## Développement

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — vérification des types puis build de production
- `npm run typecheck` — vérification TypeScript seule
- `npm run lint` — lint
- `npm run preview` — sert le build de production localement (utile pour tester le mode hors ligne)
