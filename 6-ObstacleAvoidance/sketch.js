const CITY_CELL = 600;
const CITY_COLUMNS = 6;
const CITY_ROWS = 5;
const CITY_ROAD_WIDTH = 112;
const CITY_WIDTH = CITY_CELL * CITY_COLUMNS;
const CITY_HEIGHT = CITY_CELL * CITY_ROWS;
const RACE_LEVELS = 5;
const RACE_LAPS = 1;
const RACE_COUNTDOWN = 3;
const RACE_TIMEOUT = 55;
const RACE_REWARDS = [120, 65, 35];
const FOOD_CAPACITY = 3;
const FOOD_PICKUP_RADIUS = 42;
const VACUUM_ALERT_RADIUS = 190;
const PROGRESS_STORAGE_KEY = 'miaouville-save-v1';
const CAT_COLORS = ['#ffbc78', '#fff2d6', '#d5e5f0', '#f3d39e', '#e6c6ae', '#faf8ee'];
const DISTRICT_NAMES = [
  ['Le Pré des Songes', 'Les Fleurs de Lune', 'La Clairière Bleue', 'Le Jardin Secret', 'Le Bosquet Doré', 'La Mare aux Étoiles'],
  ['Le Sentier des Fées', 'La Roseraie', 'Le Passage des Brumes', 'Le Jardin Secret', 'Le Verger Mauve', 'La Promenade'],
  ['La Cour des Mûriers', 'Le Jardin du Moulin', 'Les Arcades Fleuries', 'La Place du Soleil', 'Les Cerisiers', 'Le Vieux Puits'],
  ['Le Clos des Chats', 'La Rue des Potiers', 'Les Terrasses', 'Le Parc aux Papillons', 'La Place Neuve', 'Les Jardins du Sud'],
  ['Le Bout du Jardin', 'Les Herbes Folles', 'La Rue du Saule', 'Le Petit Square', 'Les Vergers', 'La Colline'],
];

let playerCat;
let strayCats = [];
let followers = [];
let buildings = [];
let trees = [];
let cityObstacles = [];
let fireflies = [];
let raceTrack;
let racePark;
let extractionZone;
let raceParticipants = [];
let foodItems = [];
let vacuumPatrollers = [];
let carriedFood = 0;
let fedCatNames = new Set();
let playerStunTimer = 0;
let raceCountdown = 0;
let raceElapsed = 0;
let raceLevel = 1;
let raceWins = 0;
let raceDifficulty = 'normal';
let raceTimeLimit = RACE_TIMEOUT;
let raceDebugEnabled = false;
let lastRacePromotions = 0;
let coins = 0;
let rescueMissionLevel = 1;
let rescueMissionsCompleted = 0;
let extractionHintCooldown = 0;
let raceNumber = 0;
let savedRaceBrains = {};
let savedRaceLearning = {};
let raceTriggerEnabled = true;
let resumeGameState = 'running';
let cameraPosition;
let gameState = 'menu';
let nearestStray = null;
let hud;
const keysDown = new Set();

// Nouveaux modules de jeu & effets
let audioFeedback;
let city3DRenderer = null;
let activeDecoys = [];
let decoyCooldown = 0;
let playerStamina = 100;
let comboCount = 0;
let comboTimer = 0;
let pigeonFlocks = [];
let cityTram = null;
let visualSparks = [];
let visualHearts = [];
let meowBubbleTimer = 0;
let meowTargetCat = null;
let conversations;
let gardenMissions;
let personalTraining = null;
let personalTrainingQueue = [];
let watchedRacer = null;
let savedCatTraits = {};
let notebookTick = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  audioFeedback = typeof AudioFeedback === 'function' ? new AudioFeedback() : null;
  conversations = new CatConversation();
  gardenMissions = new GardenMissions();
  playerCat = new Cat(CITY_WIDTH / 2, CITY_HEIGHT / 2);
  playerCat.isLeader = true;
  playerCat.name = 'Zouin';
  playerCat.maxSpeed = 4.2;
  playerCat.maxForce = 0.22;
  playerCat.color = '#ffbc78';
  playerCat.facingHeading = -HALF_PI;
  cameraPosition = createVector(playerCat.pos.x, playerCat.pos.y);
  createCity();
  fireflies = createGardenFireflies(CITY_WIDTH, CITY_HEIGHT, racePark);
  createStreetCats();
  try {
    city3DRenderer = new BabylonCityRenderer({
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      cell: CITY_CELL,
      roadWidth: CITY_ROAD_WIDTH,
      buildings,
      trees,
      racePark,
      raceTrack,
      extractionZone,
      cats: () => [playerCat, ...followers, ...strayCats, ...raceParticipants],
    });
    city3DRenderer.initialize().catch(error => {
      console.warn('Babylon.js n’a pas pu démarrer ; le rendu 2D reste actif.', error);
      city3DRenderer?.dispose();
      city3DRenderer = null;
    });
  } catch (error) {
    console.warn('Le rendu 3D est indisponible ; Miaouville conserve son rendu classique.', error);
    city3DRenderer = null;
  }
  loadProgress();
  restoreFedCats();
  restoreSavedRaceBrains();
  // Les éléments de décor animés sont facultatifs : certaines versions du
  // projet ne contiennent pas encore leurs constructeurs/mises à jour.
  pigeonFlocks = typeof createPigeonFlocks === 'function' ? createPigeonFlocks() : [];
  cityTram = typeof createCityTram === 'function' ? createCityTram() : null;

  hud = {
    root: document.getElementById('game-hud'),
    companions: document.getElementById('companion-count'),
    district: document.getElementById('district-name'),
    food: document.getElementById('food-count'),
    coins: document.getElementById('coin-count'),
    difficulty: document.getElementById('difficulty-level'),
    missionTitle: document.getElementById('mission-title'),
    missionProgress: document.getElementById('mission-progress'),
    hint: document.getElementById('interaction-hint'),
    raceStatus: document.getElementById('race-status'),
    raceDifficulty: document.getElementById('race-difficulty-select'),
    overlay: document.getElementById('screen-overlay'),
    title: document.getElementById('overlay-title'),
    text: document.getElementById('overlay-text'),
    action: document.getElementById('overlay-action'),
    results: document.getElementById('race-results'),
    help: document.querySelector('.menu-help'),
    pause: document.getElementById('pause-button'),
    toast: document.getElementById('game-toast'),
    // Nouveaux éléments UI arcade
    decoyBadge: document.getElementById('decoy-count'),
    comboBanner: document.getElementById('combo-banner'),
    staminaContainer: document.getElementById('stamina-container'),
    staminaBar: document.getElementById('stamina-bar'),
    raceArcadeHud: document.getElementById('race-arcade-hud'),
    arcadeRank: document.getElementById('arcade-rank'),
    arcadeSpeed: document.getElementById('arcade-speed'),
    raceBrainStatus: document.getElementById('race-brain-status'),
    raceDebugPanel: document.getElementById('race-debug-panel'),
    raceDebugInputs: document.getElementById('race-debug-inputs'),
    raceDebugOutputs: document.getElementById('race-debug-outputs'),
    raceDebugMode: document.getElementById('race-debug-mode'),
    arcadeCountdown: document.getElementById('arcade-countdown'),
    arcadeWrongWay: document.getElementById('arcade-wrong-way'),
    minimapCanvas: document.getElementById('minimap-canvas'),
    minimapPanel: document.getElementById('minimap-panel'),
    controlsHint: document.querySelector('.controls-hint'),
  };

  hud.action.addEventListener('click', () => {
    try { audioFeedback?.unlock(); } catch (error) { console.warn('Audio indisponible :', error); }
    try {
      if (gameState === 'paused') resumeGame();
      else if (gameState === 'results') closeRaceResults();
      else if (gameState === 'missionComplete') startGame();
      else startGame();
    } catch (error) {
      console.error('Impossible de démarrer Miaouville :', error);
      hud.overlay.hidden = false;
      hud.text.textContent = `Le démarrage a échoué : ${error.message}`;
      hud.action.textContent = 'Réessayer';
    }
  });
  hud.pause.addEventListener('click', togglePause);
  if (hud.raceDifficulty) {
    hud.raceDifficulty.value = raceDifficulty;
    hud.raceDifficulty.addEventListener('change', () => {
      if (gameState === 'running' || gameState === 'menu' || gameState === 'results') {
        raceDifficulty = hud.raceDifficulty.value;
        saveProgress();
        updateInterface();
      }
    });
  }
  document.addEventListener('keydown', trackMovementKeyDown);
  document.addEventListener('keyup', trackMovementKeyUp);
  window.addEventListener('blur', () => keysDown.clear());
  document.querySelectorAll('[data-garden-mission]').forEach(button => {
    button.addEventListener('click', () => startGardenMission(button.dataset.gardenMission));
  });
  document.getElementById('cancel-garden-mission').addEventListener('click', () => {
    gardenMissions.cancel(gardenWorld());
    updateNotebook();
  });
  document.getElementById('train-personal-brain').addEventListener('click', () => {
    const key = document.getElementById('training-cat').value;
    const cat = [playerCat, ...followers, ...strayCats].find(item => raceBrainKey(item, playerCat) === key);
    if (cat && gameState === 'running' && !personalTraining) queuePersonalTraining([cat], false);
  });
  document.getElementById('cancel-personal-training').addEventListener('click', cancelPersonalTraining);
  document.getElementById('training-cat').addEventListener('change', updateNotebook);
}

function draw() {
  const dt = Math.min(deltaTime / 16.667, 2);
  audioFeedback?.setAmbienceEnabled?.(gameState === 'running');
  if (gameState === 'running') {
    conversations?.update(Math.max(0, dt) / 60);
    for (const firefly of fireflies) firefly.update(fireflies, cityObstacles, dt, playerCat);
    updatePlayer(dt);
    updateStreetCats(dt);
    updateFollowers(dt);
    updateGardenMission(dt);
    updateExtractionZone(dt);
    updateFoodPickups();
    updateVacuumPatrollers(dt);
    updateDecoys(dt);
    if (typeof updatePigeons === 'function') updatePigeons(dt);
    if (typeof updateCityTram === 'function') updateCityTram(dt);
    updateComboAndParticles(dt);
  } else if (gameState === 'raceCountdown' || gameState === 'race') {
    updateRace(dt);
  }
  if (['running', 'results'].includes(gameState)) processPersonalTraining();
  updateCamera(dt);
  renderCity();
  updateInterface();
  updateRaceDebugHud();
  renderMinimap();
  if (++notebookTick % 15 === 0) updateNotebook();
}

function createCity() {
  buildings = [];
  trees = [];
  cityObstacles = [];
  racePark = null;

  for (let row = 0; row < CITY_ROWS; row++) {
    for (let column = 0; column < CITY_COLUMNS; column++) {
      const block = {
        x: column * CITY_CELL + CITY_ROAD_WIDTH / 2 + 12,
        y: row * CITY_CELL + CITY_ROAD_WIDTH / 2 + 12,
        w: CITY_CELL - CITY_ROAD_WIDTH - 24,
        h: CITY_CELL - CITY_ROAD_WIDTH - 24,
      };
      if (column === 1 && row === 1) {
        racePark = { x: block.x - 44, y: block.y - 44, w: block.w + 88, h: block.h + 88 };
      } else {
        createPark(block, column, row);
      }
    }
  }
  raceTrack = createRaceTrack();
  extractionZone = new ExtractionZone(CITY_CELL * 3, CITY_CELL * 4, 58);
}

