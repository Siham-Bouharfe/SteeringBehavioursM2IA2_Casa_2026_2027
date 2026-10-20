# MiaouVille et les Chats-Serpents — projets d’IA réactive

Ce dépôt présente trois jeux réalisés à partir des exemples de steering behaviors du module. Ils mettent en pratique les comportements de Craig Reynolds, l’héritage de la classe `Vehicle` et, pour la course de MiaouVille, des réseaux de
neurones améliorés par un algorithme évolutif.

## À l’attention du professeur : les trois dossiers à évaluer

**Pour découvrir et essayer les trois jeux présentés dans la vidéo, merci de consulter uniquement les dossiers ci-dessous.** Les autres dossiers du dépôt restent des exemples du cours, des corrections ou des expérimentations ; il n’est pas nécessaire de les ouvrir pour cette présentation.

| Jeu | Dossier à ouvrir | Fichier à lancer avec Live Server |
| --- | --- | --- |
| **MiaouVille — Le Jardin des Lucioles** | [6-ObstacleAvoidance](6-ObstacleAvoidance/) | [6-ObstacleAvoidance/index.html](6-ObstacleAvoidance/index.html) |
| **Le Chat-Serpent gourmand** | [3-Arrival](3-Arrival/) | [3-Arrival/index.html](3-Arrival/index.html) |
| **Le Circuit des Chats-Serpents** | [5-3-PathFollowingComplex](5-3-PathFollowingComplex/) | [5-3-PathFollowingComplex/index.html](5-3-PathFollowingComplex/index.html) |

Attention : le Chat-Serpent gourmand se trouve dans **`3-Arrival`**, et non dans
`3-Arrival_correction`. MiaouVille se lance depuis **`6-ObstacleAvoidance`**, même
si le jeu réutilise des algorithmes provenant de plusieurs chapitres du cours.

## Lancer les jeux avec Live Server

1. Ouvrir la racine de ce dépôt dans **Visual Studio Code**.
2. Vérifier que l’extension **Live Server** est installée.
3. Dans l’explorateur de VS Code, ouvrir l’un des trois dossiers indiqués ci-dessus.
4. Faire un clic droit sur son fichier **`index.html`**, puis choisir
   **Open with Live Server**.
5. Le jeu s’ouvre dans le navigateur à une adresse locale commençant par
   `http://127.0.0.1:...` ou `http://localhost:...`.

Il n’y a pas de compilation ni de commande `npm install` nécessaire pour jouer.
**Ne pas lancer les pages par un simple double-clic en `file://`** : le chargement
des modèles 3D, des polices et des sons doit passer par le serveur HTTP local.
Cliquer dans la page ou sur le bouton de lancement pour autoriser le son.

## 1. MiaouVille — Le Jardin des Lucioles

**Dossier : [6-ObstacleAvoidance](6-ObstacleAvoidance/).**

MiaouVille est un jeu d’exploration et de sauvetage dans un jardin-ville nocturne
en 3D. Le joueur incarne **Zouin** : il récupère des provisions, nourrit les chats,
les invite dans sa bande et les accompagne jusqu’au refuge. Le carnet propose
aussi des missions de recherche, d’escorte et d’esquive, avec des récompenses.

### Prise en main

- Cliquer sur **Partir en balade** pour commencer.
- **Flèches** ou **ZQSD / WASD** : avancer, reculer et tourner ; **Maj** : sprinter.
- **E** : miauler et interagir avec un chat proche pour le nourrir ou l’inviter.
  Un chat qui rejoint la bande répond par un miaulement. **M** : miauler seul.
- **Espace** : déposer un leurre ; **P** ou **Échap** : mettre en pause.
- Ouvrir le **Carnet de Zouin** pour choisir une mission ou entraîner le cerveau
  d’un chat. Le radar aide à se repérer dans le jardin.

### Algorithmes utilisés

Les comportements sont répartis selon les besoins des entités : **Seek** pour
rejoindre un objectif, **Arrival** pour ralentir à l’approche, **Wander** pour
explorer, **Pursue / Evade** pour anticiper une poursuite ou une fuite,
**Path Following** pour l’escorte et **Obstacle Avoidance** pour anticiper les
obstacles. Les lucioles utilisent les trois règles des **Boids** : séparation,
alignement et cohésion. Des paramètres génétiques font également varier les
préférences et la perception des lignées de chats.

### Essayer la course neuronale

En balade, rejoindre le circuit lumineux de la clairière et entrer sur la piste
pour déclencher le Grand Prix. Si une mission du carnet est active, la terminer
ou l’abandonner avant de lancer la course. Le menu **Niveau course** propose
**Détente**, **Classique** et **Champion**.

