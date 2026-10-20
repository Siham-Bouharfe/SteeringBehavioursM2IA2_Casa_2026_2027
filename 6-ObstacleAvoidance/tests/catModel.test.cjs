const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CatModelVisual, catModelPose, catGaitAngles, catFurMaterial, CAT_LEGS, CAT_MODEL_SCALE,
  CAT_ANIMATED_FILE } = require('../catModel.js');

test('le modèle local est un GLB autonome contenant un vrai corps de chat', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cat-original.glb'));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(json.meshes.length >= 10);
  assert.ok(json.nodes.some(node => node.name === 'Cat continuous body'));
  assert.ok(json.buffers.every(buffer => !buffer.uri), 'Le GLB ne doit pas charger d’autres fichiers');
  assert.ok(CAT_MODEL_SCALE > 0);
});

test('le nouveau GLB a un squelette distinct pour les quatre pattes', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', CAT_ANIMATED_FILE));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const names = new Set(json.skins.flatMap(skin => skin.joints.map(index => json.nodes[index].name)));
  assert.equal(json.skins.length, 1);
  assert.ok(CAT_LEGS.every(leg => names.has(leg.upper) && names.has(leg.lower) && names.has(leg.foot)));
  assert.ok(json.meshes.length > 0);
  assert.equal(json.nodes[json.skins[0].skeleton].name, 'Cat.001',
    'La racine du squelette doit être l’ancêtre commun des quatre pattes');
});

test('le modèle corrigé conserve toute la géométrie et ne change que la racine du squelette', () => {
  const original = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cat-animated.glb'));
  const corrected = fs.readFileSync(path.join(__dirname, '..', 'assets', CAT_ANIMATED_FILE));
  assert.equal(corrected.length, original.length);
  const changes = [];
  for (let index = 0; index < original.length; index++) {
    if (original[index] !== corrected[index]) changes.push(index);
  }
  assert.equal(changes.length, 1);
  assert.equal(String.fromCharCode(original[changes[0]]), '3');
  assert.equal(String.fromCharCode(corrected[changes[0]]), '2');
});

test('la marche alterne les diagonales, reste immobile à l’arrêt et borne la course', () => {
  const still = catGaitAngles(0, 0.6);
  assert.ok(still.every(leg => leg.upper === 0 && leg.lower === 0 && leg.foot === 0));
  const walk = catGaitAngles(1.8, Math.PI / 2);
  assert.ok(walk[0].upper > 0 && walk[1].upper < 0);
  assert.equal(walk[0].upper, walk[3].upper);
  assert.equal(walk[1].upper, walk[2].upper);
  const run = catGaitAngles(100, Math.PI / 2);
  assert.ok(Math.abs(run[0].upper) <= 0.48);
  assert.ok(run.every(leg => Math.abs(leg.lower) <= 0.42));
});

test('la pose réagit à la direction et au mouvement sans toucher à la locomotion', () => {
  const idle = catModelPose(0, 0, 20, 0);
  const running = catModelPose(Math.PI / 2, 4, 20, 0);
  assert.ok(Math.abs(idle.yaw - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(running.yaw) < 1e-9);
  assert.ok(Math.abs(running.roll) > Math.abs(idle.roll));
  assert.ok(Number.isFinite(catModelPose(NaN, -100, 20).height));
});

test('les pelages gardent leurs textures et un éclairage doux sans modifier le matériau partagé', () => {
  const previousBabylon = global.BABYLON;
  const texture = {};
  const source = { albedoTexture: texture, metallic: 0.4, roughness: 0.27,
    albedoColor: null, clone(name) { return { ...this, name }; } };
  global.BABYLON = { Color3: { FromHexString: () => ({
    r: 1, g: 0.8, b: 0.5,
    scale(n) { return { r: this.r * n, g: this.g * n, b: this.b * n }; },
  }) } };
  try {
    const material = catFurMaterial(source, 'cream', '#fff2d6');
    assert.equal(material.albedoTexture, texture);
    assert.equal(material.metallic, 0);
    assert.equal(material.roughness, 0.85);
    assert.ok(material.emissiveColor.r > 0 && material.emissiveColor.r < 0.2);
    assert.equal(source.metallic, 0.4);
    assert.equal(source.albedoColor, null);
  } finally { global.BABYLON = previousBabylon; }
});

test('file:// garde le chat précédent au lieu de bloquer le jeu', async () => {
  const previousWindow = global.window;
  global.window = { location: { protocol: 'file:' } };
  try {
    const visual = new CatModelVisual({}, {});
    assert.equal(await visual.load(), false);
    assert.equal(visual.template, null);
  } finally {
    global.window = previousWindow;
  }
});

test('un modèle inattendu est refusé et ses ressources sont libérées', async () => {
  const previousWindow = global.window;
  const previousBabylon = global.BABYLON;
  const previousWarn = console.warn;
  let disposed = false;
  let warning = '';
  global.window = { location: { protocol: 'http:' } };
  global.BABYLON = {
    GLTFFileLoader: function GLTFFileLoader() {},
    SceneLoader: {
      LoadAssetContainerAsync: async () => ({
        meshes: [{ name: '__root__' }, { name: 'other model' }],
        dispose() { disposed = true; },
      }),
    },
  };
  console.warn = message => { warning = message; };
  try {
    const visual = new CatModelVisual({}, {});
    await assert.rejects(visual.load(), /chat attendu/);
    assert.match(warning, /chat articulé est indisponible/);
    assert.equal(disposed, true);
    assert.equal(visual.template, null);
  } finally {
    console.warn = previousWarn;
    global.window = previousWindow;
    global.BABYLON = previousBabylon;
  }
});