function createRaceTrack() {
  const preset = [
    [0.14, 0.30], [0.20, 0.19], [0.34, 0.16], [0.48, 0.20], [0.57, 0.29],
    [0.73, 0.23], [0.86, 0.27], [0.88, 0.39], [0.77, 0.44], [0.72, 0.54],
    [0.84, 0.62], [0.78, 0.75], [0.62, 0.72], [0.53, 0.64], [0.41, 0.77],
    [0.25, 0.70], [0.20, 0.58], [0.29, 0.49], [0.17, 0.43], [0.12, 0.36],
  ];
  const samplesPerSegment = 5;
  const width = 88;
  const rawPoints = [];
  for (let index = 0; index < preset.length; index++) {
    const p0 = preset[(index - 1 + preset.length) % preset.length];
    const p1 = preset[index];
    const p2 = preset[(index + 1) % preset.length];
    const p3 = preset[(index + 2) % preset.length];
    for (let sample = 0; sample < samplesPerSegment; sample++) {
      const t = sample / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const interpolate = axis => 0.5 * (
        2 * p1[axis] + (-p0[axis] + p2[axis]) * t +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
      );
      rawPoints.push({ x: interpolate(0), y: interpolate(1) });
    }
  }

  const minX = Math.min(...rawPoints.map(point => point.x));
  const maxX = Math.max(...rawPoints.map(point => point.x));
  const minY = Math.min(...rawPoints.map(point => point.y));
  const maxY = Math.max(...rawPoints.map(point => point.y));
  const margin = width / 2 + 8;
  const points = rawPoints.map(point => createVector(
    racePark.x + margin + (point.x - minX) / (maxX - minX) * (racePark.w - margin * 2),
    racePark.y + margin + (point.y - minY) / (maxY - minY) * (racePark.h - margin * 2)
  ));
  const center = createVector(
    (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2,
    (Math.min(...points.map(point => point.y)) + Math.max(...points.map(point => point.y))) / 2
  );
  const checkpoints = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const tangent = p5.Vector.sub(next, previous).normalize();
    const normal = createVector(-tangent.y, tangent.x);
    return {
      a: createVector(point.x - normal.x * width / 2, point.y - normal.y * width / 2),
      b: createVector(point.x + normal.x * width / 2, point.y + normal.y * width / 2),
    };
  });
  const inside = checkpoints.map(checkpoint => checkpoint.a);
  const outside = checkpoints.map(checkpoint => checkpoint.b);
  const walls = points.map((_, index) => ({
    inside: [inside[index], inside[(index + 1) % points.length]],
    outside: [outside[index], outside[(index + 1) % points.length]],
  }));
  return {
    center,
    radiusX: Math.max(...points.map(point => point.x)) - center.x,
    radiusY: Math.max(...points.map(point => point.y)) - center.y,
    width,
    points,
    checkpoints,
    walls,
    sensorWalls: walls.flatMap(wall => [
      { a: wall.inside[0], b: wall.inside[1] },
      { a: wall.outside[0], b: wall.outside[1] },
    ]),
    start: points[0],
  };
}

function createBlockBuildings(block, column, row) {
  const colors = ['#c98768', '#8c9d94', '#d2b17a', '#8798a5', '#b78280', '#c6a58c'];
  const styles = (column + row * 2) % colors.length;
  const gap = 24;
  const halfWidth = (block.w - gap * 3) / 2;
  const firstHeight = block.h * (0.43 + ((column + row) % 2) * 0.08);
  const secondHeight = block.h * (0.38 + ((column + row + 1) % 2) * 0.08);
  addBuilding(block.x + gap, block.y + gap, halfWidth, firstHeight, colors[styles], (column + row) % 3);
  addBuilding(block.x + gap * 2 + halfWidth, block.y + gap, halfWidth, secondHeight, colors[(styles + 2) % colors.length], (column + row + 1) % 3);

  const lowerY = block.y + block.h - gap - block.h * 0.34;
  const lowerWidth = block.w * (0.46 + (column % 2) * 0.08);
  addBuilding(block.x + gap, lowerY, lowerWidth, block.h * 0.34, colors[(styles + 3) % colors.length], (row + 1) % 3);
}

function addBuilding(x, y, w, h, color, roofStyle) {
  const building = new GardenBed(x, y, w, h, color, roofStyle);
  buildings.push(building);
  cityObstacles.push({
    pos: createVector(x + w / 2, y + h / 2),
    r: Math.hypot(w, h) / 2 + 13,
  });
}

function createPark(block, column, row) {
  const park = { x: block.x, y: block.y, w: block.w, h: block.h };
  const count = 3;
  for (let index = 0; index < count; index++) {
    const x = park.x + 45 + ((index * 103 + column * 41) % Math.max(1, park.w - 90));
    const y = park.y + 42 + ((index * 79 + row * 37) % Math.max(1, park.h - 84));
    trees.push(new GardenTree(x, y, 17 + (index % 3) * 3, park));
    cityObstacles.push({ pos: createVector(x, y), r: 20 + (index % 3) * 3 });
  }
}

function createStreetCats() {
  const safeSpots = [
    [CITY_CELL, CITY_CELL * 0.42], [CITY_CELL * 2, CITY_CELL * 0.37],
    [CITY_CELL * 3, CITY_CELL * 1.57], [CITY_CELL * 4, CITY_CELL * 2.55],
    [CITY_CELL * 5, CITY_CELL * 3.55], [CITY_CELL * 0.52, CITY_CELL * 2],
    [CITY_CELL * 2.5, CITY_CELL], [CITY_CELL * 4.4, CITY_CELL * 4],
  ];
  strayCats = safeSpots.map(([x, y], index) => {
    const cat = new Cat(x, y);
    cat.name = ['Moka', 'Plume', 'Biscotte', 'Sésame', 'Nougat', 'Pistache', 'Mimi', 'Roux'][index];
    cat.color = CAT_COLORS[(index + 1) % CAT_COLORS.length];
    cat.maxSpeed = 1.55 + (index % 3) * 0.18;
    cat.maxForce = 0.13;
    cat.r_pourDessin = 12;
    cat.r = 28;
    cat.wanderTarget = findWanderTarget(cat.pos, 170);
    cat.wanderTimer = 50 + index * 13;
    cat.idlePhase = index * 1.9;
    cat.dna = GardenGenetics.valid(savedCatTraits[cat.name])
      ? { ...savedCatTraits[cat.name] } : GardenGenetics.create(() => random());
    return cat;
  });
}

function restoreFedCats() {
  for (const cat of strayCats) cat.isFed = fedCatNames.has(cat.name);
}

function createFoodItems() {
  const locations = [
    [CITY_CELL, CITY_CELL * 0.5], [CITY_CELL * 2, CITY_CELL * 1.5],
    [CITY_CELL * 3, CITY_CELL * 2], [CITY_CELL * 4, CITY_CELL * 2.5],
    [CITY_CELL * 5, CITY_CELL * 3], [CITY_CELL * 4, CITY_CELL * 4],
    [CITY_CELL * 2, CITY_CELL * 3], [CITY_CELL * 5, CITY_CELL * 4],
    [CITY_CELL * 3, CITY_CELL * 1.5], [CITY_CELL, CITY_CELL * 4],
  ];
  return locations.map(([x, y], index) => new GardenFood(x, y, index));
}

function createVacuumPatrollers() {
  const routes = [
    [[CITY_CELL, 28], [CITY_CELL, CITY_CELL], [CITY_CELL, CITY_CELL * 2],
      [CITY_CELL, CITY_CELL * 3], [CITY_CELL, CITY_CELL * 4],
      [CITY_CELL, CITY_HEIGHT - 28], [CITY_CELL, CITY_CELL * 4],
      [CITY_CELL, CITY_CELL * 3], [CITY_CELL, CITY_CELL * 2], [CITY_CELL, CITY_CELL]],
    [[28, CITY_CELL * 2], [CITY_CELL, CITY_CELL * 2], [CITY_CELL * 2, CITY_CELL * 2],
      [CITY_CELL * 3, CITY_CELL * 2], [CITY_CELL * 4, CITY_CELL * 2],
      [CITY_WIDTH - 28, CITY_CELL * 2], [CITY_CELL * 5, CITY_CELL * 2],
      [CITY_CELL * 4, CITY_CELL * 2], [CITY_CELL * 3, CITY_CELL * 2],
      [CITY_CELL * 2, CITY_CELL * 2], [CITY_CELL, CITY_CELL * 2]],
    [[CITY_CELL * 3, CITY_CELL * 3], [CITY_CELL * 4, CITY_CELL * 3],
      [CITY_CELL * 5, CITY_CELL * 3], [CITY_CELL * 5, CITY_CELL * 4],
      [CITY_CELL * 4, CITY_CELL * 4], [CITY_CELL * 3, CITY_CELL * 4]],
  ];
  return routes.map((route, index) => new ShadowMoth(route.map(([x, y]) => createVector(x, y)), index));
}

function loadProgress() {
  try {
    const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!stored) return;
    const progress = JSON.parse(stored);
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      throw new TypeError('La sauvegarde Miaouville doit être un objet.');
    }
    if (Number.isSafeInteger(progress.coins) && progress.coins >= 0) coins = progress.coins;
    if (Number.isInteger(progress.raceLevel) && progress.raceLevel >= 1 && progress.raceLevel <= RACE_LEVELS) {
      raceLevel = progress.raceLevel;
    }
    if (['easy', 'normal', 'hard'].includes(progress.raceDifficulty)) raceDifficulty = progress.raceDifficulty;
    if (Number.isSafeInteger(progress.raceWins) && progress.raceWins >= 0) raceWins = progress.raceWins;
    if (Number.isInteger(progress.rescueMissionLevel) && progress.rescueMissionLevel >= 1 && progress.rescueMissionLevel <= 3) {
      rescueMissionLevel = progress.rescueMissionLevel;
    }
    if (Number.isSafeInteger(progress.rescueMissionsCompleted) && progress.rescueMissionsCompleted >= 0) {
      rescueMissionsCompleted = progress.rescueMissionsCompleted;
    }
    if (Array.isArray(progress.fedCats) && progress.fedCats.every(name => typeof name === 'string')) {
      fedCatNames = new Set(progress.fedCats);
    }
    if (progress.brains && typeof progress.brains === 'object' && !Array.isArray(progress.brains)) {
      savedRaceBrains = progress.brains;
    }
    if (progress.brainLearning && typeof progress.brainLearning === 'object' &&
        !Array.isArray(progress.brainLearning)) {
      savedRaceLearning = progress.brainLearning;
    }
    if (progress.catTraits && typeof progress.catTraits === 'object') {
      for (const [name, dna] of Object.entries(progress.catTraits)) {
        if (GardenGenetics.valid(dna)) savedCatTraits[name] = { ...dna };
      }
    }
    if (progress.sideMissions && gardenMissions) {
      for (const kind of ['lost', 'escort', 'escape']) {
        if (Number.isSafeInteger(progress.sideMissions[kind]) && progress.sideMissions[kind] >= 0)
          gardenMissions.completed[kind] = progress.sideMissions[kind];
      }
    }
  } catch (error) {
    console.warn('La sauvegarde Miaouville n’a pas pu être chargée :', error);
  }
}

function restoreSavedRaceBrains() {
  const cats = [playerCat, ...strayCats];
  let discardedOldGenome = false;
  for (const cat of cats) {
    const key = cat === playerCat ? 'player' : cat.name;
    const genome = savedRaceBrains[key];
    if (!genome) continue;
    try {
      cat.raceBrain = new CatRaceNetwork(genome);
    } catch (error) {
      delete savedRaceBrains[key];
      discardedOldGenome = true;
      console.info(`Ancien réseau de course de ${cat.name || 'Zouin'} écarté ; un réseau neuf sera créé à la prochaine course.`);
    }
  }
  if (discardedOldGenome) saveProgress();
}

