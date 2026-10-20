// Apparence uniquement : les positions et la locomotion restent celles de Cat/Vehicle.
const CAT_MODEL_FILE = 'cat-original.glb';
const CAT_ANIMATED_FILE = 'cat-animated-fixed.glb';
const CAT_MODEL_SCALE = 42;
// La racine corrigée retire l'échelle parasite du skin ; 7.2 redonne au chat sa taille dans la ville.
const CAT_ANIMATED_SCALE = 7.2;

const CAT_LEGS = [
  { upper: 'L_Leg_Upper', lower: 'L_Leg_Lower', foot: 'L_Foot', phase: 0, bend: 1 },
  { upper: 'R_Leg_Upper', lower: 'R_Leg_Lower', foot: 'R_Foot', phase: Math.PI, bend: 1 },
  { upper: 'L_BLeg_Upper', lower: 'L_BLeg_Lower', foot: 'L_BFoot', phase: Math.PI, bend: -1 },
  { upper: 'R_BLeg_Upper', lower: 'R_BLeg_Lower', foot: 'R_BFoot', phase: 0, bend: -1 },
];

function catGaitAngles(speed, phase) {
  const intensity = Math.min(1, Math.max(0, speed / 2.7));
  return CAT_LEGS.map(leg => {
    const cycle = phase + leg.phase;
    const swing = Math.sin(cycle) * intensity;
    const lift = Math.max(0, Math.cos(cycle)) * intensity;
    const upper = swing * 0.48;
    const lower = leg.bend * lift * 0.42;
    return { upper, lower, foot: -upper * 0.3 - lower * 0.55 };
  });
}

function catModelPose(heading, speed, frame, phase = 0) {
  const moving = Math.min(1, Math.max(0, speed / 3));
  const cycle = frame * (0.055 + moving * 0.14) + phase;
  return {
    yaw: Math.PI / 2 - (Number.isFinite(heading) ? heading : 0),
    height: 0.55 + Math.sin(cycle * 2) * (0.12 + moving * 0.48),
    roll: Math.sin(cycle) * moving * 0.035,
  };
}

function catFurMaterial(source, name, color) {
  const material = source.clone(name);
  const tint = BABYLON.Color3.FromHexString(color);
  if ('albedoColor' in material) material.albedoColor = tint;
  else if ('diffuseColor' in material) material.diffuseColor = tint;
  // Un faible éclairage propre garde la fourrure lisible dans les zones sombres.
  // Les textures (yeux, nez, marques du pelage) restent celles du modèle.
  material.emissiveColor = tint.scale(0.16);
  if ('metallic' in material) material.metallic = 0;
  if ('roughness' in material) material.roughness = 0.85;
  return material;
}

class CatModelVisual {
  constructor(scene, shadows) {
    this.scene = scene;
    this.shadows = shadows;
    this.container = null;
    this.template = null;
    this.rigged = false;
  }

