# Hexa Bloom

Un puzzle HTML mobile de piles hexagonales. Touchez une pile puis une case vide, ou glissez-la sur le plateau. Les couleurs supérieures identiques des cases voisines se regroupent. Dès 10 pièces identiques, la pile éclot et révèle les couleurs suivantes : les cascades rapportent jusqu’à ×5 points.

## Jouer

```sh
./serve.sh
# ou : npm start
# Windows : serve.bat
```

Ouvrez le port 8080 du serveur dans votre navigateur. Sur téléphone, utilisez l’adresse réseau de votre ordinateur sur le même Wi-Fi. Pour une installation sur l’écran d’accueil et le mode hors ligne, servez le dossier via HTTPS (localhost fonctionne aussi). Aucun serveur applicatif, compte, clé API ou build n’est nécessaire.

Les fichiers peuvent être publiés tels quels sur tout hébergement statique HTTPS, y compris dans un sous-dossier. Le jeu et les assets sont préchargés par le service worker au premier passage. Attendez quelques secondes après le chargement initial avant de passer hors ligne. Le premier chargement nécessite le réseau ; les suivants fonctionnent sans.

## Version HTML portable

```sh
node tools/standalone.mjs /tmp/Hexa-Bloom.html
```

Cette édition regroupe le jeu, les sons, le piano, la police et les licences dans un seul fichier HTML d’environ 605 Ko. Ouvrez ce fichier dans un navigateur qui exécute les fichiers HTML locaux : aucun serveur ni connexion ne sont requis. Sur mobile, l’hébergement HTTPS reste recommandé pour l’installation sur l’écran d’accueil et pour éviter les restrictions des lecteurs de fichiers intégrés.

## Contenu

- 30 jardins en cinq mondes, avec trois à six couleurs.
- Piles multicolores dès le jardin 3, fleurs au 4, rochers au 7, soleil et jokers au 10, récoltes au 13, pierres doubles au 19 et grand plateau au 25.
- Étoiles de maîtrise, cascades et record personnel.
- Mode zen sans objectif, défi quotidien déterministe renouvelé à minuit UTC.
- Annulation des 12 dernières actions, brassages et éclaircies gratuits. +1 brassage tous les quatre placements, +1 éclaircie par 50 pièces écloses. Aucune vie, attente, publicité ou transaction.
- Sauvegarde automatique par mode sur l’appareil. Supprimer les données du navigateur efface la progression.
- Musique au piano, sons, vibrations compatibles, symboles pour distinguer les couleurs et animations réduites.
- Souris, tactile et clavier : 1/2/3 choisit une pile, Tab et Entrée parcourent les cases, Z annule, Échap désélectionne.

## Développement et tests

Node 22+ et Python 3. Aucun paquet de production.

```sh
npm test
# Contrôle navigateur avec Playwright installé à l’extérieur du dépôt :
PLAYWRIGHT_MODULE=/workspace/hexa-bloom-tools/playwright-system.mjs node tests/browser.mjs
```

`src/engine.js` contient les règles sans DOM. `renderer.js` dessine un plateau Canvas 2D avec résolution plafonnée à 2×, sprites de pièces mis en cache, transferts pièce par pièce, rebonds et éclosions. Les trajectoires utilisent le temps écoulé et les animations ne tournent qu’en cas d’activité. `main.js` gère l’interface, la sauvegarde et les modes. `audio.js` joue des samples libres ; le piano est un arrangement original. Le jeu suspend l’audio quand l’onglet est masqué. Après une modification des fichiers livrés, lancez `node tools/update-cache.mjs` pour renouveler le cache hors ligne.

Les assets sont distribués avec leurs crédits et licences dans [CREDITS.md](CREDITS.md). L’ancien projet a été remplacé avec autorisation ; son historique Git est conservé. Une archive locale complète de l’état antérieur est conservée hors dépôt à `/workspace/backups/carillon-original.tar.gz`.
