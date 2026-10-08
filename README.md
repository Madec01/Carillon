# Orbitale

Une fabrique de petites planètes, jouable en HTML sur téléphone et ordinateur. Posez un astre sur le grand plateau de **5 colonnes et 7 lignes** : trois voisins de même couleur et de même taille fusionnent en un nouvel astre. Étoiles → lunes → planètes → supernovas. Chaque cascade augmente le multiplicateur jusqu’à **×6**.

## Jouer

```sh
./serve.sh
# ou : npm start
# Windows : serve.bat
```

Ouvrez le port **8080** du serveur dans votre navigateur. Sur téléphone, utilisez l’adresse réseau de votre ordinateur sur le même Wi-Fi. Le jeu fonctionne sans compte, clé API, serveur applicatif ni compilation. Python 3 suffit pour le servir ; Node.js 22+ sert aux tests et aux outils de distribution.

Les fichiers se publient tels quels sur un hébergement statique, y compris dans un sous-dossier. Pour installer le jeu sur l’écran d’accueil et jouer hors ligne, utilisez **HTTPS** ou localhost. Le premier passage précharge les fichiers locaux ; attendez la fin de ce chargement avant de couper le réseau. Le service worker renouvelle ses propres caches Orbitale et retire les anciens caches Hexa Bloom.

## Une progression en 30 missions

- **Éveil, missions 1–6** : apprenez les fusions et préparez les cascades. Une nouvelle planète attire jusqu’à deux astres de sa couleur sur les cases libres autour d’elle.
- **Portails, missions 7–12** : deux cases de même portail deviennent voisines. Dès la mission 10, les météorites se fissurent quand une fusion se produit à côté.
- **Orbites, missions 13–18** : les astres d’une orbite avancent d’une case tous les quatre placements.
- **Gravité, missions 19–24** : tous les trois placements, les astres glissent selon la direction annoncée et peuvent fusionner à l’arrivée.
- **Cosmos, missions 25–30** : les mécaniques se combinent et la gravité change après chaque marée.

Les plateaux ont plusieurs silhouettes, passages et îlots. Trois planètes identiques déclenchent une **supernova** : une comète nettoie toute la ligne et toute la colonne. Une mission se termine quand son score et son nombre de planètes créées sont atteints.

Le **défi quotidien** propose une séquence déterministe commune pour la journée, renouvelée à minuit en Europe/Paris. Le **mode libre** conserve les portails et les orbites, sans score cible ni fin imposée.

## Commandes et outils gratuits

Touchez un des trois astres de la réserve, puis une case libre ; vous pouvez aussi le glisser sur le plateau. Sur ordinateur, les touches **1, 2, 3** choisissent l’astre, **Tab** et **Entrée** permettent d’utiliser les cases et boutons, **Z** annule et **Échap** désélectionne.

- **Nouvelle réserve** : change les trois astres. Une recharge tous les quatre placements, jusqu’à trois.
- **Éclipse** : retire un astre ou une météorite. Une recharge tous les huit placements et après chaque supernova, jusqu’à cinq.
- **Attraction** : à 100 % d’énergie, fusionne l’astre sélectionné avec deux astres identiques, même éloignés. Les fusions chargent la jauge.
- **Conseil** et **annulation** aident à préparer ou reprendre un coup.

Aucune publicité, transaction, vie limitée ou attente payante. Les paramètres permettent de régler les sons, le piano, les vibrations, les symboles de couleur et la réduction des animations.

La sauvegarde automatique utilise la clé locale **`orbitale-v1`**, indépendante de l’ancienne sauvegarde Hexa Bloom. Chaque mode garde sa partie ; les anciennes données ne sont pas écrasées. Effacer les données du navigateur efface la progression sur cet appareil. Aucun envoi de progression à un serveur.

## Version HTML autonome

```sh
node tools/standalone.mjs /tmp/Orbitale.html
```

Le fichier obtenu contient le jeu, les sons, le piano, la police et leurs licences. Il peut être ouvert dans un navigateur qui exécute les fichiers HTML locaux, sans serveur ni réseau. Sur mobile, un hébergement HTTPS permet aussi l’installation sur l’écran d’accueil et évite les restrictions des lecteurs de fichiers intégrés.

## Développement et validation

Aucune dépendance de production ni étape d’installation npm n’est nécessaire.

```sh
npm test
node tests/progression.mjs
# Avec Playwright disponible, serveur déjà démarré :
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/browser.mjs
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/renderer-browser.mjs
# Valider l’édition autonome après sa génération :
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/portable.mjs
# Après toute modification d’un fichier livré :
node tools/update-cache.mjs
```

`src/engine.js` contient les règles déterministes sans DOM. Les tests vérifient les fusions, la conservation de matière, les pouvoirs, les cascades, les portails, les orbites, la gravité et la validation des sauvegardes. `tests/progression.mjs` joue légalement les 30 missions et contrôle leurs objectifs.

`src/renderer.js` dessine les astres et les effets Canvas 2D. `src/main.js` pilote les commandes, les modes et les sauvegardes. `src/audio.js` orchestre les samples libres et un arrangement génératif de piano. Les ressources sont servies localement, sans CDN ni suivi.

Le code est sous licence MIT. Les assets gratuits conservent leurs licences et attributions : **Kenney (CC0), Salamander Grand Piano d’Alexander Holm (CC BY 3.0), Nunito (SIL OFL 1.1) et Lucide (ISC)**. Sources et textes de licence : [CREDITS.md](CREDITS.md), `assets/licenses/` et `assets/fonts/OFL.txt`.
