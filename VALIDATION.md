# Validation de livraison

Effectuée dans l’environnement cloud le 7 octobre 2026, avec Node 24.19 et Chromium 151 via Playwright 1.58.2.

- **15 tests moteur et animation réussis** : géométrie, placements interdits, conservation des pièces, cascade ×2, fleurs, soleil, rochers, jokers, objectifs combinés, déterminisme, aides gratuites et détection du plateau plein. Les tests d’animation vérifient aussi la conservation des pièces en vol, l’arrivée différée, les fréquences 30/60/120 Hz et la hauteur maximale des piles.
- **30 jardins sur 30 terminés** avec des actions légales par un joueur de référence qui évalue les coups. Cela vérifie que les objectifs sont réalisables, sans remplacer un playtest humain d’équilibrage. Reproduction : `node tests/progression.mjs`.
- **42 assertions navigateur réussies** : ordinateur 1440 × 1024, téléphone 390 × 844 et petit téléphone 360 × 640. Contrôles du toucher, glisser-déposer, annulation, fusion, victoire et déblocage, cascade, audio, options d’accessibilité, sauvegarde après rechargement, modes, récupération d’un plateau plein et jeu hors ligne. Aucun débordement horizontal, erreur JavaScript ou réponse HTTP en échec pendant cette suite.
- Les cinq fichiers audio MP3 ont été décodés avec succès par Web Audio.
- L’édition autonome a été exécutée comme document HTML avec le réseau coupé : fusion réelle, contrôle audio et aucune requête externe. L’accès direct `file://` est désactivé par la politique du navigateur cloud ; ce test ne prétend pas valider le lecteur de fichiers d’un téléphone.
- Le serveur a été arrêté puis redémarré avec le nouveau `serve.sh`, avant une nouvelle validation fonctionnelle.

Les tailles téléphone ont été émulées dans Chromium. Safari iOS et les appareils physiques n’ont pas été testés dans cet environnement. Le jeu utilise des API web standard et des fichiers MP3 pour faciliter cette compatibilité.

Les captures des tests sont produites hors dépôt dans `/tmp/hexa-bloom-tests`. Les résultats ne dépendent pas des anciennes suites de Carillon, supprimées lors de la refonte.

## Refonte des effets

Les piles utilisent des sprites de pièces aux bords arrondis, avec des faces ombrées et un reflet. Les déplacements sont calculés pièce par pièce en fonction du temps écoulé : retrait de la source au décollage, ajout à la destination à l’atterrissage, rebond et son au même instant. Le score attend l’éclosion. Les animations réduites restent disponibles.

Une cascade réelle a été capturée au format téléphone : placement → transfert → éclosion → second transfert → seconde éclosion. Les lectures de score ont été vérifiées pendant ces phases. Le coût JavaScript du dessin du plateau mesuré au 95e percentile était d’environ 3,3 ms dans Chromium cloud (221 images échantillonnées, capture vidéo active). Ce chiffre n’est pas une mesure de performance sur appareil physique.
