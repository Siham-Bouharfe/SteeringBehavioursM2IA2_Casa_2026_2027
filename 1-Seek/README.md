# Seek et fuite — scénarios de steering

Ouvrir `index.html` dans un navigateur, ou servir ce dossier avec un serveur HTTP local.

- Le menu « Scénarios et réglages » permet de choisir entre poursuite (`Target`) et fuite (`CibleFuyante`), de régler le nombre de cibles (1–10) et le rayon de détection (50–300 px, 200 px par défaut).
- Le scénario poursuite conserve les véhicules qui suivent la cible la plus proche et réapparaissent aléatoirement au contact. Les cibles changent périodiquement de taille, de direction et de vitesse souhaitée et rebouclent au bord du canvas.
- Quand deux cibles se touchent, elles explosent en confettis ; les cibles manquantes réapparaissent après la fin du petit effet.
- Dans le scénario fuite, chaque `CibleFuyante` choisit le véhicule le plus proche à portée et fuit avec vitesse et force augmentées. Une fuite s’arrête à 300 px de distance ou après 5 secondes, puis la cible reprend son comportement normal. La touche `d` affiche/masque le rayon : jaune sans véhicule détecté, rouge lorsqu’un véhicule est dedans.
- À l’entrée d’un véhicule dans le rayon, une cible fuyante lâche deux leurres-tomates mobiles. Ils attirent les vaisseaux, disparaissent après 4,2 s, et font un petit pop de confettis s’ils sont rattrapés.
- Une cible principale rattrapée explose en confettis avec un son synthétisé en Web Audio. Les cibles principales réapparaissent après l’effet pour maintenir le nombre réglé ; un clic/toucher dans la page déverrouille l’audio selon les règles du navigateur.
- Les curseurs règlent le nombre de véhicules (1–200), leur vitesse maximale (0–20) et force maximale (0–10), ainsi que la vitesse et l’intensité du fond.
- Le fond radial animé mêle rose, rouge corail, saumon, orange et bleu du soir. Son centre suit la souris et ses ondulations sont modulées par la musique.
- Le bouton « Activer la musique » lance une ambiance douce synthétisée avec Web Audio FM. La position horizontale règle la fréquence du modulateur ; monter aiguise aussi le son et un mouvement horizontal l’abaisse. Le niveau et la phase FM animent le dégradé. Une interaction est nécessaire pour activer l’audio, selon les règles du navigateur.
- Les véhicules poursuivants réapparaissent ailleurs lorsqu’ils atteignent la cible. Leurs franchissements de bord suivent la méthode `Vehicle.edges()`.

`vehicle.js` reste inchangé. `FleeVehicle` fournit le rendu épuré des vaisseaux et la fuite de Reynolds sans dessiner le vecteur rouge fourni. `Target` et `CibleFuyante` en héritent ; les calculs de population et de réapparition sont dans `population.js`, les paramètres partagés dans `settings.js`, et le synthé audio inchangé dans `music.js`.

## Tests

Depuis ce dossier, avec Node.js 18 ou plus :

```sh
node --test tests/*.test.mjs
```

Aucune dépendance à installer. Les tests exercent les méthodes fournies de `Vehicle`, la fuite de Reynolds, les règles de fuite bornées de `CibleFuyante`, les limites de force et de vitesse ainsi que la population et les réapparitions.
