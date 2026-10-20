function chaseCameraAlpha(heading) {
  if (!Number.isFinite(heading)) throw new TypeError('L’orientation du chat doit être un nombre fini.');
  const behindHeading = heading + Math.PI;
  return Math.atan2(Math.sin(behindHeading), Math.cos(behindHeading));
}

function getChaseCameraProfile(racing) {
  return racing
    ? { radius: 370, beta: 0.91, lookAhead: 58 }
    : { radius: 540, beta: 0.98, lookAhead: 92 };
}

class BabylonCityRenderer {
  constructor(world) {
    this.world = world;
    this.ready = false;
    this.engine = null;
    this.scene = null;
    this.canvas = null;
    this.camera = null;
    this.catMeshes = new Map();
    this.foodMeshes = new Map();
    this.vacuumMeshes = new Map();
    this.decoyMeshes = new Map();
    this.fireflyMeshes = new Map();
    this.catMaterials = new Map();
    this.raceSensorMeshes = new Map();
    this.beaconMeshes = new Map();
    this.catVisual = null;
    this.catModelFailed = false;
  }

  async initialize() {
    if (!window.BABYLON) await this.loadBabylon();
    if (!window.BABYLON) throw new Error('Babylon.js n’a pas été chargé.');

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'city3dCanvas';
    this.canvas.setAttribute('aria-label', 'Vue 3D du Jardin des Lucioles');
    document.body.appendChild(this.canvas);
    this.engine = new BABYLON.Engine(this.canvas, true, {
      antialias: true,
      stencil: true,
      preserveDrawingBuffer: false,
      adaptToDeviceRatio: true,
    });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio > 1.5 ? 1.25 : 1));
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.035, 0.055, 0.11, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00009;
    this.scene.fogColor = new BABYLON.Color3(0.035, 0.055, 0.11);
    this.createMaterials();
    this.createCamera();
    this.createLighting();
    this.createCityMeshes();
    this.glowLayer = new BABYLON.GlowLayer('gardenGlow', this.scene);
    this.glowLayer.intensity = 0.55;
    this.catVisual = new CatModelVisual(this.scene, this.shadows);
    this.ready = true;

    const fallbackCanvas = document.querySelector('body > canvas:not(#minimap-canvas):not(#city3dCanvas)');
    if (fallbackCanvas) fallbackCanvas.style.display = 'none';
    this.resize();
    this.scene.render();
    this.catVisual.load().then(loaded => {
      if (!loaded || !this.ready) return;
      // L'import est asynchrone : remplacer uniquement les vues des chats.
      for (const node of this.catMeshes.values()) node.dispose(false, false);
      this.catMeshes.clear();
    }).catch(error => {
      console.warn('Le modèle 3D du chat est indisponible ; le chat précédent reste actif.', error);
    });
  }

  loadBabylon() {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-miaouville-babylon]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Échec du chargement de Babylon.js.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'libraries/babylon.js';
      script.async = true;
      script.dataset.miaouvilleBabylon = 'true';
      script.onload = resolve;
      script.onerror = () => {
        script.src = 'https://cdn.babylonjs.com/babylon.js';
        script.onerror = () => reject(new Error('Babylon.js est inaccessible ; le rendu 2D prendra le relais.'));
      };
      document.head.appendChild(script);
    });
  }

  material(name, color, options = {}) {
    const material = new BABYLON.StandardMaterial(name, this.scene);
    material.diffuseColor = BABYLON.Color3.FromHexString(color);
    material.specularColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    material.specularPower = options.specularPower || 40;
    if (options.emissive) material.emissiveColor = BABYLON.Color3.FromHexString(options.emissive);
    if (options.alpha !== undefined) {
      material.alpha = options.alpha;
      material.disableDepthWrite = true;
    }
    return material;
  }

  createMaterials() {
    this.materials = {
      grass: this.material('grass', '#172f36'),
      park: this.material('park', '#244b3d'),
      road: this.material('gardenPath', '#26364a'),
      roadEdge: this.material('pathEdge', '#688e82', { emissive: '#102f38' }),
      sidewalk: this.material('gardenBed', '#315545'),
      roadLine: this.material('moonlitPath', '#8cebd2', { emissive: '#347e71' }),
      trackKerbRed: this.material('trackKerbRed', '#c889ff', { emissive: '#492873' }),
      trackKerbCream: this.material('trackKerbCream', '#d9f2cd', { emissive: '#456b52' }),
      trim: this.material('gardenWood', '#544c59'),
      glass: this.material('gardenGlass', '#8df4de', { emissive: '#287a72' }),
      lantern: this.material('lantern', '#f7e77c', { emissive: '#b77c32' }),
      trunk: this.material('treeTrunk', '#55404a'),
      leaves: [
        this.material('leafA', '#285a4d'), this.material('leafB', '#37765a'),
        this.material('leafC', '#568a65'),
      ],
      food: this.material('kibble', '#f7d778', { emissive: '#82642a' }),
      pate: this.material('pate', '#e2a477'),
      vacuum: this.material('nightMothBody', '#51486f', { specularPower: 80 }),
      vacuumLight: this.material('nightMothGlow', '#f7e77c', { emissive: '#8a6d32' }),
      mothWing: this.material('nightMothWings', '#9ec7e6', { alpha: 0.72 }),
      decoy: this.material('decoy', '#d94d3f', { specularPower: 65 }),
      leafAccent: this.material('leafAccent', '#6e9b57'),
      white: this.material('catEyes', '#f8f2df'),
      pupil: this.material('catPupils', '#283a32'),
      nose: this.material('catNose', '#df918e'),
    };
    this.materials.buildings = ['#ad604f', '#637e79', '#bf8a4d', '#587386', '#925e68', '#ae7959']
      .map((color, index) => this.material(`building${index}`, color));
  }

  createCamera() {
    const target = new BABYLON.Vector3(this.world.width / 2, 0, this.world.height / 2);
    // Caméra de poursuite : l'angle est recalculé derrière le cap du chat.
    this.camera = new BABYLON.ArcRotateCamera('miaouvilleCamera', -Math.PI / 2, 0.98, 620, target, this.scene);
    this.camera.fov = 0.78;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 6000;
    this.camera.lowerBetaLimit = 0.78;
    this.camera.upperBetaLimit = 1.2;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;
  }

  createLighting() {
    const ambient = new BABYLON.HemisphericLight('moonlight', new BABYLON.Vector3(0.2, 1, -0.25), this.scene);
    ambient.intensity = 0.88;
    ambient.diffuse = new BABYLON.Color3(0.58, 0.72, 1);
    ambient.groundColor = new BABYLON.Color3(0.08, 0.15, 0.19);
    const moon = new BABYLON.DirectionalLight('moon', new BABYLON.Vector3(-0.45, -1, 0.32), this.scene);
    moon.position = new BABYLON.Vector3(this.world.width * 0.55, 900, -500);
    moon.intensity = 0.55;
    const shadows = new BABYLON.ShadowGenerator(1024, moon);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 20;
    this.shadows = shadows;
  }

  ground(name, x, z, width, depth, material, y = 0) {
    const mesh = BABYLON.MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 1 }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.receiveShadows = true;
    return mesh;
  }

  box(name, x, y, z, width, height, depth, material, parent = null) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  createCityMeshes() {
    this.ground('cityGarden', this.world.width / 2, this.world.height / 2,
      this.world.width + 140, this.world.height + 140, this.materials.grass, -2.4);
    for (let column = 1; column < Math.ceil(this.world.width / this.world.cell); column++) {
      const x = column * this.world.cell;
      this.ground(`avenueV${column}`, x, this.world.height / 2, this.world.roadWidth,
        this.world.height + 100, this.materials.road, -0.8);
      for (let row = 0; row < Math.ceil(this.world.height / this.world.cell); row++) {
        this.box(`laneV${column}-${row}`, x, -0.25, row * this.world.cell + this.world.cell / 2,
          1.5, 0.15, this.world.cell - 38, this.materials.roadLine);
      }
    }
    for (let row = 1; row < Math.ceil(this.world.height / this.world.cell); row++) {
      const z = row * this.world.cell;
      this.ground(`avenueH${row}`, this.world.width / 2, z, this.world.width + 100,
        this.world.roadWidth, this.materials.road, -0.75);
      for (let column = 0; column < Math.ceil(this.world.width / this.world.cell); column++) {
        this.box(`laneH${row}-${column}`, column * this.world.cell + this.world.cell / 2, -0.2, z,
          this.world.cell - 38, 0.15, 1.5, this.materials.roadLine);
      }
    }

    for (let column = 0; column < Math.ceil(this.world.width / this.world.cell); column++) {
      for (let row = 0; row < Math.ceil(this.world.height / this.world.cell); row++) {
        const x = column * this.world.cell + this.world.cell / 2;
        const z = row * this.world.cell + this.world.cell / 2;
        const park = this.world.racePark && x > this.world.racePark.x && x < this.world.racePark.x + this.world.racePark.w &&
          z > this.world.racePark.y && z < this.world.racePark.y + this.world.racePark.h;
        this.ground(`block${column}-${row}`, x, z, this.world.cell - this.world.roadWidth - 12,
          this.world.cell - this.world.roadWidth - 12, park ? this.materials.park : this.materials.sidewalk, -0.1);
      }
    }
    this.createBuildings();
    this.createTrees();
    this.createRaceTrack();
    this.createExtractionZone();
    this.createStreetFurniture();
  }

  createExtractionZone() {
    const zone = this.world.extractionZone;
    if (!zone) return;
    const base = BABYLON.MeshBuilder.CreateCylinder('rescueRefugeBase', {
      height: 2.4, diameter: zone.r * 2.25, tessellation: 32,
    }, this.scene);
    base.position.set(zone.pos.x, 0.1, zone.pos.y);
    base.material = this.material('rescueRefugeBaseMat', '#415b58', { emissive: '#142c2a' });
    const outer = BABYLON.MeshBuilder.CreateTorus('rescueRefugeOuter', {
      diameter: zone.r * 2, thickness: 3.2, tessellation: 32,
    }, this.scene);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(zone.pos.x, 1.8, zone.pos.y);
    outer.material = this.material('rescueRefugeOuterMat', '#56d7c0', { emissive: '#1d7e72' });
    const inner = BABYLON.MeshBuilder.CreateTorus('rescueRefugeInner', {
      diameter: zone.r * 1.35, thickness: 1.5, tessellation: 32,
    }, this.scene);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(zone.pos.x, 2.1, zone.pos.y);
    inner.material = this.material('rescueRefugeInnerMat', '#ecf7da', { emissive: '#607c5b' });
    this.refugeMeshes = { base, outer, inner };
  }

  createBuildings() {
    this.world.buildings.forEach((building, index) => {
      const height = 24 + (index % 4) * 4;
      const centerX = building.x + building.w / 2;
      const centerZ = building.y + building.h / 2;
      const base = this.box(`buildingBase${index}`, centerX, 1.8, centerZ,
        building.w + 14, 3.6, building.h + 14, this.materials.trim);
      this.shadows.addShadowCaster(base);
      const structure = this.box(`building${index}`, centerX, height / 2 + 3.5, centerZ,
        building.w, height, building.h, this.materials.buildings[index % this.materials.buildings.length]);
      structure.receiveShadows = true;
      this.shadows.addShadowCaster(structure);
      this.box(`roof${index}`, centerX, height + 4, centerZ, building.w - 12, 1.4,
        building.h - 12, this.materials.glass);
      if (building.roofStyle === 0) {
        for (const zOffset of [-building.h * 0.31, building.h * 0.31]) {
          this.box(`roofline${index}-${zOffset}`, centerX, height + 4.9, centerZ + zOffset,
            building.w - 24, 0.4, 3.2, this.materials.trim);
        }
      } else if (building.roofStyle === 1) {
        this.box(`roofhouse${index}`, centerX, height + 5, centerZ,
          building.w * 0.48, 1.5, building.h * 0.45, this.materials.buildings[(index + 2) % this.materials.buildings.length]);
      } else {
        this.box(`roofcrossA${index}`, centerX, height + 5, centerZ, 8, 1.2, building.h - 26, this.materials.glass);
        this.box(`roofcrossB${index}`, centerX, height + 5, centerZ, building.w - 26, 1.2, 8, this.materials.glass);
      }
    });
  }

  createTrees() {
    this.world.trees.forEach((tree, index) => {
      const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk${index}`, { height: 17, diameter: 8, tessellation: 8 }, this.scene);
      trunk.position.set(tree.x, 7.5, tree.y);
      trunk.material = this.materials.trunk;
      this.shadows.addShadowCaster(trunk);
      const crown = BABYLON.MeshBuilder.CreateSphere(`canopy${index}`, { diameter: tree.r * 2.1, segments: 10 }, this.scene);
      crown.position.set(tree.x, tree.r * 0.78 + 12, tree.y);
      crown.material = this.materials.leaves[index % this.materials.leaves.length];
      this.shadows.addShadowCaster(crown);
      const crownTop = BABYLON.MeshBuilder.CreateSphere(`canopyTop${index}`, { diameter: tree.r * 1.25, segments: 8 }, this.scene);
      crownTop.position.set(tree.x - tree.r * 0.28, tree.r * 1.25 + 14, tree.y - tree.r * 0.22);
      crownTop.material = this.materials.leaves[(index + 1) % this.materials.leaves.length];
      this.shadows.addShadowCaster(crownTop);
    });
  }

  createRaceTrack() {
    const points = this.world.raceTrack.points;
    const left = [];
    const right = [];
    points.forEach((point, index) => {
      const before = points[(index - 1 + points.length) % points.length];
      const after = points[(index + 1) % points.length];
      const dx = after.x - before.x;
      const dz = after.y - before.y;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length;
      const nz = dx / length;
      left.push(new BABYLON.Vector3(point.x + nx * (this.world.raceTrack.width / 2 + 8), 0.25,
        point.y + nz * (this.world.raceTrack.width / 2 + 8)));
      right.push(new BABYLON.Vector3(point.x - nx * (this.world.raceTrack.width / 2 + 8), 0.25,
        point.y - nz * (this.world.raceTrack.width / 2 + 8)));
    });
    const border = BABYLON.MeshBuilder.CreateRibbon('grandPrixBorder', {
      pathArray: [left, right], sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    }, this.scene);
    border.material = this.materials.roadEdge;
    const roadLeft = [];
    const roadRight = [];
    points.forEach((point, index) => {
      const before = points[(index - 1 + points.length) % points.length];
      const after = points[(index + 1) % points.length];
      const dx = after.x - before.x;
      const dz = after.y - before.y;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length;
      const nz = dx / length;
      roadLeft.push(new BABYLON.Vector3(point.x + nx * this.world.raceTrack.width / 2, 0.4,
        point.y + nz * this.world.raceTrack.width / 2));
      roadRight.push(new BABYLON.Vector3(point.x - nx * this.world.raceTrack.width / 2, 0.4,
        point.y - nz * this.world.raceTrack.width / 2));
    });
    const road = BABYLON.MeshBuilder.CreateRibbon('grandPrixAsphalt', {
      pathArray: [roadLeft, roadRight], sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    }, this.scene);
    road.material = this.materials.road;
    for (let index = 0; index < points.length; index += 4) {
      const point = points[index];
      const before = points[(index - 1 + points.length) % points.length];
      const after = points[(index + 1) % points.length];
      const dx = after.x - before.x;
      const dz = after.y - before.y;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length;
      const nz = dx / length;
      const stripeMaterial = (Math.floor(index / 4) % 2) ? this.materials.trackKerbCream : this.materials.trackKerbRed;
      for (const side of [-1, 1]) {
        const kerb = this.box(`grandPrixKerb${index}-${side}`,
          point.x + nx * side * (this.world.raceTrack.width / 2 - 2), 0.9,
          point.y + nz * side * (this.world.raceTrack.width / 2 - 2), 10, 1.1, 8, stripeMaterial);
        kerb.rotation.y = -Math.atan2(dz, dx);
      }
    }
    const centerline = BABYLON.MeshBuilder.CreateTube('grandPrixCenterline', {
      path: points.map(point => new BABYLON.Vector3(point.x, 0.75, point.y)).concat(
        new BABYLON.Vector3(points[0].x, 0.75, points[0].y)),
      radius: 0.7, tessellation: 5,
    }, this.scene);
    centerline.material = this.materials.roadLine;
    this.box('startLine', points[0].x, 0.7, points[0].y, 3, 0.7, this.world.raceTrack.width,
      this.materials.roadLine).rotation.y = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  }

  createStreetFurniture() {
    let lanternIndex = 0;
    for (let column = 0; column < this.world.width / this.world.cell; column++) {
      for (let row = 0; row < this.world.height / this.world.cell; row++) {
        if ((column + row) % 2) continue;
        const x = column * this.world.cell + this.world.cell * 0.78;
        const z = row * this.world.cell + this.world.cell * 0.22;
        const lamp = BABYLON.MeshBuilder.CreateCylinder(`lampPost${column}-${row}`, {
          height: 27, diameter: 2.4, tessellation: 6,
        }, this.scene);
        lamp.position.set(x, 13.5, z);
        lamp.material = this.materials.trim;
        const bulb = BABYLON.MeshBuilder.CreateSphere(`lanternGlow${column}-${row}`, { diameter: 7, segments: 6 }, this.scene);
        bulb.position.set(x, 27, z);
        bulb.material = this.materials.lantern;
        if (lanternIndex++ % 3 === 0) {
          const light = new BABYLON.PointLight(`gardenLantern${column}-${row}`, new BABYLON.Vector3(x, 30, z), this.scene);
          light.diffuse = new BABYLON.Color3(1, 0.72, 0.38);
          light.intensity = 0.35;
          light.range = 210;
        }
      }
    }
  }

  createCatMesh(cat) {
    if (this.catVisual?.template && !this.catModelFailed) {
      try {
        return this.catVisual.create(cat);
      } catch (error) {
        this.catModelFailed = true;
        console.warn('Le modèle 3D ne peut pas être cloné ; retour au chat précédent.', error);
      }
    }
    const root = new BABYLON.TransformNode(`cat${cat.name || 'friend'}`, this.scene);
    const color = cat.color && /^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : '#c7774e';
    if (!this.catMaterials.has(color)) {
      const fur = this.material(`fur${this.catMaterials.size}`, color, { specularPower: 55 });
      fur.emissiveColor = BABYLON.Color3.FromHexString(color).scale(0.16);
      this.catMaterials.set(color, fur);
    }
    const fur = this.catMaterials.get(color);
    const body = BABYLON.MeshBuilder.CreateSphere(`catBody${cat.name}`, { diameter: 1, segments: 12 }, this.scene);
    body.scaling.set(16, 7.3, 9.4);
    body.position.set(-2, 7.2, 0);
    body.material = fur;
    body.parent = root;
    const head = BABYLON.MeshBuilder.CreateSphere(`catHead${cat.name}`, { diameter: 1, segments: 12 }, this.scene);
    head.scaling.set(10, 9, 9.2);
    head.position.set(9.5, 10.2, 0);
    head.material = fur;
    head.parent = root;
    for (const side of [-1, 1]) {
      const ear = BABYLON.MeshBuilder.CreateCylinder(`catEar${cat.name}${side}`, {
        height: 10, diameterTop: 0.2, diameterBottom: 6, tessellation: 5,
      }, this.scene);
      ear.position.set(7 + (side < 0 ? -3.5 : 3.5), 18, side * 5);
      ear.rotation.z = -0.23;
      ear.material = fur;
      ear.parent = root;
      const eye = BABYLON.MeshBuilder.CreateSphere(`catEye${cat.name}${side}`, { diameter: 2.4, segments: 6 }, this.scene);
      eye.position.set(16.8, 10.5, side * 3.2);
      eye.material = this.materials.white;
      eye.parent = root;
      const pupil = BABYLON.MeshBuilder.CreateSphere(`catPupil${cat.name}${side}`, { diameter: 1.1, segments: 5 }, this.scene);
      pupil.position.set(17.7, 10.5, side * 3.2);
      pupil.material = this.materials.pupil;
      pupil.parent = root;
    }
    const nose = BABYLON.MeshBuilder.CreateSphere(`catNose${cat.name}`, { diameter: 2.4, segments: 6 }, this.scene);
    nose.position.set(20, 7.5, 0);
    nose.material = this.materials.nose;
    nose.parent = root;
    const tail = BABYLON.MeshBuilder.CreateTube(`catTail${cat.name}`, {
      path: [new BABYLON.Vector3(-14, 7, 0), new BABYLON.Vector3(-22, 10, 0),
        new BABYLON.Vector3(-25, 17, 0), new BABYLON.Vector3(-20, 21, 0)],
      radius: 2.1, tessellation: 5,
    }, this.scene);
    tail.material = fur;
    tail.parent = root;
    const shadow = BABYLON.MeshBuilder.CreateDisc(`catShadow${cat.name}`, { radius: 15, tessellation: 12 }, this.scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.65;
    shadow.material = this.material('catShadowMat', '#34443a', { alpha: 0.22 });
    shadow.parent = root;
    this.shadows.addShadowCaster(body);
    this.shadows.addShadowCaster(head);
    return root;
  }

  createSimpleMesh(kind, item) {
    const root = new BABYLON.TransformNode(`${kind}${item.name || item.id || ''}`, this.scene);
    if (kind === 'firefly') {
      const color = item.color || '#f7e77c';
      const glow = this.material(`fireflyGlow${item.id}`, color, { emissive: color, alpha: 0.22 });
      const halo = BABYLON.MeshBuilder.CreateSphere('fireflyHalo', { diameter: 18, segments: 8 }, this.scene);
      halo.material = glow;
      halo.parent = root;
      const light = BABYLON.MeshBuilder.CreateSphere('fireflyLight', { diameter: 5, segments: 8 }, this.scene);
      light.material = this.material(`fireflyCore${item.id}`, color, { emissive: color });
      light.parent = root;
    } else if (kind === 'food') {
      const material = item.kind === 'pate' ? this.materials.pate : this.materials.food;
      const piece = BABYLON.MeshBuilder.CreateSphere('foodPiece', { diameter: 9, segments: 8 }, this.scene);
      piece.scaling.y = 0.48;
      piece.position.y = 4;
      piece.material = material;
      piece.parent = root;
      const sparkle = BABYLON.MeshBuilder.CreateSphere('foodSparkle', { diameter: 2.3, segments: 5 }, this.scene);
      sparkle.position.set(-1, 7, -1);
      sparkle.material = this.materials.white;
      sparkle.parent = root;
    } else if (kind === 'beacon') {
      const ring = BABYLON.MeshBuilder.CreateTorus('missionRing', { diameter: 55, thickness: 2.5, tessellation: 32 }, this.scene);
      ring.position.y = 2;
      ring.material = this.materials.food;
      ring.parent = root;
      const pointer = BABYLON.MeshBuilder.CreateCylinder('missionPointer', {
        height: 15, diameterTop: 10, diameterBottom: 0, tessellation: 4,
      }, this.scene);
      pointer.position.y = 65;
      pointer.material = this.materials.food;
      pointer.parent = root;
    } else if (kind === 'vacuum') {
      for (const side of [-1, 1]) {
        const wing = BABYLON.MeshBuilder.CreateSphere('nightMothWing', { diameter: 17, segments: 8 }, this.scene);
        wing.scaling.set(0.75, 0.28, 1.15);
        wing.position.set(0, 9, side * 8);
        wing.material = this.materials.mothWing;
        wing.parent = root;
      }
      const body = BABYLON.MeshBuilder.CreateSphere('nightMothBody', { diameter: 10, segments: 8 }, this.scene);
      body.scaling.set(0.55, 0.7, 1.25);
      body.position.y = 9;
      body.material = this.materials.vacuum;
      body.parent = root;
      const glow = BABYLON.MeshBuilder.CreateSphere('nightMothGlow', { diameter: 5, segments: 8 }, this.scene);
      glow.position.y = 13;
      glow.material = this.materials.vacuumLight;
      glow.parent = root;
      this.shadows.addShadowCaster(body);
    } else {
      const tomato = BABYLON.MeshBuilder.CreateSphere('decoyTomato', { diameter: 14, segments: 10 }, this.scene);
      tomato.scaling.y = 0.75;
      tomato.position.y = 7;
      tomato.material = this.materials.decoy;
      tomato.parent = root;
      const leaf = BABYLON.MeshBuilder.CreateCylinder('decoyLeaf', { height: 3, diameterTop: 0, diameterBottom: 8, tessellation: 5 }, this.scene);
      leaf.position.y = 14;
      leaf.material = this.materials.leafAccent;
      leaf.parent = root;
    }
    return root;
  }

  syncMap(items, map, kind, frame, player = null, gameState = '') {
    const active = new Set(items);
    for (const [item, node] of map) if (!active.has(item)) {
      node.dispose();
      map.delete(item);
    }
    for (const item of items) {
      let node = map.get(item);
      if (!node) {
        node = kind === 'cat' ? this.createCatMesh(item) : this.createSimpleMesh(kind, item);
        map.set(item, node);
      }
      const position = item.pos;
      node.position.x = position.x;
      node.position.z = position.y;
      if (kind === 'cat') {
        const heading = Number.isFinite(item.socialHeading) && item.chatPause > 0 ? item.socialHeading
          : item === player && gameState === 'running'
          ? item.facingHeading
          : item.vel?.magSq?.() > 0.035 ? item.vel.heading() : item.raceHeading || 0;
        if (node.metadata?.animatedCat) {
          this.catVisual.pose(node, item, frame, heading);
        } else if (node.metadata?.miaouvilleCatModel) {
          const pose = catModelPose(heading, item.vel?.mag?.() || 0, frame, item.idlePhase || 0);
          node.position.y = pose.height;
          node.rotation.y = pose.yaw;
          node.rotation.z = pose.roll;
        } else {
          node.position.y = 1.1 + Math.sin(frame * 0.14 + (item.idlePhase || 0)) * (item.vel?.magSq?.() > 0.035 ? 1.2 : 0.35);
          node.rotation.y = -heading;
        }
      } else if (kind === 'firefly') {
        const pulse = 1 + Math.sin(frame * 0.12 + item.phase) * 0.16;
        node.position.y = 20 + Math.sin(frame * 0.08 + item.phase) * 4;
        node.scaling.set(pulse, pulse, pulse);
      } else if (kind === 'vacuum') {
        node.position.y = 0.5;
        node.rotation.y = item.spin || 0;
      } else {
        node.position.y = 0.15 + Math.sin(frame * 0.09 + (item.phase || 0)) * 2;
      }
    }
  }

  syncRaceSensors(racers, enabled) {
    if (!enabled) {
      for (const lines of this.raceSensorMeshes.values()) {
        for (const line of lines) line.dispose();
      }
      this.raceSensorMeshes.clear();
      return;
    }

    const activeRacers = new Set(racers);
    for (const [cat, lines] of this.raceSensorMeshes) {
      if (activeRacers.has(cat)) continue;
      for (const line of lines) line.dispose();
      this.raceSensorMeshes.delete(cat);
    }

    for (const cat of racers) {
      const sensors = cat.raceSensorReadings || [];
      let lines = this.raceSensorMeshes.get(cat);
      if (!lines) {
        lines = [];
        this.raceSensorMeshes.set(cat, lines);
      }
      for (let index = 0; index < sensors.length; index++) {
        const sensor = sensors[index];
        const points = [
          new BABYLON.Vector3(cat.pos.x, 3, cat.pos.y),
          new BABYLON.Vector3(sensor.end.x, 3, sensor.end.y),
        ];
        const color = BABYLON.Color3.FromHexString(sensor.distance < 35 ? '#ef6a54' : '#ffe184');
        let line = lines[index];
        if (line) {
          BABYLON.MeshBuilder.CreateLines(`raceSensor${index}`, { points, instance: line });
        } else {
          line = BABYLON.MeshBuilder.CreateLines(`raceSensor${index}`, {
            points,
            updatable: true,
          }, this.scene);
          line.isPickable = false;
          lines[index] = line;
        }
        line.color = color;
        line.alpha = 0.95;
      }
      while (lines.length > sensors.length) lines.pop().dispose();
    }
  }

  render(state) {
    if (!this.ready) return;
    const racing = state.gameState === 'race' || state.gameState === 'raceCountdown';
    const player = racing && state.watchedRacer ? state.watchedRacer : state.playerCat;
    const velocity = player?.vel;
    const heading = state.gameState === 'running' && Number.isFinite(player?.facingHeading)
      ? player.facingHeading
      : velocity?.magSq?.() > 0.035 ? velocity.heading() : player?.raceHeading ?? 0;
    const targetAlpha = chaseCameraAlpha(heading);
    const alphaDelta = Math.atan2(Math.sin(targetAlpha - this.camera.alpha), Math.cos(targetAlpha - this.camera.alpha));
    this.camera.alpha += alphaDelta * 0.12;
    if (this.refugeMeshes) {
      const pulse = 1 + Math.sin(state.frame * 0.055) * 0.035;
      this.refugeMeshes.outer.scaling.set(pulse, pulse, pulse);
      this.refugeMeshes.inner.scaling.set(2 - pulse, 2 - pulse, 2 - pulse);
    }
    const profile = getChaseCameraProfile(racing);
    this.camera.radius += (profile.radius - this.camera.radius) * 0.08;
    this.camera.beta += (profile.beta - this.camera.beta) * 0.08;
    const lookAhead = profile.lookAhead;
    const targetPosition = player?.pos || state.cameraPosition;
    this.camera.setTarget(new BABYLON.Vector3(
      targetPosition.x + Math.cos(heading) * lookAhead,
      0,
      targetPosition.y + Math.sin(heading) * lookAhead
    ));
    this.syncMap(state.playerCat ? [...new Set([state.playerCat, ...state.followers, ...state.strayCats, ...state.raceParticipants, ...(state.extraCats || [])])] : [], this.catMeshes, 'cat', state.frame, state.playerCat, state.gameState);
    this.syncMap(state.beacons || [], this.beaconMeshes, 'beacon', state.frame);
    this.syncMap(state.foodItems.filter(item => !item.collected), this.foodMeshes, 'food', state.frame);
    this.syncMap(state.fireflies || [], this.fireflyMeshes, 'firefly', state.frame);
    this.syncMap(state.vacuumPatrollers, this.vacuumMeshes, 'vacuum', state.frame);
    this.syncMap(state.activeDecoys, this.decoyMeshes, 'decoy', state.frame);
    this.syncRaceSensors(state.raceParticipants, state.raceDebugEnabled);
    this.scene.render();
  }

  resize() {
    this.engine?.resize();
  }

  dispose() {
    this.ready = false;
    this.catVisual?.dispose();
    this.catVisual = null;
    this.scene?.dispose();
    this.engine?.dispose();
    this.canvas?.remove();
    this.scene = null;
    this.engine = null;
    this.canvas = null;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BabylonCityRenderer, chaseCameraAlpha, getChaseCameraProfile };
