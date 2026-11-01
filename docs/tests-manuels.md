# Checklist de tests manuels (avant chaque version)

Sur le vrai twitch.tv, connecté, extension rechargée dans `chrome://extensions`.

- [ ] La section « Followed Channels » est remplacée par « Chaînes suivies » + dossiers
- [ ] « Live Channels » (et les recommandations) sont toujours affichées en dessous
- [ ] Toutes les chaînes suivies sont chargées (rien derrière « Show More »)
- [ ] Créer un dossier, le renommer, le supprimer
- [ ] Ranger une chaîne par glisser-déposer, puis via ⋯ → Déplacer vers…
- [ ] Ouvrir / fermer un dossier, recharger la page : l'état est conservé
- [ ] Le compteur rouge d'un dossier fermé correspond au nombre de chaînes en live
- [ ] Clic sur une chaîne : la page change sans rechargement complet ; Ctrl+clic ouvre un nouvel onglet
- [ ] Réduire la barre latérale (←|) : Twitch d'origine ; la redéployer : dossiers de retour
- [ ] Popup : désactiver → liste d'origine immédiatement ; réactiver
- [ ] Popup : exporter, puis importer le fichier dans un autre profil Chrome
- [ ] Thème clair de Twitch : lisible
- [ ] Avec 7TV / BetterTTV / FrankerFaceZ installés : pas de conflit
- [ ] Twitch en français (Paramètres → Langue) : la section est bien trouvée
- [ ] Console (F12) : aucune erreur `[FollowFolders]`
