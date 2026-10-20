# Évolutions de l'exemple `1-Seek`

## Fonctionnalités prévues et réalisées

- Deux curseurs globaux règlent la vitesse maximale de tous les véhicules de `0` à `20` et leur force maximale de `0` à `10`.
- Les véhicules poursuivent deux cibles autonomes `Target`, sous-classes de `Vehicle`, et choisissent la plus proche.
- Chaque cible possède un anneau de protection visible de 65 px. Si un véhicule y entre, elle fuit en s'éloignant de lui avec une force limitée par `maxForce`.
- Les cibles varient périodiquement de direction, de vitesse souhaitée et de rayon. Leur couleur est échantillonnée dans le canvas à leur position afin de suivre le dégradé.
- La détection d'arrivée et les zones de réapparition prennent en compte la taille réelle des cibles et évitent leurs anneaux de protection.
- Le fond utilise un dégradé radial arc-en-ciel animé. Des curseurs règlent sa vitesse et son intensité.
- Une ambiance sonore synthétisée avec Web Audio peut être activée par bouton. Son niveau audio module le mouvement et la pulsation du fond.

## Organisation

- `1-Seek/sketch.js` orchestre la scène et le rendu du fond ;
- `1-Seek/target.js` contient l'entité autonome `Target` ;
- `1-Seek/population.js` gère l'effectif, la détection d'arrivée et la réapparition ;
- `1-Seek/settings.js` applique les paramètres communs ;
- `1-Seek/music.js` génère et mesure l'ambiance Web Audio ;
- `1-Seek/index.html` et `1-Seek/style.css` définissent les contrôles ;
- `1-Seek/tests/` vérifie les règles de mouvement et de scène.

## Vérification

Commande : `node --test tests/*.test.mjs`, depuis `1-Seek`. Les tests doivent couvrir les deux bornes des curseurs, la limite de steering, les cas proches et éloignés, le rayon de la cible, les règles de réapparition et le comportement aléatoire reproductible.

Le fichier `vehicle.js` fourni doit rester inchangé.