function saveProgress() {
  const cats = [playerCat, ...followers, ...strayCats, ...raceParticipants];
  for (const cat of cats) {
    if (cat.raceBrain) savedRaceBrains[cat === playerCat ? 'player' : cat.name] = cat.raceBrain;
  }
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      coins,
      raceLevel,
      raceDifficulty,
      raceWins,
      rescueMissionLevel,
      rescueMissionsCompleted,
      fedCats: Array.from(fedCatNames),
      brains: savedRaceBrains,
      brainLearning: savedRaceLearning,
      catTraits: savedCatTraits,
      sideMissions: gardenMissions?.completed,
    }));
  } catch (error) {
    console.warn('La progression Miaouville n’a pas pu être sauvegardée :', error);
  }
}

function findWanderTarget(origin, radius) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const target = createVector(
      constrain(origin.x + random(-radius, radius), 28, CITY_WIDTH - 28),
      constrain(origin.y + random(-radius, radius), 28, CITY_HEIGHT - 28)
    );
    if (!collidesWithBuildings(target, 13)) return target;
  }
  return origin.copy();
}

function startGame() {
  conversations?.reset();
  gardenMissions?.cancel(gardenWorld());
  cancelPersonalTraining();
  playerCat.pos.set(CITY_WIDTH / 2, CITY_HEIGHT / 2);
  playerCat.vel.set(0, 0);
  playerCat.acc.set(0, 0);
  playerCat.maxSpeed = 4.2;
  playerCat.facingHeading = -HALF_PI;
  playerCat.walkDirection = 0;
  followers = [];
  raceParticipants = [];
  foodItems = createFoodItems();
  vacuumPatrollers = createVacuumPatrollers();
  activeDecoys = [];
  decoyCooldown = 0;
  extractionHintCooldown = 0;
  visualSparks = [];
  visualHearts = [];
  comboCount = 0;
  comboTimer = 0;
  meowBubbleTimer = 0;
  meowTargetCat = null;
  carriedFood = 0;
  playerStunTimer = 0;
  raceTriggerEnabled = true;
  createStreetCats();
  restoreFedCats();
  restoreSavedRaceBrains();
  cameraPosition.set(playerCat.pos.x, playerCat.pos.y);
  gameState = 'running';
  keysDown.clear();
  raceDebugEnabled = false;
  hud.root.hidden = false;
  hud.minimapPanel.hidden = false;
  hud.controlsHint.hidden = false;
  hud.staminaContainer.hidden = false;
  hud.overlay.hidden = true;
  const notebook = document.getElementById('zouin-notebook');
  if (notebook) notebook.hidden = false;
  updateNotebook();
  showToast('La balade commence. Suis les lucioles et fais signe aux chats !');
  updateInterface();
}

function togglePause() {
  if (['running', 'raceCountdown', 'race'].includes(gameState)) {
    resumeGameState = gameState;
    gameState = 'paused';
    audioFeedback?.stopAmbience();
    keysDown.clear();
    hud.title.textContent = 'Petite pause';
    hud.text.textContent = 'Le jardin attendra. Reprends ta promenade quand tu veux.';
    hud.action.innerHTML = 'Reprendre la balade <span aria-hidden="true">→</span>';
    hud.overlay.hidden = false;
  } else if (gameState === 'paused') {
    resumeGame();
  }
}

function resumeGame() {
  gameState = resumeGameState;
  if (gameState === 'running') audioFeedback?.startAmbience?.();
  hud.overlay.hidden = true;
  keysDown.clear();
}

function updatePlayer(dt) {
  playerStunTimer = Math.max(0, playerStunTimer - dt);

  // Haut/bas avancent et reculent dans l'axe du chat ; gauche/droite le font pivoter.
  const axes = GameRules.movementAxes(keysDown);

  // Sprint avec Shift / Maj
  const wantsSprint = (keysDown.has('shift') || keysDown.has('shiftright')) && axes.y < 0 && playerStamina > 5;
  if (wantsSprint) {
    playerStamina = Math.max(0, playerStamina - 0.58 * dt);
  } else {
    playerStamina = Math.min(100, playerStamina + 0.35 * dt);
  }

  // Mise à jour de la barre d'endurance
  if (hud.staminaBar) {
    hud.staminaBar.style.width = `${playerStamina}%`;
    hud.staminaBar.classList.toggle('tired', playerStamina < 20);
  }

  const speedFactor = (playerStunTimer > 0 ? 0.38 : 1) * (wantsSprint ? 1.65 : 1.0);
  playerCat.maxSpeed = 4.2 * (wantsSprint ? 1.65 : 1);
  const drive = GameRules.playerDriveIntent(
    playerCat.facingHeading, axes, dt, 4.2 * speedFactor
  );
  playerCat.facingHeading = drive.heading;
  if (drive.direction !== 0) playerCat.walkDirection = drive.direction;
  const desiredVelocity = createVector(drive.desiredVelocity.x, drive.desiredVelocity.y);
  const steering = p5.Vector.sub(desiredVelocity, playerCat.vel).limit(playerCat.maxForce);
  playerCat.applyForce(steering);
  playerCat.update();
  resolveBuildingCollisions(playerCat);
  playerCat.pos.x = constrain(playerCat.pos.x, playerCat.r_pourDessin, CITY_WIDTH - playerCat.r_pourDessin);
  playerCat.pos.y = constrain(playerCat.pos.y, playerCat.r_pourDessin, CITY_HEIGHT - playerCat.r_pourDessin);

  // Particules de poussière sous les pattes lors d'un sprint
  if (wantsSprint && frameCount % 5 === 0) {
    createSparks(playerCat.pos.x, playerCat.pos.y, '#e5dccb', 2);
  }

  updateRaceTrigger();
}

function updateFoodPickups() {
  if (carriedFood >= FOOD_CAPACITY) return;
  for (const item of foodItems) {
    if (item.collected || p5.Vector.dist(item.pos, playerCat.pos) > FOOD_PICKUP_RADIUS) continue;
    item.collected = true;
    carriedFood++;
    triggerCombo('pickup');
    if (audioFeedback) audioFeedback.play('pickup', comboCount);
    createSparks(item.pos.x, item.pos.y, '#f1c40f', 8);

    const name = item.kind === 'pate' ? 'Une boîte de pâtée' : 'Des croquettes';
    showToast(`${name} ramassées · ${carriedFood} / ${FOOD_CAPACITY} portions.`);
    if (carriedFood >= FOOD_CAPACITY) break;
  }
}

function updateExtractionZone(dt) {
  extractionZone?.updateZone(dt);
  if (!extractionZone || gameState !== 'running') return;
  const quota = GameRules.rescueQuota(rescueMissionLevel);
  const distance = p5.Vector.dist(playerCat.pos, extractionZone.pos);
  if (GameRules.canDeliverRescueGroup(distance, extractionZone.r, playerCat.r_pourDessin,
    followers.length, quota)) {
    completeRescueContract(quota);
    return;
  }
  extractionHintCooldown = Math.max(0, extractionHintCooldown - Math.max(0, dt) / 60);
  if (distance <= extractionZone.r + playerCat.r_pourDessin && followers.length > 0 &&
      followers.length < quota && extractionHintCooldown === 0) {
    extractionHintCooldown = 2.5;
    showToast(`Le refuge attend ${quota} chats : ta bande en compte ${followers.length}.`);
  }
}

function completeRescueContract(quota) {
  const delivered = Math.min(quota, followers.length);
  const reward = GameRules.rescueContractReward(rescueMissionLevel, delivered);
  const rescued = followers.splice(0, delivered);
  for (const cat of rescued) if (cat.dna) savedCatTraits[cat.name] = GardenGenetics.mutate(cat.dna);
  coins += reward;
  rescueMissionsCompleted++;
  rescueMissionLevel = Math.min(3, rescueMissionLevel + 1);
  saveProgress();
  createHearts(extractionZone.pos.x, extractionZone.pos.y, 18);
  createSparks(extractionZone.pos.x, extractionZone.pos.y, '#73d8bd', 18);
  audioFeedback?.play('victory');
  gameState = 'missionComplete';
  hud.title.textContent = 'Sauvetage réussi !';
  hud.text.textContent = `${delivered} chats sont en sécurité au refuge. Tu gagnes ${reward} pièces. Le prochain contrat demandera ${GameRules.rescueQuota(rescueMissionLevel)} chats.`;
  hud.results.hidden = true;
  hud.help.hidden = true;
  hud.action.innerHTML = 'Nouveau contrat <span aria-hidden="true">→</span>';
  hud.overlay.hidden = false;
  updateInterface();
}

function deployDecoy() {
  if (gameState !== 'running' || decoyCooldown > 0) return false;
  const heading = playerCat.vel.magSq() > 0.05 ? playerCat.vel.heading() : -HALF_PI;
  const position = playerCat.pos.copy().add(createVector(-Math.cos(heading) * 34, -Math.sin(heading) * 34));
  const decoyDuration = 4.5;
  activeDecoys.push(new Decoy(position.x, position.y, millis() + decoyDuration * 1000));
  decoyCooldown = 8;
  createSparks(position.x, position.y, '#71d6c0', 8);
  audioFeedback?.play('decoy');
  showToast('Leurre posé ! Le papillon d’ombre devrait s’en approcher.');
  return true;
}

function updateDecoys(dt) {
  decoyCooldown = GameRules.remainingCooldown(decoyCooldown, Math.max(0, dt) / 60);
  for (const decoy of activeDecoys) decoy.update();
  activeDecoys = GameRules.keepUnexpiredEffects(activeDecoys, millis());
}

function drawDecoyItem(decoy) {
  const pulse = 1 + Math.sin(decoy.phase) * 0.12;
  push();
  translate(decoy.pos.x, decoy.pos.y);
  noFill();
  stroke(113, 214, 192, 145);
  strokeWeight(2);
  circle(0, 0, 48 * pulse);
  noStroke();
  fill(113, 214, 192, 42);
  circle(0, 0, 34 * pulse);
  fill('#f0d7a0');
  ellipse(0, 0, 18, 12);
  fill('#8e7245');
  circle(-4, -1, 3);
  circle(2, 2, 3);
  circle(5, -2, 3);
  pop();
}

function createSparks(x, y, tint, count) {
  for (let index = 0; index < count; index++) {
    visualSparks.push(new Spark(
      x, y, random(-2.2, 2.2), random(-3, 1), tint,
      random(18, 36), random(2, 5)
    ));
  }
}

function createHearts(x, y, count) {
  for (let index = 0; index < count; index++) {
    visualHearts.push(new HeartParticle(x, y, random(-1.1, 1.1), random(-2.2, -0.7)));
  }
}

function triggerCombo() {
  comboCount = comboTimer > 0 ? comboCount + 1 : 1;
  comboTimer = 2.4;
  if (comboCount > 1) {
    hud.comboBanner.textContent = `COMBO x${comboCount} !`;
    hud.comboBanner.classList.add('show');
    audioFeedback?.play('combo', comboCount);
  }
}

function updateComboAndParticles(dt) {
  const elapsedSeconds = Math.max(0, dt) / 60;
  comboTimer = GameRules.remainingCooldown(comboTimer, elapsedSeconds);
  meowBubbleTimer = GameRules.remainingCooldown(meowBubbleTimer, elapsedSeconds);
  if (meowBubbleTimer === 0) meowTargetCat = null;
  if (comboTimer === 0) {
    comboCount = 0;
    hud.comboBanner?.classList.remove('show');
  }
  for (const spark of visualSparks) spark.updateSpark(dt);
  visualSparks = visualSparks.filter(spark => spark.life > 0);
  for (const heart of visualHearts) heart.update(dt);
  visualHearts = visualHearts.filter(heart => heart.life > 0);
}

