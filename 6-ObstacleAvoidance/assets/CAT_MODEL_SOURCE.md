# Modèle 3D du chat

`cat-animated.glb` : « Cat » par J-Toastie, sous licence Creative Commons Attribution (CC BY 3.0).

`cat-animated-fixed.glb` : copie utilisée par le jeu. La seule modification du fichier source est la racine déclarée du squelette (`skin.skeleton` : nœud `Cat.001` au lieu de `belly`). Les sommets, matériaux, os et animations n'ont pas été modifiés. Cette correction permet à Babylon de conserver la peau sous la même racine que les quatre pattes. Le fichier d'origine est conservé ci-dessus.

Source et attribution : https://poly.pizza/m/DJ9rpAhrh3 — « Cat » by J-Toastie, CC BY 3.0, https://creativecommons.org/licenses/by/3.0/

Dans Miaouville, les articulations des quatre pattes et de la queue sont animées dans `catModel.js` selon la vitesse de chaque chat.

`cat-original.glb` : « Standing cat », modèle original publié par Innerscene dans le domaine public (CC0).

Source : https://www.innerscene.com/tools/library/3d-parts/standing-cat-cda42538

Ce modèle statique est conservé comme secours si le modèle articulé ne se charge pas. La locomotion et les comportements du jeu restent ceux de `Cat`, sous-classe de `Vehicle`.
