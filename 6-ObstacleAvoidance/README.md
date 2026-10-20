# Le Jardin des Lucioles — Zouin

Ouvrir `index.html` avec Live Server (HTTP) pour le modèle GLB et le rendu Babylon.
Le jeu conserve un rendu de secours en 2D si la 3D est indisponible.

## Jouer

- Flèches ou ZQSD/WASD : avancer, reculer et tourner. Maj : sprinter.
- E : Zouin émet un vrai miaulement à chaque appui, même seul. Près d'un chat,
  l'action existante le nourrit ou l'invite ; il répond après le miaulement de
  Zouin **uniquement lorsqu'il rejoint la bande**. Maintenir E ne répète pas
  automatiquement le son. Les miaulements sont uniquement sonores, sans bulles.
  M : miauler seul.
- Espace : déposer un leurre pour distraire les papillons d'ombre. P : pause.
- **Carnet de Zouin**, en haut à droite : choisir une aventure, l'abandonner,
  consulter un tempérament ou entraîner le cerveau d'un chat.

Les missions ont un repère doré dans le monde et sur le radar :

| Mission | Objectif | Récompense |
| --- | --- | --- |
| Chat perdu | Le trouver, le recruter avec E et le ramener au refuge au sud | 140 pièces |
| Escorte | Rejoindre Pompon, puis l'accompagner sur le sentier vers le refuge. Il attend si Zouin s'éloigne de plus de 240 px | 180 pièces |
| Esquive | Rester en mouvement pendant 18, 25 ou 32 secondes selon la difficulté ; trois contacts font échouer la mission | 160 pièces |

Une aventure doit être terminée ou abandonnée avant d'entrer dans une course.
Un échec de mission laisse la balade jouable, sans attribuer de récompense.

## Miaulements

L'enregistrement réel provient de la sonothèque **LaSonothèque / BigSoundBank**,
« Meow Cat #2 », Joseph SARDIN (CC0). Il est fourni dans
`assets/audio/cat-meow.mp3` : aucun chargement distant pendant la partie, aucune
dépendance audio supplémentaire. `animalSounds.js` le décode et le met en cache
avec Web Audio, retire les silences en mémoire et différencie légèrement la voix
des réponses. Le clic de lancement active et précharge l'audio. Les crédits et
liens de licence sont dans `assets/audio/CREDITS.md`. Utiliser Live Server (HTTP).
Les autres effets, la musique, les déplacements et la course restent inchangés.

Fichiers de cette correction : ajout de `animalSounds.js`, du MP3 et de ses crédits ;
modification de `audioFeedback.js`, `catConversation.js`, `sketch.js`, `index.html`,
de ce document, de `tests/catConversation.test.cjs`, `tests/audioFeedback.test.cjs`
et `tests/browserSmoke.cjs`.
Ajout de `tests/animalSounds.test.cjs`. Aucun `vehicle.js` modifié.

Retrait des bulles de miaou (2D et 3D) : `babylonCityRenderer.js` et `sketch.js`
modifiés uniquement pour leur affichage, sans changer les sons ou le recrutement.
Tests : ajout de `tests/noMeowBubbles.test.cjs`, mise à jour de
`tests/browserSmoke.cjs` et de ce README.
Les contrats de sauvetage de groupes restent disponibles en parallèle.

## Algorithmes des dossiers du cours

| Dossier | Utilisation |
| --- | --- |
| 1 — Seek | Nourriture, leurres, rappel vers le groupe |
| 2 — Pursue/Evade | Les papillons anticipent la position de Zouin ; les chats anticipent leur fuite |
| 3 — Arrival | Arrivée douce, freinage pendant les salutations et attente de Pompon |
| 4 — Wander | Exploration continue autour de Zouin immobile, entrée à 110 px et sortie à 155 px |
| 5 — Projection / Path Following | Projection de la position future de Pompon sur les segments du sentier |
| 6 — Obstacle Avoidance | Capteurs des chats, de Pompon et des papillons |
| 7 — Boids | Séparation, alignement et cohésion distincts des lucioles ; un miaou disperse les lucioles voisines |
| 8 — Evolutionary Steering | Quatre gènes de chaque lignée : attraction alimentaire, prudence et deux rayons de perception. Les lignées des chats sauvés mutent pour le contrat suivant |
| 9 / 9-b — Réseaux et évolution | Course autonome, mutations et tournois privés de cerveaux |