function drawSparkItem(spark) {
  push();
  noStroke();
  const tint = color(spark.color);
  tint.setAlpha(255 * Math.min(1, spark.life / 8));
  fill(tint);
  circle(spark.pos.x, spark.pos.y, spark.size * 2);
  pop();
}

function drawHeartItem(heart) {
  push();
  translate(heart.pos.x, heart.pos.y);
  noStroke();
  const tint = color('#e88983');
  tint.setAlpha(235 * Math.min(1, heart.life / 0.35));
  fill(tint);
  textAlign(CENTER, CENTER);
  textSize(15);
  text('♥', 0, 0);
  pop();
}

function updateVacuumPatrollers(dt) {
  for (const vacuum of vacuumPatrollers) {
    vacuum.hitCooldown = Math.max(0, vacuum.hitCooldown - dt);

    // Vérifier si un leurre est actif à proximité
    let targetDecoy = null;
    let minDecoyDist = 420;
    for (const decoy of activeDecoys) {
      const d = p5.Vector.dist(vacuum.pos, decoy.pos);
      if (d < minDecoyDist) {
        minDecoyDist = d;
        targetDecoy = decoy;
      }
    }

    const playerDistance = p5.Vector.dist(vacuum.pos, playerCat.pos);
    let target;
    let pursuing = false;

    if (vacuum.hitCooldown > 0) {
      // Étourdi / recul
      target = { pos: vacuum.pos.copy() };
      vacuum.chasing = false;
      if (frameCount % 6 === 0) {
        createSparks(vacuum.pos.x, vacuum.pos.y, '#f39c12', 3);
      }
    } else if (targetDecoy) {
      // Priorité au leurre ! (Module 1 Seek)
      target = targetDecoy;
      vacuum.chasing = true;
      if (minDecoyDist < vacuum.radius + targetDecoy.r) {
        // Aspirateur neutralisé par le leurre !
        vacuum.hitCooldown = 240; // 4s d'étourdissement
        createSparks(vacuum.pos.x, vacuum.pos.y, '#e74c3c', 20);
        activeDecoys.splice(activeDecoys.indexOf(targetDecoy), 1);
        showToast('✨ Le papillon d’ombre s’est laissé distraire !');
        if (audioFeedback) audioFeedback.play('danger');
      }
    } else if (playerDistance < VACUUM_ALERT_RADIUS || vacuum.missionPursuer) {
      target = playerCat;
      pursuing = true;
      vacuum.chasing = true;
    } else {
      target = { pos: vacuum.route[vacuum.waypoint] };
      vacuum.chasing = false;
      if (p5.Vector.dist(target.pos, vacuum.pos) < 18) {
        vacuum.waypoint = (vacuum.waypoint + 1) % vacuum.route.length;
        target = { pos: vacuum.route[vacuum.waypoint] };
      }
    }

    const chaseSpeed = raceDifficulty === 'hard' ? 3.2 : raceDifficulty === 'easy' ? 2.4 : 2.8;
    vacuum.pilot(target, pursuing, vacuum.chasing ? chaseSpeed : 1.15, cityObstacles);
    resolveBuildingCollisions(vacuum);

    if (vacuum.hitCooldown === 0 &&
        p5.Vector.dist(vacuum.pos, playerCat.pos) < vacuum.radius + playerCat.r_pourDessin) {
      vacuum.hitCooldown = 120;
      if (gardenMissions?.active?.moth === vacuum) gardenMissions.active.hits++;
      playerStunTimer = 60;
      const lostFood = carriedFood > 0;
      carriedFood = Math.max(0, carriedFood - 1);
      const escape = p5.Vector.sub(playerCat.pos, vacuum.pos);
      if (escape.magSq() === 0) {
        escape.set(vacuum.id % 2 === 0 ? 1 : -1, 0);
      }
      escape.normalize();
      vacuum.vel.set(-escape.x * 3.6, -escape.y * 3.6);
      playerCat.vel.add(escape.mult(2.6));
      if (audioFeedback) audioFeedback.play('danger');
      if (lostFood) showToast('Oups, le papillon d’ombre a volé une portion ! Éloigne-toi.');
      else showToast('Aïe ! Le papillon d’ombre t’a ralentie. Éloigne-toi vite !');
    }
  }
}

function updateRaceTrigger() {
  if (gardenMissions?.active) return;
  const distance = distanceToRaceTrack(playerCat.pos);
  if (!raceTriggerEnabled) {
    if (distance > raceTrack.width / 2 + 72) raceTriggerEnabled = true;
    return;
  }
  if (distance <= raceTrack.width / 2 + playerCat.r_pourDessin) startCatRace();
}