Pendant la course, **tous les chats, y compris Zouin, sont autonomes** : le clavier
ne les pilote pas. **Tab** change le chat suivi par la caméra et **D** affiche ses
capteurs ainsi que les entrées et sorties de son réseau.

Chaque chat possède son propre réseau **8–20–2** : cinq distances de capteurs,
la vitesse, l’angle vers l’avant du circuit et le décalage latéral alimentent
les huit entrées ; les deux sorties commandent le virage et la vitesse désirée.
**Aucune force de suivi de chemin ne pilote les coureurs à la place du réseau.**

Les cerveaux sont améliorés individuellement par essais, mutations et sélection
de variantes. Les poids initiaux sont préconfigurés : il ne s’agit pas d’un
apprentissage depuis zéro ni de rétropropagation. Les progrès, missions et pièces
sont sauvegardés dans le navigateur.

**Technologies :** JavaScript, HTML/CSS, p5.js pour la simulation et les vecteurs,
Babylon.js pour le rendu 3D, modèles GLB, Web Audio API et `localStorage`.
Le fonctionnement détaillé et les crédits sont indiqués dans le
[README de MiaouVille](6-ObstacleAvoidance/README.md).

## 2. Le Chat-Serpent gourmand

**Dossier : [3-Arrival](3-Arrival/).**

Déplacer la souris pour guider le chat vers les croquettes. Chaque croquette
mangée ajoute un cercle visible à sa queue : ces **anneaux** composent le corps
du serpent, tandis que les croquettes restent des objets séparés à ramasser.

La tête utilise **Arrival** pour rejoindre le curseur et ralentir à son approche.
Chaque anneau suit un point situé derrière le segment précédent avec le même
principe. La tête, les anneaux et les autres entités visibles héritent de
`Vehicle`.

Le jeu comprend un score, des croquettes dorées, des combos et de petites
missions. Tous les **dix repas**, des croquettes-particles se rassemblent pour
écrire **« OUIIIII ! »**, puis éclatent. Ces particules utilisent elles aussi
des forces de déplacement. **D** active ou désactive le debug ; cliquer dans
la page permet d’activer l’audio.

**Technologies :** JavaScript, HTML/CSS, p5.js pour le dessin, le texte et les
vecteurs, et p5.sound pour les effets sonores.

## 3. Le Circuit des Chats-Serpents

**Dossier : [5-3-PathFollowingComplex](5-3-PathFollowingComplex/).**

Cette variante fait évoluer les chats-serpents de manière autonome sur un
circuit fermé. La tête utilise **Path Following** pour suivre la piste. Les
anneaux rejoignent un point derrière leur prédécesseur avec **Arrival**. La
**séparation** agit sur la tête et les anneaux pour limiter les chevauchements,
et un **Wander** léger ajoute une variation naturelle à la conduite.

Les curseurs permettent de modifier en direct :

- le poids du suivi du circuit et celui de la séparation ;
- la largeur de la piste, en pixels ;
- le nombre d’anneaux et leur espacement, en pixels.

**T** ajoute un nouveau chat ; **D** active ou désactive le debug pour observer
les projections et les zones de séparation. Le niveau de Wander peut être
modifié dans le code avec la constante `WANDER_WEIGHT` de `sketch.js`.

**Ce circuit utilise directement les steering behaviors, pas un réseau de
neurones.** Il est distinct du Grand Prix neuronal intégré à MiaouVille.

**Technologies :** JavaScript, HTML/CSS et p5.js.

## Organisation commune

Les trois projets réutilisent la classe `Vehicle` et les vecteurs `p5.Vector`.
Les comportements calculent des forces de direction, transmises à `applyForce`,
puis la locomotion met à jour la vitesse et la position. L’objectif pédagogique
est de distinguer le choix de l’action, le steering et le déplacement, tout en
composant plusieurs comportements dans un même jeu.

## Tests automatisés — facultatif pour essayer les jeux

**Live Server suffit pour jouer.** Pour exécuter les tests, avec Node.js installé,
lancer les commandes suivantes depuis la racine du dépôt :

```powershell
node --test '3-Arrival/tests/*.test.mjs'
node --test '5-3-PathFollowingComplex/tests/*.test.mjs'
node --test '6-ObstacleAvoidance/tests/*.test.cjs'
```
## Lien de la vidéo Youtube 
https://www.youtube.com/watch?v=953PUwEWrJQ

## Lien du Jeu MiaouVille sur itch.io
https://sihambhrf.itch.io/miaouville-le-jardin-des-lucioles