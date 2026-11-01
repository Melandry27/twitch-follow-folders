# Contribuer

## Branches

- `main` est protégée : on n'y pousse pas directement.
- Une branche par sujet : `feat/couleur-dossiers`, `fix/selecteur-show-more`, `chore/maj-dependances`…
- Fusion par Pull Request, une fois la CI verte.

## Commits

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
feat: couleur personnalisable par dossier
fix: sélecteur « Show More » après la mise à jour Twitch du 12/11
docs: capture d'écran du README
chore: mise à jour de Vite
test: cas de la barre latérale réduite
```

## Versions

[Versionnage sémantique](https://semver.org/lang/fr/) — `MAJEUR.MINEUR.CORRECTIF` :

- **CORRECTIF** (0.1.0 → 0.1.1) : correction, ex. un sélecteur Twitch réparé ;
- **MINEUR** (0.1.0 → 0.2.0) : nouvelle fonctionnalité compatible ;
- **MAJEUR** : changement incompatible (ex. format de données sans migration possible).

Si le format enregistré change : incrémenter `SCHEMA_VERSION` dans `src/shared/types.ts` et ajouter l'étape dans `migrate()` (`src/shared/storage.ts`), avec un test.

## Avant d'ouvrir une Pull Request

```bash
npm run lint && npm run format:check && npm run typecheck && npm test
npm run build && npm run test:e2e
```

Puis tester à la main : `chrome://extensions` → bouton ↻ de FollowFolders → recharger twitch.tv.
Ajouter une ligne dans la section « Non publié » de `CHANGELOG.md`.
