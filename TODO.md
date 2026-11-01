# TODO — FollowFolders

Extension Chrome qui remplace la section « Chaînes suivies » (Followed Channels) de la barre latérale Twitch par des **dossiers nommés qu'on peut ouvrir / fermer**. Le reste de la barre latérale Twitch (« Live Channels », recommandations…) reste en dessous, inchangé.

---

## 0. Décisions prises ✅

- [x] **Nom** : FollowFolders (dépôt GitHub : `follow-folders`)
  - Nom sur le Chrome Web Store : « FollowFolders — dossiers pour Twitch » (éviter de commencer le nom par « Twitch », marque déposée)
- [x] **Langage** : TypeScript + Vite
- [x] **Données** : 100 % local, aucune API, aucune connexion Twitch
  - Les chaînes sont lues dans la barre latérale Twitch (DOM)
  - Les dossiers sont enregistrés dans `chrome.storage.local` (l'équivalent du local storage pour une extension : il n'est pas effacé quand on vide les données du site twitch.tv)
- [x] **Emplacement** : les dossiers **remplacent** uniquement la section « Followed Channels » ; « Live Channels » et tout ce qui suit restent affichés en dessous
- [x] **Dossier** = un nom + un état ouvert 📂 / fermé 📁 (mémorisé)
- [x] Licence : MIT
- [ ] Dépôt public ou privé → privé par défaut, à confirmer

## 1. Mise en place du dépôt GitHub

- [ ] Créer le dépôt `follow-folders` sur GitHub et pousser (dépôt local prêt)
- [x] `README.md` : description, capture d'écran, installation en mode développeur
- [x] `LICENSE`
- [x] `.gitignore` (node_modules, dist, *.zip, .env)
- [x] `CHANGELOG.md` (format « Keep a Changelog »)
- [x] Versionnage sémantique `MAJEUR.MINEUR.CORRECTIF`, aligné sur `version` du `manifest.json`
- [x] Convention de commits (Conventional Commits : `feat:`, `fix:`, `chore:`…)
- [ ] Branches (règles écrites dans CONTRIBUTING.md) — reste à activer la protection de `main` sur GitHub : `main` protégée + branches `feat/...` / `fix/...` fusionnées par Pull Request
- [x] Modèles d'issues (bug / idée) et de Pull Request

## 2. Squelette du projet

- [x] `manifest.json` en **Manifest V3**
  - `content_scripts` sur `https://www.twitch.tv/*`
  - permission `storage` uniquement
  - icônes 16 / 32 / 48 / 128 px
- [x] Arborescence :
  ```
  src/
    content/      ← script injecté dans Twitch (lecture + affichage des dossiers)
    popup/        ← fenêtre au clic sur l'icône (activer / désactiver, export)
    shared/       ← types, stockage, utilitaires
  public/icons/
  ```