  static async ensureLoader() {
    if (BABYLON.GLTFFileLoader) return;
    if (!CatModelVisual.loaderPromise) {
      CatModelVisual.loaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'libraries/babylonjs.loaders.min.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Le chargeur GLB local est indisponible.'));
        document.head.appendChild(script);
      });
    }
    await CatModelVisual.loaderPromise;
    if (!BABYLON.GLTFFileLoader) throw new Error('Le chargeur GLB ne s’est pas initialisé.');
  }

  async load() {
    // Les XHR vers un fichier GLB sont bloquées par Chrome depuis file://.
    // Le chat procédural reste alors visible ; Live Server sert le modèle en HTTP.
    if (window.location.protocol === 'file:') return false;
    await CatModelVisual.ensureLoader();
    try {
      const animated = await BABYLON.SceneLoader.LoadAssetContainerAsync('assets/', CAT_ANIMATED_FILE, this.scene);
      const names = new Set(animated.skeletons?.[0]?.bones.map(bone => bone.name) || []);
      if (!CAT_LEGS.every(leg => names.has(leg.upper) && names.has(leg.lower) && names.has(leg.foot))) {
        animated.dispose();
        throw new Error('Le squelette du chat ne contient pas quatre pattes complètes.');
      }
      if (this.sceneDisposed()) {
        animated.dispose();
        return false;
      }
      this.container = animated;
      this.template = animated.meshes[0];
      this.rigged = true;
      return true;
    } catch (error) {
      console.warn('Le chat articulé est indisponible ; essai du modèle précédent.', error);
    }
    const container = await BABYLON.SceneLoader.LoadAssetContainerAsync('assets/', CAT_MODEL_FILE, this.scene);
    if (this.sceneDisposed()) {
      container.dispose();
      return false;
    }
    const template = container.meshes.find(mesh => mesh.name === '__root__') || container.meshes[0];
    if (!template || !container.meshes.some(mesh => mesh.name.includes('Cat continuous body'))) {
      container.dispose();
      throw new Error('Le GLB chargé ne contient pas le chat attendu.');
    }
    container.addAllToScene();
    template.setEnabled(false);
    this.container = container;
    this.template = template;
    this.rigged = false;
    return true;
  }

  sceneDisposed() {
    return this.scene._isDisposed || this.scene.isDisposed === true ||
      (typeof this.scene.isDisposed === 'function' && this.scene.isDisposed());
  }

  create(cat) {
    if (!this.template) return null;
    if (this.rigged) return this.createRigged(cat);
    const root = new BABYLON.TransformNode(`catVisual${cat.name || ''}`, this.scene);
    try {
      const model = this.template.clone(`catSculpt${cat.name || ''}`, root, false);
      if (!model) throw new Error('Le modèle de chat ne peut pas être cloné.');
      model.scaling.scaleInPlace(CAT_MODEL_SCALE);
      model.setEnabled(true);
      const body = root.getChildMeshes(false).find(mesh => mesh.name.includes('Cat continuous body'));
      if (!body) throw new Error('Le corps du chat est absent du modèle cloné.');
      const color = cat.color && /^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : '#c7774e';
      if (body.material) {
        body.material = catFurMaterial(body.material, `catFur${cat.name || ''}${color}`, color);
      }
      this.shadows.addShadowCaster(body);
      root.metadata = { miaouvilleCatModel: true };
      return root;
    } catch (error) {
      root.dispose(false, true);
      throw error;
    }
  }

  createRigged(cat) {
    const root = new BABYLON.TransformNode(`catVisual${cat.name || ''}`, this.scene);
    let entries;
    try {
      entries = this.container.instantiateModelsToScene(
        name => `${cat.name || 'chat'}-${name}`, false, { doNotInstantiate: true }
      );
      const model = entries.rootNodes[0];
      const skeleton = entries.skeletons[0];
      if (!model || !skeleton) throw new Error('Le chat articulé n’a pas été cloné avec son squelette.');
      model.parent = root;
      model.scaling.scaleInPlace(CAT_ANIMATED_SCALE);
      const mesh = model.getChildMeshes(false).find(child => child.name.includes('Cat'));
      if (!mesh || mesh.skeleton !== skeleton) throw new Error('La peau du chat n’est pas reliée à son squelette.');
      const color = cat.color && /^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : '#c7774e';
      if (mesh.material) {
        mesh.material = catFurMaterial(mesh.material, `catAnimatedFur${cat.name || ''}${color}`, color);
      }
      this.shadows.addShadowCaster(mesh);
      const bounds = model.getHierarchyBoundingVectors();
      const bones = new Map(skeleton.bones.map(bone => {
        const node = bone.getTransformNode();
        return [bone.name, {
          bone,
          node,
          rest: (node?.rotationQuaternion || bone.getRotationQuaternion(BABYLON.Space.LOCAL)).clone(),
        }];
      }));
      entries.animationGroups.forEach(group => group.dispose());
      root.metadata = {
        miaouvilleCatModel: true,
        animatedCat: true,
        bones,
        phase: 0,
        lastFrame: null,
        groundHeight: Math.max(0, -bounds.min.y + 0.4),
      };
      return root;
    } catch (error) {
      root.dispose(false, true);
      entries?.rootNodes.forEach(node => { if (!node.isDisposed()) node.dispose(false, true); });
      entries?.skeletons.forEach(skeleton => skeleton.dispose());
      entries?.animationGroups.forEach(group => group.dispose());
      throw error;
    }
  }

  pose(root, cat, frame, heading) {
    const speed = cat.vel?.mag?.() || 0;
    const metadata = root.metadata;
    const deltaFrames = metadata.lastFrame === null ? 1 : Math.min(2, Math.max(0, frame - metadata.lastFrame));
    metadata.lastFrame = frame;
    if (speed > 0.05) metadata.phase += deltaFrames * (0.06 + Math.min(5, speed) * 0.06) *
      (cat.walkDirection === -1 ? -1 : 1);
    const gait = catGaitAngles(speed, metadata.phase);
    const rotate = (name, angle) => {
      const entry = metadata.bones.get(name);
      if (!entry) return;
      const delta = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, angle);
      const rotation = entry.rest.multiply(delta);
      if (entry.node) entry.node.rotationQuaternion = rotation;
      else entry.bone.setRotationQuaternion(rotation, BABYLON.Space.LOCAL);
    };
    CAT_LEGS.forEach((leg, index) => {
      rotate(leg.upper, gait[index].upper);
      rotate(leg.lower, gait[index].lower);
      rotate(leg.foot, gait[index].foot);
    });
    rotate('tail2', Math.sin(metadata.phase * 0.7) * 0.13);
    rotate('tail3', Math.sin(metadata.phase * 0.7 + 0.8) * 0.18);
    const visual = catModelPose(heading, speed, frame, cat.idlePhase || 0);
    root.position.y = metadata.groundHeight + (visual.height - 0.55) * 0.45;
    // Le GLB articulé regarde naturellement vers -X : compenser son axe local.
    root.rotation.y = visual.yaw + Math.PI / 2;
    root.rotation.z = visual.roll;
  }

  dispose() {
    this.template = null;
    this.container?.dispose();
    this.container = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CatModelVisual, catModelPose, catGaitAngles, catFurMaterial, CAT_LEGS, CAT_MODEL_FILE,
    CAT_ANIMATED_FILE, CAT_MODEL_SCALE, CAT_ANIMATED_SCALE };
}