Les nouvelles entités visibles (`GardenFood`, `GardenTree`, `GardenBed`,
`ShadowMoth`, `MissionBeacon`, `EscortCat`) héritent de `Vehicle` directement ou
via `Cat`. Les comportements retournent des forces ; `applyForce` et la locomotion
de `Vehicle` les appliquent. Aucun fichier `vehicle.js` n'a été modifié.

## Course exclusivement neuronale

Chaque chat possède un réseau **8–20–2** indépendant : cinq distances mesurées
par rayons (bords ou autres chats), la vitesse, l'angle vers l'avant du circuit et
le décalage latéral constituent les huit entrées. Le réseau choisit le virage et
la vitesse désirée. La conversion en force bornée alimente `applyForce`, puis
`Vehicle.update` assure la locomotion.

**Aucune force de seek, de séparation ou de recentrage n'est ajoutée en course.**
Les informations du circuit sont des entrées du cerveau et servent à mesurer la
progression et les sorties de piste ; elles ne déplacent pas le chat.
Le clavier ne remplace jamais le cerveau de Zouin pendant une course.
TAB change le chat observé ; D montre les capteurs et les entrées/sorties de son
réseau. Les résultats et récompenses du joueur concernent toujours Zouin.

Le premier cerveau possède des poids préconfigurés pour tourner et ralentir à
l'approche d'un obstacle. Il ne s'agit donc pas d'un apprentissage depuis zéro.
Son amélioration utilise l'algorithme évolutif du cours, pas la rétropropagation :

1. L'entraînement manuel évalue six variantes privées pendant deux générations.
2. Chaque tournoi ne compare que les variantes du même chat. L'élite est conservée.
3. Les essais utilisent les vrais vecteurs, capteurs et véhicules, à départ égal.
4. Après une course, les chats disposent également de quatre essais privés chacun.
5. Le calcul est découpé avec un budget d'environ 4 ms par image pour laisser
   le jardin jouable. Le bouton d'arrêt abandonne les essais en cours.

Le carnet indique les courses, essais, générations et meilleur tour. Les poids,
historiques, tempéraments, missions et pièces sont enregistrés localement dans le
navigateur. La clé stable `player` conserve le cerveau du joueur après le changement
de nom de Minette en Zouin. Changer d'origine HTTP change l'espace de sauvegarde.

## Vérification

Depuis la racine du dépôt :

```powershell
node --test '6-ObstacleAvoidance/tests/*.test.cjs'
node '6-ObstacleAvoidance/tests/browserSmoke.cjs' --http --screenshot
```

Les tests vérifient notamment les trois difficultés avec les aides de trajectoire
interdites, l'absence de pilote caché quand le cerveau cesse de tourner, l'indépendance
des cerveaux, les limites des forces, les missions, les gènes et les réponses vocales.
Le parcours Chrome contrôle aussi le signal Web Audio, l'absence de bulles, les boutons
du carnet, douze essais individuels sauvegardés, la caméra TAB et l'arrivée des chats.

## Fichiers de cette évolution

- Ajoutés : `catConversation.js`, `gardenBehaviors.js`, `gardenGenetics.js`,
  `gardenMissions.js`, `gardenClub.js`, `escortCat.js`, `shadowMoth.js`,
  `missionBeacon.js`, `gardenFood.js`, `gardenTree.js`, `gardenBed.js`,
  `raceTrainee.js`, `personalTraining.js` et ce document.
- Intégration : `sketch.js`, `index.html`, `style.css`, `audioFeedback.js`,
  `babylonCityRenderer.js`, `firefly.js`, `raceBrain.js`, `raceDynamics.js`.
- Tests ajoutés : `catConversation.test.cjs`, `gardenAdventures.test.cjs`,
  `neuralOnly.test.cjs` et `helpers/gameHarness.cjs` ; tests existants et parcours
  navigateur mis à jour pour les nouvelles règles.