- [x] Outillage : `package.json`, TypeScript, Vite (+ plugin CRXJS), ESLint, Prettier
- [x] Scripts npm : `dev`, `build`, `lint`, `test`, `zip`
- [x] Vérifier le chargement via `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée »

## 3. Lecture de la barre latérale Twitch

- [x] Repérer la section « Followed Channels » et la distinguer de « Live Channels » et des autres sections
- [x] Repérer des sélecteurs stables (`data-a-target`, `aria-label`…) plutôt que les classes CSS générées
- [x] Centraliser **tous** les sélecteurs dans un seul fichier (`selectors.ts`) — Twitch change souvent son site
- [x] Extraire pour chaque chaîne : pseudo (login), nom affiché, avatar, jeu, spectateurs, en ligne / hors ligne, lien
- [x] Charger toute la liste : cliquer automatiquement sur « Show More » jusqu'au bout (la section native étant masquée, l'utilisateur ne le fera plus)
- [x] Twitch est une application React à page unique : `MutationObserver` pour suivre les mises à jour (live / spectateurs) et la navigation sans rechargement
- [x] Gérer la barre latérale **réduite** (mode icônes uniquement)

## 4. Modèle de données et stockage local

- [x] Schéma :
  ```ts
  Folder  = { id, name, collapsed: boolean, order, channels: string[] }   // channels = logins
  Channel = { login, displayName, avatarUrl, lastSeen }                   // cache pour afficher les chaînes hors ligne
  Store   = { schemaVersion, folders: Folder[], channels: Record<login, Channel>, settings }
  ```
- [x] Lecture / écriture dans `chrome.storage.local`
- [x] Mise en cache de l'avatar et du nom affiché à chaque passage, pour pouvoir afficher une chaîne hors ligne dans son dossier
- [x] Numéro de version du schéma + fonctions de migration
- [x] Export / import JSON (sauvegarde, et pour changer de PC puisque rien n'est synchronisé)

## 5. Affichage des dossiers (cœur de la V1)

- [x] Masquer la liste native « Followed Channels » (CSS) **sans la supprimer** : on continue à la lire
- [x] Injecter à sa place le bloc FollowFolders, juste au-dessus de « Live Channels »
- [x] En-tête de dossier : 📁 / 📂 + nom + compteur « x en live »
- [x] Clic sur l'en-tête → ouvrir / fermer, état enregistré
- [x] Chaînes du dossier avec le même style que Twitch (avatar, nom, jeu, point rouge, spectateurs) — cartes recréées, pas déplacées, pour ne pas casser React
- [x] Chaînes hors ligne : grisées, en bas du dossier (option masquer)
- [x] Tri dans un dossier : spectateurs décroissants par défaut
- [x] Dossier spécial « Non classées » en bas : toutes les chaînes suivies qui ne sont dans aucun dossier
- [x] Respecter le thème sombre / clair de Twitch
- [x] Bouton d'urgence (popup) pour désactiver et retrouver la liste Twitch d'origine

## 6. Gestion des dossiers

- [x] Bouton « + Nouveau dossier » en haut du bloc
- [x] Renommer / supprimer un dossier (menu ⋯ sur l'en-tête)
- [x] Ranger une chaîne : glisser-déposer d'un dossier à l'autre
- [x] Alternative au glisser-déposer : menu au survol d'une chaîne « Déplacer vers… »
- [x] Réordonner les dossiers (glisser-déposer)
- [x] Une chaîne = un seul dossier (règle simple pour la V1)

## 7. Robustesse et qualité

- [x] Limiter le coût du `MutationObserver` (debounce, observer seulement la barre latérale)
- [ ] Tester à la main avec BetterTTV, FrankerFaceZ et 7TV installés
- [x] Si les sélecteurs ne trouvent plus la section : réafficher la liste Twitch d'origine plutôt que laisser une barre vide
- [x] Tests unitaires (Vitest) : modèle de données, tri, migrations, « Non classées »
- [x] Page HTML de test qui imite la barre latérale, pour développer sans dépendre de Twitch
- [x] Checklist de tests manuels avant chaque version (`docs/tests-manuels.md`)

## 8. Intégration continue (GitHub Actions)

- [x] Sur chaque Pull Request : `lint` + `test` + `build`
- [x] Sur tag `v*` : build → zip → GitHub Release avec le `.zip` en pièce jointe
- [x] Vérifier que la version du tag = version du `manifest.json`

## 9. Publication (plus tard)

- [ ] Compte développeur Chrome Web Store (frais d'inscription unique)
- [ ] Fiche : description FR / EN, captures 1280×800, icône 128 px
- [x] Politique de confidentialité : « aucune donnée envoyée, tout est stocké localement » (section du README, à mettre en ligne pour le Store)

## 10. Idées pour plus tard (V2+)

- [ ] Couleur / emoji par dossier
- [ ] Synchronisation entre PC (`chrome.storage.sync`)
- [ ] Connexion Twitch (OAuth) pour avoir toutes les chaînes suivies, même jamais vues dans la barre
- [ ] Dossiers automatiques par jeu
- [ ] Version Firefox
- [ ] Traductions (`_locales/fr`, `_locales/en`)
