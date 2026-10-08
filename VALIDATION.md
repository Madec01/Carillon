# Validation d’Orbitale

Vérifications effectuées le 8 octobre 2026 avec Node.js 24 et Chromium 151, piloté par Playwright 1.58.2.

- **21 tests de règles réussis** (`npm test`) : couleur et taille des fusions, conservation de matière, attraction, supernovas, comètes, portails, météorites, orbites, gravité, pouvoirs, sauvegardes et progression. Le bot termine les **30 missions** en utilisant des coups légaux.
- **45 assertions navigateur réussies** (`tests/browser.mjs`) : écran 1440 × 1024, téléphone 390 × 844 et petit téléphone 360 × 640. Placement tactile, véritable glisser-déposer, cascade à deux fusions, score synchronisé, annulation, victoire et déblocage, comète, attraction chargée, audio, accessibilité, reprise des sauvegardes, modes, récupération gratuite d’un plateau plein et jeu hors ligne. Une annulation pendant le délai de victoire empêche un déblocage incorrect. Aucun débordement horizontal, erreur JavaScript ou réponse HTTP en échec.
- **47 assertions de rendu réussies** (`tests/renderer-browser.mjs`) : instantanés après chaque événement, conservation de l’objet événement, callback d’impact unique, mouvements réduits, interruption d’une animation et arrêt des rafraîchissements une fois les effets terminés.
- **HTML autonome testé sans réseau** (`tests/portable.mjs`) : cascade réelle étoile → lune → planète, contrôle sonore, cinq fichiers audio décodés par Web Audio, aucune requête HTTP externe ni erreur JavaScript.
- Le serveur a été redémarré avec `serve.sh` et le service worker a été régénéré après les changements des fichiers livrés. Le cache retire uniquement les anciennes versions Orbitale et Hexa Bloom.

Le plateau possède 5 colonnes et 7 rangées. Sur les deux formats téléphone testés, son canvas mesure environ 364 × 478 et 336 × 348 pixels CSS ; la réserve, les outils et les modes restent visibles. Les formes, cases de portail, orbites et météorites varient avec les missions.

Les astres utilisent des sprites Canvas mis en cache et une résolution plafonnée à deux fois la taille CSS. Les animations terminent proprement quand la page devient invisible. Elles respectent l’option de réduction des mouvements. Les captures sont produites hors dépôt dans `/tmp/orbitale-tests`.

L’aperçu vidéo montre une véritable cascade de la première mission puis une supernova issue de quatre coups légaux en mode libre.

## Reproduire

Démarrer `./serve.sh`, puis exécuter :

```sh
npm test
node tests/progression.mjs
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/browser.mjs
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/renderer-browser.mjs
node tools/standalone.mjs /tmp/Orbitale.html
PLAYWRIGHT_MODULE=/chemin/vers/playwright-system.mjs node tests/portable.mjs
```

`PLAYWRIGHT_MODULE` peut être omis si le paquet `playwright` et son navigateur sont installés normalement. `TEST_URL` permet de changer l’adresse de test ; `PORTABLE_FILE` celle du HTML autonome.

Les formats téléphone sont émulés dans Chromium. Safari iOS et des appareils physiques n’ont pas été testés ici. L’accès direct `file://` est désactivé par la politique du navigateur cloud : l’édition autonome a été exécutée comme document HTML, réseau coupé. Cela ne valide pas les lecteurs de fichiers intégrés des téléphones ; l’hébergement HTTPS permet de jouer et d’installer le jeu sans dépendre de ces lecteurs.