function distanceToRaceTrack(position) {
  let nearestDistance = Infinity;
  for (let index = 0; index < raceTrack.points.length; index++) {
    const start = raceTrack.points[index];
    const end = raceTrack.points[(index + 1) % raceTrack.points.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const amount = constrain(((position.x - start.x) * dx + (position.y - start.y) * dy) / lengthSquared, 0, 1);
    nearestDistance = Math.min(nearestDistance, Math.hypot(position.x - start.x - dx * amount, position.y - start.y - dy * amount));
  }
  return nearestDistance;
}

function startCatRace() {
  if (gameState !== 'running') return;
  if (gardenMissions?.active) { showToast('Termine ou abandonne ta mission dans le carnet avant la course.'); return; }
  conversations?.reset();
  cancelPersonalTraining();
  watchedRacer = playerCat;
  audioFeedback?.stopAmbience?.();
  raceDebugEnabled = false;
  raceTriggerEnabled = false;
  raceNumber++;
  lastRacePromotions = 0;
  raceElapsed = 0;
  const difficulty = getRaceDifficulty(raceDifficulty);
  raceTimeLimit = Math.max(34, difficulty.timeLimit - (raceLevel - 1) * 2);
  raceCountdown = RACE_COUNTDOWN;
  const contestants = [playerCat, ...followers, ...strayCats];
  const originals = new Map(contestants.map(cat => [cat, {
    role: cat === playerCat ? 'player' : followers.includes(cat) ? 'follower' : 'stray',
    position: cat.pos.copy(),
    velocity: cat.vel.copy(),
    maxSpeed: cat.maxSpeed,
  }]));
  const startingGrid = getRaceGrid(contestants.length, raceTrack.points);
  for (let index = startingGrid.length - 1; index > 0; index--) {
    const otherIndex = Math.floor(random() * (index + 1));
    [startingGrid[index], startingGrid[otherIndex]] = [startingGrid[otherIndex], startingGrid[index]];
  }
  prepareIndividualRaceBrains(
    contestants,
    playerCat,
    savedRaceBrains,
    savedRaceLearning,
    raceDifficulty,
    () => random()
  );
  raceParticipants = contestants.map((cat, index) => {
    const gridSlot = startingGrid[index];
    cat.pos.set(
      gridSlot.x,
      gridSlot.y
    );
    cat.vel.set(Math.cos(gridSlot.heading) * 1.35, Math.sin(gridSlot.heading) * 1.35);
    cat.walkDirection = 1;
    cat.raceWaypoint = Math.floor(gridSlot.progress);
    cat.raceProgress = gridSlot.progress;
    cat.raceCourseLength = raceTrack.points.length;
    cat.raceFinishedAt = null;
    cat.raceMaxSpeed = difficulty.playerSpeed;
    cat.maxSpeed = cat.raceMaxSpeed;
    cat.raceHeading = gridSlot.heading;
    cat.raceSensorReadings = [];
    cat.raceCrashed = false;
    cat.raceOffTrackFrames = 0;
    cat.originalTownState = originals.get(cat);
    return cat;
  });
  followers = [];
  strayCats = [];
  gameState = 'raceCountdown';

  // Activation de l'overlay de course Arcade
  if (hud.raceArcadeHud) hud.raceArcadeHud.classList.add('visible');
  if (hud.raceBrainStatus) hud.raceBrainStatus.textContent = 'RÉSEAUX PRÊTS · 8–20–2';
  if (hud.arcadeCountdown) {
    hud.arcadeCountdown.hidden = false;
    hud.arcadeCountdown.textContent = '3';
  }
  if (audioFeedback) audioFeedback.play('beep');
  showToast(`🏁 Course des Lucioles n° ${raceNumber} : 3, 2, 1... Partez !`);
}

function updateRace(dt) {
  if (gameState === 'raceCountdown') {
    const prevCount = Math.ceil(raceCountdown);
    raceCountdown -= deltaTime / 1000;
    const curCount = Math.ceil(raceCountdown);

    if (curCount < prevCount && curCount > 0 && audioFeedback) {
      audioFeedback.play('beep');
    }
    if (hud.arcadeCountdown) {
      hud.arcadeCountdown.textContent = curCount > 0 ? String(curCount) : 'MIAOU !';
    }

    if (raceCountdown <= 0) {
      raceCountdown = 0;
      raceElapsed = 0;
      gameState = 'race';
      if (audioFeedback) audioFeedback.play('go');
      setTimeout(() => {
        if (hud.arcadeCountdown) hud.arcadeCountdown.hidden = true;
      }, 700);
    }
    return;
  }

  raceElapsed += deltaTime / 1000;

  // Mise à jour de chaque coureur IA piloté par son réseau de neurones
  for (const cat of raceParticipants) {
    cat.raceBrainActive = false;
    if (cat.raceFinishedAt !== null) continue;
    updateRacer(cat, dt);
  }
  if (hud.raceBrainStatus) {
    const activeBrains = raceParticipants.filter(cat => cat.raceBrainActive).length;
    hud.raceBrainStatus.textContent = `RÉSEAUX ACTIFS · ${activeBrains}/${raceParticipants.length}`;
  }

  // Télémétrie arcade en temps réel
  const standings = getRaceStandings();
  const playerRank = standings.indexOf(playerCat) + 1;
  const playerSpeedKmh = Math.round((watchedRacer || playerCat).vel.mag() * 14.2);

  if (hud.arcadeRank) hud.arcadeRank.textContent = String(playerRank);
  const rankLabel = document.querySelector('.race-rank-sub');
  if (rankLabel) rankLabel.innerHTML = `CLASSEMENT<br>SUR ${raceParticipants.length}`;
  if (hud.arcadeSpeed) hud.arcadeSpeed.textContent = String(playerSpeedKmh);

  // Détection de sens inverse pour le joueur
  const curTarget = sampleRacePath(raceTrack.points, playerCat.raceProgress);
  const nextTarget = sampleRacePath(raceTrack.points, playerCat.raceProgress + 0.1);
  const trackTangent = createVector(nextTarget.x - curTarget.x, nextTarget.y - curTarget.y).normalize();
  const isWrongWay = playerCat.vel.mag() > 0.4 && playerCat.vel.dot(trackTangent) < -0.3;
  if (hud.arcadeWrongWay) hud.arcadeWrongWay.hidden = !isWrongWay;

  const allFinished = raceParticipants.every(cat => cat.raceFinishedAt !== null);
  if (allFinished || raceElapsed >= raceTimeLimit) finishCatRace();
}

function updateRacer(cat, dt) {
  const { readings, inputs } = raceInputsFor(cat, raceTrack, raceParticipants);
  cat.raceSensorReadings = readings;
  // Seul le cerveau personnel décide du déplacement, y compris pour Zouin.
  const outputs = cat.raceBrain.predict(inputs);
  cat.raceInputs = inputs.slice();
  cat.raceOutputs = outputs.slice();
  cat.raceBrainActive = true;
  const command = raceSteeringCommand(cat.vel, outputs, cat.raceMaxSpeed, cat.maxForce);
  const neuralForce = createVector(command.force.x, command.force.y);
  cat.applyForce(neuralForce);
  cat.update();
  if (cat.vel.magSq() > 0.01) cat.raceHeading = cat.vel.heading();
  if (cat === playerCat) cat.facingHeading = cat.raceHeading;

  const pathPosition = getRacePathProgress(cat.pos, cat.raceProgress);
  if (pathPosition.distance <= raceTrack.width / 2 + 35) {
    cat.raceProgress = Math.max(cat.raceProgress, pathPosition.progress);
    cat.raceWaypoint = Math.floor(cat.raceProgress);
    cat.raceOffTrackFrames = 0;
  } else {
    cat.raceOffTrackFrames = (cat.raceOffTrackFrames || 0) + dt;
    if (shouldCrashRacer(cat.raceOffTrackFrames, getRaceDifficulty(raceDifficulty).offTrackGrace)) {
      cat.raceCrashed = true;
      cat.raceFinishedAt = raceElapsed + RACE_TIMEOUT;
      cat.vel.set(0, 0);
      return;
    }
  }
  if (cat.raceProgress >= raceTrack.points.length * RACE_LAPS) {
    cat.raceFinishedAt = raceElapsed;
    cat.vel.set(0, 0);
  }
}

function getRacePathProgress(position, currentProgress) {
  return projectRaceProgress(position, raceTrack.points, currentProgress);
}

function getRaceStandings() {
  return raceParticipants.slice().sort((a, b) => {
    const aClass = a.raceCrashed ? 2 : a.raceFinishedAt !== null ? 0 : 1;
    const bClass = b.raceCrashed ? 2 : b.raceFinishedAt !== null ? 0 : 1;
    if (aClass !== bClass) return aClass - bClass;
    if (aClass === 0) return a.raceFinishedAt - b.raceFinishedAt;
    if (a.raceProgress !== b.raceProgress) return b.raceProgress - a.raceProgress;
    return distanceToRaceTrack(a.pos) - distanceToRaceTrack(b.pos);
  });
}

function finishCatRace() {
  const standings = getRaceStandings();
  const playerPlace = standings.indexOf(playerCat) + 1;
  const playerOutcome = getRaceOutcome(playerCat.raceProgress, raceTrack.points.length * RACE_LAPS,
    playerCat.raceCrashed, raceElapsed, raceTimeLimit);
  const playerFinished = playerOutcome === 'finished';
  const playerLost = !playerFinished;
  const reward = playerLost ? 0 : playerPlace <= RACE_REWARDS.length
    ? RACE_REWARDS[playerPlace - 1] + raceLevel * (playerPlace === 1 ? 25 : 10)
    : 10 + raceLevel * 3;
  coins += reward;
  if (!playerLost && playerPlace === 1) {
    raceWins++;
    raceLevel = Math.min(RACE_LEVELS, raceLevel + 1);
    if (audioFeedback) audioFeedback.play('victory');
  } else if (audioFeedback) {
    audioFeedback.play('delivery', 1);
  }
  lastRacePromotions = evolveRaceNetworks(standings);
  saveProgress();
  restoreTownAfterRace();
  raceDebugEnabled = false;
  if (hud.raceArcadeHud) hud.raceArcadeHud.classList.remove('visible');
  gameState = 'results';
  hud.title.textContent = playerLost ? 'Course perdue' : playerPlace === 1 ? 'Victoire !' : `Course terminée · ${playerPlace}${playerPlace === 1 ? 'er' : 'e'} place`;
  hud.text.textContent = playerLost
    ? playerOutcome === 'off-track'
      ? 'Zouin a quitté la piste trop longtemps. Entraîne son cerveau dans le carnet, puis retente la course.'
      : `Le chrono est écoulé avant la ligne d’arrivée. Il te restait ${Math.max(0, Math.ceil(raceTrack.points.length - playerCat.raceProgress))} sections à parcourir.`
    : playerPlace === 1
      ? `Tu remportes ${reward} pièces${raceLevel > 1 ? ` et progresses vers le championnat ${raceLevel} / ${RACE_LEVELS}` : ''}.`
      : `Tu remportes ${reward} pièces. Termine premier pour progresser dans le championnat.`;
  const topThree = standings.slice(0, 3).map((cat, index) =>
    `<span><b>${index + 1}.</b> ${cat.name || 'Minou'} <i>${cat.raceCrashed ? 'sortie de piste' : cat.raceFinishedAt === null ? 'en course' : `${cat.raceFinishedAt.toFixed(1)} s`}</i></span>`).join('');
  hud.results.innerHTML = `<div class="result-list">${topThree}</div><p class="result-note">${playerLost ? 'Défaite : termine le tour sans rester hors piste plus de quelques secondes.' : `Difficulté ${getRaceDifficulty(raceDifficulty).label} · Réseau neuronal 8–20–2 pour chaque chat`}</p><p class="result-note">Cerveaux indépendants · ${lastRacePromotions} progression(s) personnelle(s) cette course. Les poids ne sont pas partagés entre les chats.</p>`;
  hud.results.hidden = false;
  hud.help.hidden = true;
  hud.action.innerHTML = 'Continuer la promenade <span aria-hidden="true">→</span>';
  hud.overlay.hidden = false;
  queuePersonalTraining(standings, true);
  updateInterface();
}

function evolveRaceNetworks(standings) {
  return evolveIndividualRaceBrains(
    standings,
    playerCat,
    raceElapsed,
    raceDifficulty,
    savedRaceBrains,
    savedRaceLearning
  );
}

function restoreTownAfterRace() {
  followers = [];
  strayCats = [];
  for (const cat of raceParticipants) {
    const original = cat.originalTownState;
    cat.pos.set(original.position.x, original.position.y);
    cat.vel.set(original.velocity.x, original.velocity.y);
    cat.maxSpeed = original.maxSpeed;
    if (original.role === 'follower') followers.push(cat);
    if (original.role === 'stray') strayCats.push(cat);
    cat.originalTownState = null;
    cat.raceCrashed = false;
    cat.raceOffTrackFrames = 0;
  }
  const startTangent = p5.Vector.sub(raceTrack.points[1], raceTrack.start).normalize();
  const startNormal = createVector(-startTangent.y, startTangent.x);
  playerCat.pos.set(
    raceTrack.start.x + startNormal.x * (raceTrack.width / 2 + 45),
    raceTrack.start.y + startNormal.y * (raceTrack.width / 2 + 45)
  );
  playerCat.vel.set(0, 0);
  raceParticipants = [];
  raceTriggerEnabled = false;
}

function closeRaceResults() {
  gameState = 'running';
  audioFeedback?.startAmbience?.();
  hud.overlay.hidden = true;
  hud.results.hidden = true;
  hud.help.hidden = false;
  updateInterface();
}

function updateStreetCats(dt) {
  for (const cat of strayCats) {
    if (prepareTownCat(cat, dt)) continue;
    if (cat.isWanderingNear(playerCat)) {
      cat.fireflyTargetId = null;
      cat.applyNearbyWander(playerCat, [...strayCats, ...followers, playerCat], cityObstacles, dt);
      finishTownCatStep(cat);
      cat.avoidanceSideLock = Math.max(0, cat.avoidanceSideLock - dt);
      continue;
    }
    cat.wanderTimer -= dt;
    if (cat.wanderTimer <= 0 || p5.Vector.dist(cat.pos, cat.wanderTarget) < 30) {
      cat.wanderTarget = findWanderTarget(cat.pos, 180);
      cat.wanderTimer = random(65, 150);
    }
    const firefly = nearestFireflyTarget(cat.pos, fireflies, 460);
    const food = !cat.isFed && foodItems.filter(item => !item.collected &&
      p5.Vector.dist(item.pos, cat.pos) < (cat.dna?.foodRadius || 180))
      .sort((a, b) => p5.Vector.dist(a.pos, cat.pos) - p5.Vector.dist(b.pos, cat.pos))[0];
    cat.fireflyTargetId = firefly ? firefly.id : null;
    const wanderDetour = cat.getDetourTarget(cat.wanderTarget, cityObstacles);
    const fireflyDetour = firefly && cat.getDetourTarget(firefly.pos, cityObstacles);
    const target = food ? cat.getDetourTarget(food.pos, cityObstacles) || food.pos
      : firefly ? fireflyDetour || firefly.pos : wanderDetour || cat.wanderTarget;
    steerCat(cat, target, strayCats, dt, {
      arrive: food ? cat.dna?.foodWeight || 0.8 : firefly ? 0.64 : 0.85,
      separation: 1.5, alignment: 0.22, cohesion: 0.16,
    }, firefly ? cat.arrive(cat.wanderTarget) : null);
    cat.avoidanceSideLock = Math.max(0, cat.avoidanceSideLock - dt);
    if (food && p5.Vector.dist(food.pos, cat.pos) < 20) {
      food.collected = true;
      cat.isFed = true;
      fedCatNames.add(cat.name);
      saveProgress();
    }
  }
}

function updateFollowers(dt) {
  for (let index = 0; index < followers.length; index++) {
    const cat = followers[index];
    if (prepareTownCat(cat, dt)) continue;
    if (cat.isWanderingNear(playerCat)) {
      cat.applyNearbyWander(playerCat, [...followers, ...strayCats, playerCat], cityObstacles, dt);
      finishTownCatStep(cat);
      cat.avoidanceSideLock = Math.max(0, cat.avoidanceSideLock - dt);
      continue;
    }
    const row = Math.floor(index / 2) + 1;
    const side = index % 2 === 0 ? -1 : 1;
    const heading = Number.isFinite(playerCat.facingHeading) ? playerCat.facingHeading : -HALF_PI;
    const target = playerCat.pos.copy()
      .add(createVector(Math.cos(heading + Math.PI) * row * 55 + Math.cos(heading + HALF_PI) * side * 34,
        Math.sin(heading + Math.PI) * row * 55 + Math.sin(heading + HALF_PI) * side * 34));
    const detour = cat.getDetourTarget(target, cityObstacles);
    steerCat(cat, detour || target, followers.concat(playerCat), dt, {
      arrive: detour ? 0.8 : 0.62, separation: 1.55, alignment: 0.32, cohesion: 0.27,
    });
    cat.avoidanceSideLock = Math.max(0, cat.avoidanceSideLock - dt);
  }
}

function steerCat(cat, target, neighbors, dt, weights, secondaryForce = null) {
  const separation = cat.separation(neighbors, 47);
  const alignment = cat.alignment(neighbors, 150);
  const cohesion = cat.cohesion(neighbors, 190);
  const arrive = cat.arrive(target);
  const steering = GameRules.composeSteering([
    { force: arrive, weight: weights.arrive },
    { force: secondaryForce || createVector(0, 0), weight: secondaryForce ? 0.3 : 0 },
    { force: separation, weight: weights.separation },
    { force: alignment, weight: weights.alignment },
    { force: cohesion, weight: weights.cohesion },
  ], cat.maxForce);
  cat.applyForce(createVector(steering.x, steering.y));
  finishTownCatStep(cat);
}

function finishTownCatStep(cat) {
  cat.update();
  resolveBuildingCollisions(cat);
  cat.pos.x = constrain(cat.pos.x, cat.r_pourDessin, CITY_WIDTH - cat.r_pourDessin);
  cat.pos.y = constrain(cat.pos.y, cat.r_pourDessin, CITY_HEIGHT - cat.r_pourDessin);
}

function resolveBuildingCollisions(entity) {
  const radius = entity.r_pourDessin || 12;
  for (const building of buildings) {
    const closestX = constrain(entity.pos.x, building.x, building.x + building.w);
    const closestY = constrain(entity.pos.y, building.y, building.y + building.h);
    let dx = entity.pos.x - closestX;
    let dy = entity.pos.y - closestY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= radius * radius) continue;

    if (distanceSquared === 0) {
      const sides = [
        { distance: entity.pos.x - building.x, x: -1, y: 0 },
        { distance: building.x + building.w - entity.pos.x, x: 1, y: 0 },
        { distance: entity.pos.y - building.y, x: 0, y: -1 },
        { distance: building.y + building.h - entity.pos.y, x: 0, y: 1 },
      ];
      sides.sort((a, b) => a.distance - b.distance);
      entity.pos.x += sides[0].x * (radius + sides[0].distance);
      entity.pos.y += sides[0].y * (radius + sides[0].distance);
      continue;
    }

    const distance = Math.sqrt(distanceSquared);
    const push = radius - distance;
    dx /= distance;
    dy /= distance;
    entity.pos.x += dx * push;
    entity.pos.y += dy * push;
  }

  for (const tree of trees) {
    let dx = entity.pos.x - tree.x;
    let dy = entity.pos.y - tree.y;
    const distance = Math.hypot(dx, dy);
    const minimumDistance = radius + tree.r * 0.62;
    if (distance >= minimumDistance) continue;
    if (distance === 0) {
      dx = 1;
      dy = 0;
    } else {
      dx /= distance;
      dy /= distance;
    }
    entity.pos.x += dx * (minimumDistance - distance);
    entity.pos.y += dy * (minimumDistance - distance);
  }
}

