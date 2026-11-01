# Changelog

Toutes les évolutions notables de FollowFolders sont listées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versions : [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

## [0.1.0] - 2026-11-01

### Ajouté

- Remplacement de la section « Followed Channels » de la barre latérale Twitch par des dossiers ; « Live Channels » et les autres sections restent affichées en dessous.
- Dossiers nommés, ouverts 📂 / fermés 📁, état mémorisé ; compteur de chaînes en live par dossier.
- Création, renommage, suppression (avec confirmation) et réordonnancement des dossiers.
- Rangement des chaînes par glisser-déposer ou via le menu ⋯ (« Déplacer vers… », « Nouveau dossier », « Retirer du dossier »).
- Section « Non classées » ; chaînes hors ligne masquées par défaut avec bouton « Afficher N hors ligne ».
- Tri dans chaque dossier : live par spectateurs décroissants, puis hors ligne par ordre alphabétique.
- Chargement automatique de toute la liste (« Show More »).
- Navigation instantanée au clic (même comportement que Twitch).
- Stockage 100 % local (`chrome.storage.local`), cache des noms et avatars pour afficher les chaînes hors ligne.
- Popup : activer / désactiver, options d'affichage, tout ouvrir / fermer, export / import JSON.
- Retour automatique à la liste Twitch d'origine si la barre est réduite, si l'extension est désactivée ou en cas d'erreur.
- Tests unitaires (Vitest), tests de bout en bout (Playwright), intégration continue et releases GitHub Actions.

[Non publié]: ../../compare/v0.1.0...HEAD
[0.1.0]: ../../releases/tag/v0.1.0