function collidesWithBuildings(position, radius) {
  const hitsBuilding = buildings.some(building => {
    const x = constrain(position.x, building.x, building.x + building.w);
    const y = constrain(position.y, building.y, building.y + building.h);
    return sq(position.x - x) + sq(position.y - y) < radius * radius;
  });
  return hitsBuilding || trees.some(tree =>
    Math.hypot(position.x - tree.x, position.y - tree.y) < radius + tree.r * 0.62);
}

function inviteNearbyCat(chosen = null) {
  if (gameState !== 'running') return;
  const candidates = strayCats
    .filter(cat => !chosen || cat === chosen)
    .map(cat => ({ cat, distance: p5.Vector.dist(cat.pos, playerCat.pos) }))
    .filter(entry => entry.distance < 82)
    .sort((a, b) => a.distance - b.distance);
  if (!candidates.length) {
    showToast('Approche-toi un peu plus d’un chat pour lui faire signe.');
    return;
  }

  const [entry] = candidates;
  strayCats.splice(strayCats.indexOf(entry.cat), 1);
  entry.cat.wanderTarget = playerCat.pos.copy();
  followers.push(entry.cat);
  conversations?.accept(entry.cat);
  createHearts(entry.cat.pos.x, entry.cat.pos.y, 6);
  if (audioFeedback) audioFeedback.play('purr');
  showToast(`💖 ${entry.cat.name} a décidé de rejoindre ta bande !`);
}

function feedNearbyCat(chosen = null) {
  if (gameState !== 'running' || carriedFood === 0) return false;
  const recipient = strayCats
    .filter(cat => !chosen || cat === chosen)
    .filter(cat => !cat.isFed)
    .map(cat => ({ cat, distance: p5.Vector.dist(cat.pos, playerCat.pos) }))
    .filter(entry => entry.distance < 82)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!recipient) return false;

  const fedCat = recipient.cat;
  fedCat.isFed = true;
  fedCatNames.add(fedCat.name);
  carriedFood--;
  triggerCombo('feed');
  const reward = 25 * (comboCount > 1 ? comboCount : 1);
  coins += reward;
  createHearts(fedCat.pos.x, fedCat.pos.y, 10);
  createSparks(fedCat.pos.x, fedCat.pos.y, '#f1c40f', 8);
  if (audioFeedback) audioFeedback.play('delivery', comboCount);
  saveProgress();
  showToast(`✨ ${fedCat.name} se régale ! +${reward} pièces.`);
  return true;
}

function updateCamera(dt) {
  const target = playerCat.pos;
  cameraPosition.lerp(target, Math.min(1, 0.11 * dt));
  cameraPosition.x = constrain(cameraPosition.x, Math.min(width / 2, CITY_WIDTH / 2), Math.max(CITY_WIDTH - width / 2, CITY_WIDTH / 2));
  cameraPosition.y = constrain(cameraPosition.y, Math.min(height / 2, CITY_HEIGHT / 2), Math.max(CITY_HEIGHT - height / 2, CITY_HEIGHT / 2));
}

function renderCity() {
  if (city3DRenderer?.ready) {
    city3DRenderer.render({
      cameraPosition,
      gameState,
      playerCat,
      followers,
      strayCats,
      raceParticipants,
      foodItems,
      vacuumPatrollers,
      activeDecoys,
      fireflies,
      extractionZone,
      raceDebugEnabled,
      watchedRacer,
      extraCats: extraGardenCats(),
      beacons: gardenMissions?.active ? [gardenMissions.active.beacon] : [],
      frame: frameCount,
    });
    return;
  }
  background('#101b2b');
  push();
  translate(width / 2 - cameraPosition.x, height / 2 - cameraPosition.y);
  drawTownGround();
  drawStreets();
  drawStreetDetails();
  drawRaceTrack();
  extractionZone?.show2D();
  if (gardenMissions?.active) {
    const marker = gardenMissions.active.beacon;
    noFill(); stroke('#f7d778'); strokeWeight(3); circle(marker.pos.x, marker.pos.y, 60);
  }

  const renderItems = [
    ...fireflies.map(firefly => ({ y: firefly.pos.y, draw: () => drawFirefly(firefly) })),
    ...buildings.map(building => ({ y: building.sortY, draw: () => drawBuilding(building) })),
    ...trees.map(tree => ({ y: tree.y, draw: () => drawTree(tree) })),
    ...foodItems.filter(item => !item.collected)
      .map(item => ({ y: item.pos.y, draw: () => drawFoodPickup(item) })),
    ...vacuumPatrollers.map(vacuum => ({ y: vacuum.pos.y, draw: () => drawVacuum(vacuum) })),
    ...activeDecoys.map(decoy => ({ y: decoy.pos.y, draw: () => drawDecoyItem(decoy) })),
    ...(typeof drawPigeon === 'function'
      ? pigeonFlocks.flat().map(pigeon => ({ y: pigeon.pos.y, draw: () => drawPigeon(pigeon) }))
      : []),
    ...(cityTram && typeof drawCityTram === 'function'
      ? [{ y: cityTram.pos.y, draw: () => drawCityTram(cityTram) }]
      : []),
    ...visualHearts.map(h => ({ y: h.y, draw: () => drawHeartItem(h) })),
    ...visualSparks.map(s => ({ y: s.y, draw: () => drawSparkItem(s) })),
  ];
  if (raceParticipants.length) {
    renderItems.push(...raceParticipants.map(cat => ({ y: cat.pos.y, draw: () => drawRacer(cat) })));
  } else {
    renderItems.push(...extraGardenCats().map(cat => ({ y: cat.pos.y, draw: () => drawTownCat(cat) })));
    renderItems.push(...strayCats.map(cat => ({ y: cat.pos.y, draw: () => drawTownCat(cat) })));
    renderItems.push(...followers.map(cat => ({ y: cat.pos.y, draw: () => drawTownCat(cat) })));
    renderItems.push({ y: playerCat.pos.y, draw: () => drawTownCat(playerCat, true) });
  }
  renderItems.sort((a, b) => a.y - b.y);
  for (const item of renderItems) item.draw();
  pop();
}

function renderMinimap() {
  const canvas = hud?.minimapCanvas;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const mapWidth = canvas.width;
  const mapHeight = canvas.height;
  const scale = Math.min(mapWidth / CITY_WIDTH, mapHeight / CITY_HEIGHT);
  const offsetX = (mapWidth - CITY_WIDTH * scale) / 2;
  const offsetY = (mapHeight - CITY_HEIGHT * scale) / 2;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, mapWidth, mapHeight);
  context.fillStyle = '#101b2b';
  context.fillRect(0, 0, mapWidth, mapHeight);
  context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  context.fillStyle = '#27463e';
  context.fillRect(0, 0, CITY_WIDTH, CITY_HEIGHT);

  context.fillStyle = '#283647';
  for (let column = 0; column <= CITY_COLUMNS; column++) {
    context.fillRect(column * CITY_CELL - CITY_ROAD_WIDTH / 2, 0, CITY_ROAD_WIDTH, CITY_HEIGHT);
  }
  for (let row = 0; row <= CITY_ROWS; row++) {
    context.fillRect(0, row * CITY_CELL - CITY_ROAD_WIDTH / 2, CITY_WIDTH, CITY_ROAD_WIDTH);
  }

  if (racePark) {
    context.fillStyle = '#355548';
    context.fillRect(racePark.x, racePark.y, racePark.w, racePark.h);
  }
  context.fillStyle = 'rgba(226, 211, 176, 0.9)';
  for (const building of buildings) {
    context.fillRect(building.x, building.y, building.w, building.h);
  }

  if (raceTrack?.points?.length) {
    context.beginPath();
    raceTrack.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.strokeStyle = '#76e4c8';
    context.lineWidth = 8;
    context.stroke();
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  const dot = (position, radius, color, outline = null) => {
    if (!position) return;
    const mapped = GameRules.worldToMinimap(position, CITY_WIDTH, CITY_HEIGHT, mapWidth, mapHeight);
    if (!mapped) return;
    context.beginPath();
    context.arc(mapped.x, mapped.y, Math.max(1, radius * mapped.scale), 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    if (outline) {
      context.strokeStyle = outline;
      context.lineWidth = 5;
      context.stroke();
    }
  };
  if (extractionZone) dot(extractionZone.pos, 90, '#56d7c0', '#e9fff2');
  for (const item of foodItems) if (!item.collected) dot(item.pos, 12, '#f3d36e');
  for (const vacuum of vacuumPatrollers) dot(vacuum.pos, 20, vacuum.chasing ? '#f07162' : '#e5a95d');
  for (const cat of strayCats) dot(cat.pos, 14, cat.color || '#e5d6bf');
  for (const cat of followers) dot(cat.pos, 14, cat.color || '#e5d6bf');
  for (const firefly of fireflies) dot(firefly.pos, 18, firefly.color);
  for (const cat of extraGardenCats()) dot(cat.pos, 22, '#f7d778');
  if (gardenMissions?.active) dot(gardenMissions.active.beacon.pos, 55, '#f7d778');
  if (playerCat) dot(playerCat.pos, 22, '#f4f0df', '#d47755');
}

function trackMovementKeyDown(event) {
  if (event.code === 'Tab' && ['race', 'raceCountdown'].includes(gameState)) {
    event.preventDefault();
    if (!event.repeat && raceParticipants.length) {
      watchedRacer = raceParticipants[(raceParticipants.indexOf(watchedRacer) + 1) % raceParticipants.length];
      showToast(`Caméra : ${watchedRacer.name} · son propre cerveau pilote`);
    }
    return;
  }
  const pressed = GameRules.normalizeMovementKey(event.key, event.code);
  if (pressed === 'd' && ['race', 'raceCountdown'].includes(gameState)) {
    if (!event.repeat) raceDebugEnabled = !raceDebugEnabled;
    keysDown.delete('d');
    event.preventDefault();
    return;
  }
  if (pressed === ' ') {
    event.preventDefault();
    if (!event.repeat) deployDecoy();
    return;
  }
  if (['w', 'a', 's', 'd', 'z', 'q', '>', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(pressed)) {
    keysDown.add(pressed);
    if (pressed.startsWith('arrow') || pressed === ' ') event.preventDefault();
  }
}

function trackMovementKeyUp(event) {
  keysDown.delete(GameRules.normalizeMovementKey(event.key, event.code));
}

function updateRaceDebugHud() {
  if (!hud?.raceDebugPanel) return;
  const visible = raceDebugEnabled && gameState === 'race';
  hud.raceDebugPanel.hidden = !visible;
  if (!visible) return;

  const subject = watchedRacer || playerCat;
  const inputs = subject.raceInputs || [];
  const outputs = subject.raceOutputs || [];
  hud.raceDebugMode.textContent = `${subject.name} · PILOTAGE 100 % NEURONAL · 8–20–2`;
  hud.raceDebugInputs.textContent = inputs.map(value => Number(value).toFixed(2)).join(' · ');
  hud.raceDebugOutputs.textContent = outputs.map(value => Number(value).toFixed(2)).join(' · ');
}

function drawFoodPickup(item) {
  const bob = Math.sin(frameCount * 0.07 + item.phase) * 2;
  push();
  translate(item.pos.x, item.pos.y + bob);
  noStroke();
  fill(248, 226, 151, 45 + Math.sin(frameCount * 0.08 + item.phase) * 12);
  circle(0, 0, 46);
  fill(48, 54, 43, 55);
  ellipse(0, 11, 34, 13);
  if (item.kind === 'pate') {
    fill('#f0d4a0');
    rect(-14, -9, 28, 18, 4);
    fill('#b87950');
    rect(-11, -6, 22, 12, 4);
    fill('#f3d69d');
    ellipse(0, 0, 14, 7);
    fill('#fff4d6');
    rect(-14, -11, 28, 4, 2);
    fill('#6c5441');
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(5);
    text('PATE', 0, 1);
  } else {
    fill('#f0d7a0');
    rect(-14, -10, 28, 20, 5);
    fill('#fff0c4');
    rect(-9, -8, 18, 16, 3);
    fill('#8e7245');
    for (const [x, y] of [[-5, -3], [2, -4], [5, 3], [-2, 4]]) {
      push();
      translate(x, y);
      rotate(frameCount * 0.02 + item.phase);
      ellipse(0, 0, 4, 3);
      pop();
    }
    fill('#74583b');
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(4.5);
    text('MIAOU', 0, 8);
  }
  pop();
}

function drawFirefly(firefly) {
  const pulse = (Math.sin(frameCount * 0.12 + firefly.phase) + 1) * 0.5;
  push();
  translate(firefly.pos.x, firefly.pos.y - 5);
  noStroke();
  drawingContext.save();
  drawingContext.globalAlpha = 0.08 + pulse * 0.06;
  fill(firefly.color);
  circle(0, 0, 30 + pulse * 10);
  drawingContext.globalAlpha = 0.3 + pulse * 0.2;
  circle(0, 0, 13 + pulse * 3);
  drawingContext.restore();
  fill('#fffde5');
  circle(0, 0, 4 + pulse * 2);
  pop();
}

function drawVacuum(vacuum) {
  push();
  translate(vacuum.pos.x, vacuum.pos.y);
  rotate(vacuum.vel.magSq() > 0.02 ? vacuum.vel.heading() : 0);
  noStroke();
  fill(5, 12, 24, 90);
  ellipse(0, 11, 56, 24);
  if (vacuum.chasing) fill(237, 139, 216, 180);
  else fill(158, 199, 230, 180);
  ellipse(-15, -4, 25, 35);
  ellipse(15, -4, 25, 35);
  fill(vacuum.chasing ? '#f2a6e0' : '#d7e6f2');
  ellipse(-15, -5, 13, 22);
  ellipse(15, -5, 13, 22);
  fill('#51486f');
  ellipse(0, 1, 11, 31);
  fill(vacuum.chasing ? '#ff91a4' : '#f7e77c');
  circle(0, -8, 8 + Math.sin(vacuum.spin) * 2);
  stroke('#c4d6ed');
  strokeWeight(2);
  noFill();
  bezier(-2, -12, -8, -22, -7, -22, -11, -24);
  bezier(2, -12, 8, -22, 7, -22, 11, -24);
  if (vacuum.chasing) {
    noStroke();
    fill('#fff0d4');
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(15);
    text('✦', 0, -31);
  }
  pop();
}

function drawRaceTrack() {
  if (!racePark) return;
  noStroke();
  fill('#315447');
  rect(racePark.x, racePark.y, racePark.w, racePark.h, 18);
  fill('#44685a');
  rect(racePark.x + 9, racePark.y + 9, racePark.w - 18, racePark.h - 18, 14);
  stroke('#a7e8cf');
  strokeWeight(raceTrack.width + 14);
  noFill();
  drawRaceOval();
  stroke('#233842');
  strokeWeight(raceTrack.width);
  drawRaceOval();
  stroke('#e6dfc5');
  strokeWeight(2);
  drawingContext.setLineDash([13, 14]);
  drawRaceOval();
  drawingContext.setLineDash([]);

  for (let index = 5; index < raceTrack.checkpoints.length; index += 5) {
    const checkpoint = raceTrack.checkpoints[index];
    stroke(Math.floor(index / 5) % 2 ? '#b3fff0' : '#b889ff');
    strokeWeight(4);
    line(checkpoint.a.x, checkpoint.a.y, checkpoint.b.x, checkpoint.b.y);
  }

  const startCheckpoint = raceTrack.checkpoints[0];
  stroke('#fff2a6');
  strokeWeight(7);
  line(startCheckpoint.a.x, startCheckpoint.a.y, startCheckpoint.b.x, startCheckpoint.b.y);
  noStroke();
  fill('#d2e9d1');
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(BOLD);
  text('COURSE DES LUCIOLES', raceTrack.center.x, raceTrack.center.y);
  textStyle(NORMAL);
}

function drawRaceOval() {
  beginShape();
  for (const point of raceTrack.points) vertex(point.x, point.y);
  endShape(CLOSE);
}

function drawRacer(cat) {
  drawTownCat(cat, cat === playerCat);
  if (gameState !== 'race' && gameState !== 'raceCountdown') return;
  if (raceDebugEnabled) {
    for (const sensor of cat.raceSensorReadings || []) {
      stroke(sensor.distance < 35 ? '#ef6a54' : '#e3be68');
      strokeWeight(1.5);
      line(cat.pos.x, cat.pos.y, sensor.end.x, sensor.end.y);
      noStroke();
      fill(sensor.distance < 35 ? '#ef6a54' : '#e3be68');
      circle(sensor.end.x, sensor.end.y, 5);
    }
  }
  const rank = getRaceStandings().indexOf(cat) + 1;
  push();
  noStroke();
  fill('#faf7ed');
  circle(cat.pos.x, cat.pos.y - 28, 19);
  fill(rank === 1 ? '#9b7542' : '#596957');
  textAlign(CENTER, CENTER);
  textSize(10);
  text(String(rank), cat.pos.x, cat.pos.y - 28);
  pop();
}

function drawTownGround() {
  noStroke();
  fill('#101b2b');
  rect(0, 0, CITY_WIDTH, CITY_HEIGHT);

  for (let row = 0; row < CITY_ROWS; row++) {
    for (let column = 0; column < CITY_COLUMNS; column++) {
      const x = column * CITY_CELL + CITY_ROAD_WIDTH / 2;
      const y = row * CITY_CELL + CITY_ROAD_WIDTH / 2;
      const w = CITY_CELL - CITY_ROAD_WIDTH;
      const h = CITY_CELL - CITY_ROAD_WIDTH;
      fill((column + row) % 2 ? '#29483e' : '#315345');
      rect(x, y, w, h, 12);
      stroke('#52725d');
      strokeWeight(2);
      noFill();
      rect(x + 9, y + 9, w - 18, h - 18, 9);
      noStroke();
    }
  }

  fill('#273647');
  for (let x = CITY_CELL; x < CITY_WIDTH; x += CITY_CELL) {
    rect(x - CITY_ROAD_WIDTH / 2 - 8, 0, 16, CITY_HEIGHT);
  }
  for (let y = CITY_CELL; y < CITY_HEIGHT; y += CITY_CELL) {
    rect(0, y - CITY_ROAD_WIDTH / 2 - 8, CITY_WIDTH, 16);
  }
}

function drawStreets() {
  noStroke();
  fill('#26394b');
  for (let x = CITY_CELL; x < CITY_WIDTH; x += CITY_CELL) {
    rect(x - CITY_ROAD_WIDTH / 2, 0, CITY_ROAD_WIDTH, CITY_HEIGHT);
  }
  for (let y = CITY_CELL; y < CITY_HEIGHT; y += CITY_CELL) {
    rect(0, y - CITY_ROAD_WIDTH / 2, CITY_WIDTH, CITY_ROAD_WIDTH);
  }

  stroke('#617d79');
  strokeWeight(1.5);
  drawingContext.setLineDash([14, 28]);
  for (let x = CITY_CELL; x < CITY_WIDTH; x += CITY_CELL) {
    line(x, 0, x, CITY_HEIGHT);
  }
  for (let y = CITY_CELL; y < CITY_HEIGHT; y += CITY_CELL) {
    line(0, y, CITY_WIDTH, y);
  }
  drawingContext.setLineDash([]);
}

function drawBuilding(building) {
  const { x, y, w, h, color, roofStyle } = building;
  noStroke();
  fill(37, 48, 46, 36);
  rect(x + 9, y + 12, w, h, 13);
  fill('#b8aa92');
  rect(x - 5, y - 5, w + 10, h + 10, 13);
  fill(color);
  rect(x, y, w, h, 10);

  fill(255, 240, 211, 115);
  if (roofStyle === 0) {
    rect(x + 12, y + 13, w - 24, 8, 4);
    rect(x + 12, y + h - 22, w - 24, 8, 4);
  } else if (roofStyle === 1) {
    rect(x + w * 0.23, y + h * 0.2, w * 0.54, h * 0.55, 8);
    fill(95, 108, 101, 90);
    rect(x + w * 0.34, y + h * 0.29, w * 0.32, h * 0.37, 5);
  } else {
    fill(255, 238, 205, 130);
    rect(x + w * 0.42, y + 14, w * 0.16, h - 28, 5);
    rect(x + 13, y + h * 0.42, w - 26, h * 0.16, 5);
  }

  fill(250, 236, 202, 155);
  circle(x + w - 19, y + 18, 5);
}

function drawTree(tree) {
  noStroke();
  fill(4, 12, 20, 105);
  ellipse(tree.x + 4, tree.y + 9, tree.r * 2.4, tree.r * 1.6);
  fill('#715d55');
  rect(tree.x - 3, tree.y - 1, 6, 17, 3);
  fill('#365d51');
  circle(tree.x, tree.y - 6, tree.r * 2);
  fill('#47775f');
  circle(tree.x - tree.r * 0.32, tree.y - tree.r * 0.25, tree.r * 0.95);
  fill('#66946d');
  circle(tree.x + tree.r * 0.28, tree.y - tree.r * 0.34, tree.r * 0.72);
  fill('#f2d881');
  for (const [x, y] of [[-tree.r * 0.45, tree.r * 0.32], [tree.r * 0.48, tree.r * 0.18], [0, -tree.r * 0.18]]) {
    circle(tree.x + x, tree.y + y, 4);
  }
}

function drawStreetDetails() {
  noStroke();
  fill(168, 216, 196, 80);
  for (let x = CITY_CELL; x < CITY_WIDTH; x += CITY_CELL) {
    for (let row = 0; row < CITY_ROWS; row++) {
      const y = row * CITY_CELL + CITY_CELL / 2;
      for (let offset = -1; offset <= 1; offset++) circle(x, y + offset * 20, 7);
    }
  }
  for (let y = CITY_CELL; y < CITY_HEIGHT; y += CITY_CELL) {
    for (let column = 0; column < CITY_COLUMNS; column++) {
      const x = column * CITY_CELL + CITY_CELL / 2;
      for (let offset = -1; offset <= 1; offset++) circle(x + offset * 20, y, 7);
    }
  }

  noStroke();
  fill(247, 231, 124, 28);
  for (let column = 0; column < CITY_COLUMNS; column++) {
    for (let row = 0; row < CITY_ROWS; row++) {
      if ((column + row) % 2 !== 0) continue;
      const x = column * CITY_CELL + CITY_CELL * 0.78;
      const y = row * CITY_CELL + CITY_CELL * 0.22;
      circle(x, y, 34);
      fill('#f7e77c');
      circle(x, y, 7);
      fill(247, 231, 124, 28);
    }
  }
}

function drawTownCat(cat, isPlayer = false) {
  const heading = isPlayer && gameState === 'running'
    ? cat.facingHeading
    : cat.vel.magSq() > 0.035 ? cat.vel.heading() : -HALF_PI;
  const idlePhase = cat.idlePhase || 0;
  const bob = cat.vel.magSq() > 0.05 ? Math.sin(frameCount * 0.22 + idlePhase) * 1.5 : Math.sin(frameCount * 0.045 + idlePhase) * 0.6;
  push();
  translate(cat.pos.x, cat.pos.y + bob);
  rotate(heading);
  noStroke();
  fill(39, 46, 40, 42);
  ellipse(-1, 8, 32, 17);
  noFill();
  stroke(cat.color);
  strokeWeight(4);
  drawingContext.lineCap = 'round';
  bezier(-17, 3, -28, -1, -25, -13, -15, -10);
  noStroke();
  fill(cat.color);
  ellipse(-3, 1, 27, 18);
  ellipse(10, -3, 18, 17);
  triangle(3, -9, 4, -21, 12, -10);
  triangle(12, -10, 20, -19, 21, -5);
  fill('#e9a49a');
  triangle(6, -11, 6, -17, 10, -11);
  triangle(15, -11, 19, -16, 19, -8);
  fill('#f8ecd8');
  circle(15, -5, 5);
  fill('#34413a');
  circle(16, -5, 2.2);
  fill('#c78970');
  triangle(21, 0, 25, 2, 21, 4);
  if (isPlayer) {
    noFill();
    stroke('#f1d699');
    strokeWeight(2);
    arc(0, 1, 38, 31, -2.7, -0.35);
    if (playerStunTimer > 0) {
      noStroke();
      fill('#f0a05b');
      circle(0, -30, 16);
      fill('#fff7e8');
      textAlign(CENTER, CENTER);
      textStyle(BOLD);
      textSize(12);
      text('!', 0, -30);
    }
  }
  if (Vehicle.debug) {
    noFill();
    stroke(0, 245, 255, 140);
    strokeWeight(1);
    circle(0, 0, (cat.r_pourDessin || 20) * 2);
    stroke(255, 80, 80, 180);
    line(0, 0, 35, 0);
  }
  pop();
}

function updateInterface() {
  const allNearbyCats = strayCats
    .map(cat => ({ cat, distance: p5.Vector.dist(cat.pos, playerCat.pos) }))
    .sort((a, b) => a.distance - b.distance);
  const closestCat = allNearbyCats.find(entry => entry.distance < 125);
  const hungryCat = carriedFood > 0 && allNearbyCats
    .find(entry => entry.distance < 125 && !entry.cat.isFed);
  nearestStray = hungryCat ? hungryCat.cat : closestCat ? closestCat.cat : null;
  hud.companions.textContent = `${followers.length} ${followers.length === 1 ? 'chat' : 'chats'} dans ta bande`;
  hud.food.textContent = `${carriedFood} / ${FOOD_CAPACITY} · ${fedCatNames.size} nourri${fedCatNames.size === 1 ? '' : 's'}`;
  hud.coins.textContent = String(coins);
  hud.difficulty.textContent = `${raceLevel} / ${RACE_LEVELS}`;
  const quota = GameRules.rescueQuota(rescueMissionLevel);
  if (hud.missionTitle) hud.missionTitle.textContent = rescueMissionsCompleted
    ? `Contrat ${rescueMissionLevel} · ${['Le Repérage', 'La Tournée', 'Le Grand Sauvetage'][rescueMissionLevel - 1]}`
    : 'Mission · Opération Croquettes';
  if (hud.missionProgress) hud.missionProgress.textContent =
    `${Math.min(followers.length, quota)} / ${quota} chats · refuge au sud`;
  if (gardenMissions?.active) {
    hud.missionTitle.textContent = gardenMissions.active.title;
    hud.missionProgress.textContent = gardenMissions.active.hint || 'Rejoins le repère doré sur le radar';
  }
  if (hud.raceDifficulty) hud.raceDifficulty.disabled = ['race', 'raceCountdown'].includes(gameState) ||
    (gameState === 'paused' && ['race', 'raceCountdown'].includes(resumeGameState));
  if (hud.decoyBadge) {
    if (decoyCooldown > 0) {
      hud.decoyBadge.className = 'decoy-badge cooldown';
      hud.decoyBadge.textContent = `${Math.ceil(decoyCooldown)}s`;
    } else {
      hud.decoyBadge.className = 'decoy-badge ready';
      hud.decoyBadge.textContent = 'ESPACE';
    }
  }
  const column = constrain(Math.floor(playerCat.pos.x / CITY_CELL), 0, CITY_COLUMNS - 1);
  const row = constrain(Math.floor(playerCat.pos.y / CITY_CELL), 0, CITY_ROWS - 1);
  hud.district.textContent = DISTRICT_NAMES[row][column];
  const distanceToTrack = distanceToRaceTrack(playerCat.pos);
  const nearTrack = gameState === 'running' && distanceToTrack < 150;
  const nearRefuge = gameState === 'running' && extractionZone &&
    p5.Vector.dist(extractionZone.pos, playerCat.pos) < 145;
  const nearbyFood = foodItems.find(item => !item.collected &&
    p5.Vector.dist(item.pos, playerCat.pos) < 95);
  const nearbyVacuum = vacuumPatrollers
    .map(vacuum => ({ vacuum, distance: p5.Vector.dist(vacuum.pos, playerCat.pos) }))
    .filter(entry => entry.distance < VACUUM_ALERT_RADIUS)
    .sort((a, b) => a.distance - b.distance)[0];
  hud.hint.hidden = gameState !== 'running' ||
    (!nearestStray && !nearTrack && !nearbyFood && !nearbyVacuum && !nearRefuge);
  if (nearbyVacuum && nearbyVacuum.vacuum.chasing) {
    hud.hint.innerHTML = '<span class="hint-dot vacuum-dot"></span>Un papillon d’ombre te suit — continue de bouger !';
  } else if (nearbyFood && carriedFood >= FOOD_CAPACITY) {
    hud.hint.innerHTML = `<span class="hint-dot"></span>${nearbyFood.kind === 'pate' ? 'Pâtée' : 'Croquettes'} · sac plein, nourris un chat d’abord`;
  } else if (nearbyFood) {
    hud.hint.innerHTML = `<span class="hint-dot"></span>${nearbyFood.kind === 'pate' ? 'Pâtée' : 'Croquettes'} repérée · approche-toi pour ramasser`;
  } else if (nearTrack) {
    hud.hint.innerHTML = '<span class="hint-dot race-dot"></span>La course de la clairière approche — entre sur la piste !';
  } else if (nearRefuge) {
    const missing = Math.max(0, GameRules.rescueQuota(rescueMissionLevel) - followers.length);
    hud.hint.innerHTML = missing === 0
      ? '<span class="hint-dot rescue-dot"></span>Refuge atteint · ta bande est prête à être évacuée !'
      : `<span class="hint-dot rescue-dot"></span>Refuge · recrute encore ${missing} chat${missing === 1 ? '' : 's'} avec <kbd>E</kbd>`;
  } else if (nearestStray && gameState === 'running') {
    const canFeed = carriedFood > 0 && !nearestStray.isFed;
    hud.hint.innerHTML = canFeed
      ? `<span class="hint-dot"></span>${nearestStray.name} a faim <kbd>E</kbd> pour nourrir`
      : nearestStray.isFed
        ? `${nearestStray.name} est rassasié <kbd>E</kbd> pour l’inviter`
        : `${nearestStray.name} est tout près <kbd>E</kbd> pour l’inviter`;
  } else if (nearbyVacuum) {
    hud.hint.innerHTML = '<span class="hint-dot vacuum-dot"></span>Attention, un papillon d’ombre patrouille dans le coin';
  }

  if (gameState === 'raceCountdown') {
    hud.raceStatus.hidden = false;
    hud.raceStatus.innerHTML = `<span>COURSE DES LUCIOLES · ${getRaceDifficulty(raceDifficulty).label.toUpperCase()}</span><strong>${Math.max(1, Math.ceil(raceCountdown))}</strong><small>Zouin et ses amis courent avec leurs cerveaux · TAB change la caméra</small>`;
  } else if (gameState === 'race') {
    const leader = getRaceStandings()[0];
    const remaining = Math.max(0, Math.ceil(raceTimeLimit - raceElapsed));
    const progress = constrain(playerCat.raceProgress / raceTrack.points.length * 100, 0, 100);
    hud.raceStatus.hidden = false;
    hud.raceStatus.innerHTML = `<span>${getRaceDifficulty(raceDifficulty).label.toUpperCase()} · RESTE ${remaining}s</span><strong>${leader.name || 'Minou'} mène</strong><div class="race-lap-track" role="progressbar" aria-label="Progression du tour" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div><small>TOUR 1 / ${RACE_LAPS} · ${Math.floor(progress)}% · IA 8–20–2</small>`;
  } else {
    hud.raceStatus.hidden = true;
  }
}

function showToast(message) {
  hud.toast.textContent = message;
  hud.toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => { hud.toast.hidden = true; }, 2600);
}

function keyPressed(event) {
  const pressed = key.toLowerCase();
  if (pressed === 'd' && ['race', 'raceCountdown'].includes(gameState)) {
    return false;
  }
  if (pressed === 'p' || keyCode === ESCAPE) {
    togglePause();
    return false;
  }
  if (pressed === 'e') {
    if (gameState !== 'running' || event?.repeat) return false;
    const partner = conversations.start(playerCat, [...strayCats, ...followers, ...extraGardenCats()], audioFeedback);
    meowTargetCat = partner;
    meowBubbleTimer = 1.6;
    if (!partner) { showToast('Miaou ! Approche-toi d’un chat pour l’inviter avec E.'); return false; }
    if (strayCats.includes(partner) && !feedNearbyCat(partner)) inviteNearbyCat(partner);
    return false;
  }
  if (pressed === 'm') {
    if (gameState === 'running' && !event?.repeat) {
      meowTargetCat = null;
      meowBubbleTimer = 1.2;
      conversations.start(playerCat, [], audioFeedback);
    }
    return false;
  }
  if (['w', 'a', 's', 'd'].includes(pressed) || [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW].includes(keyCode)) {
    keysDown.add(pressed);
    if (keyCode === UP_ARROW) keysDown.add('arrowup');
    if (keyCode === DOWN_ARROW) keysDown.add('arrowdown');
    if (keyCode === LEFT_ARROW) keysDown.add('arrowleft');
    if (keyCode === RIGHT_ARROW) keysDown.add('arrowright');
    return false;
  }
}

function keyReleased() {
  const released = key.toLowerCase();
  keysDown.delete(released);
  if (keyCode === UP_ARROW) keysDown.delete('arrowup');
  if (keyCode === DOWN_ARROW) keysDown.delete('arrowdown');
  if (keyCode === LEFT_ARROW) keysDown.delete('arrowleft');
  if (keyCode === RIGHT_ARROW) keysDown.delete('arrowright');
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  city3DRenderer?.resize();
  updateCamera(1);
}
