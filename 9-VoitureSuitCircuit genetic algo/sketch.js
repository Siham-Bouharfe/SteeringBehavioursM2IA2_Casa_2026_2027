

const TOTAL = 100;
const MUTATION_RATE = 0.1;
const LIFESPAN = 25;
let generationCount = 0;

// Murs du circuit
let walls = [];
// rayon courant qui part de la voiture
let ray;

// Les voitures
let population = [];
let savedVehicles = [];

let start, end;

let speedSlider;
let currentTrackId = 'monaco';
let trackLayouts = {};
let trackPools = {};

let inside = [];
let outside = [];
let checkpoints = [];

const maxFitness = 500;

let changeMap = false;

/* construit un nouveau circuit */
function buildTrack(trackId = currentTrackId) {
  if (trackId !== 'random') {
    const centerline = createPresetCenterline(trackId, width, height);
    checkpoints = [];
    inside = [];
    outside = [];
    const halfTrackWidth = ACTIVE_CONFIG.trackWidth / 2;
    for (let i = 0; i < centerline.length; i++) {
      const previous = centerline[(i - 1 + centerline.length) % centerline.length];
      const next = centerline[(i + 1) % centerline.length];
      const tangent = createVector(next.x - previous.x, next.y - previous.y).normalize();
      const normalX = -tangent.y;
      const normalY = tangent.x;
      const center = centerline[i];
      const x1 = center.x - normalX * halfTrackWidth;
      const y1 = center.y - normalY * halfTrackWidth;
      const x2 = center.x + normalX * halfTrackWidth;
      const y2 = center.y + normalY * halfTrackWidth;
      checkpoints.push(new Boundary(x1, y1, x2, y2));
      inside.push(createVector(x1, y1));
      outside.push(createVector(x2, y2));
    }
    finishTrackGeometry();
    return;
  }

  checkpoints = [];
  inside = [];
  outside = [];

  let noiseMax = 4;
  const total = 60;
  const halfTrackWidth = ACTIVE_CONFIG.trackWidth / 2;
  let startX = random(1000);
  let startY = random(1000);
  for (let i = 0; i < total; i++) {
    let a = map(i, 0, total, 0, TWO_PI);
    let xoff = map(cos(a), -1, 1, 0, noiseMax) + startX;
    let yoff = map(sin(a), -1, 1, 0, noiseMax) + startY;
    let xr = map(noise(xoff, yoff), 0, 1, 100, width * 0.5);
    let yr = map(noise(xoff, yoff), 0, 1, 100, height * 0.5);
    let x1 = width / 2 + (xr - halfTrackWidth) * cos(a);
    let y1 = height / 2 + (yr - halfTrackWidth) * sin(a);
    let x2 = width / 2 + (xr + halfTrackWidth) * cos(a);
    let y2 = height / 2 + (yr + halfTrackWidth) * sin(a);
    checkpoints.push(new Boundary(x1, y1, x2, y2));
    inside.push(createVector(x1, y1));
    outside.push(createVector(x2, y2));
  }
  finishTrackGeometry();
}

function finishTrackGeometry() {
  walls = [];
  for (let i = 0; i < checkpoints.length; i++) {
    let a1 = inside[i];
    let b1 = inside[(i + 1) % checkpoints.length];
    walls.push(new Boundary(a1.x, a1.y, b1.x, b1.y));
    let a2 = outside[i];
    let b2 = outside[(i + 1) % checkpoints.length];
    walls.push(new Boundary(a2.x, a2.y, b2.x, b2.y));
  }

  start = checkpoints[0].midpoint();
  end = checkpoints[checkpoints.length - 1].midpoint();
}

function captureTrackLayout() {
  return { walls, checkpoints, inside, outside, start, end };
}

function restoreTrackLayout(layout) {
  ({ walls, checkpoints, inside, outside, start, end } = layout);
}

function createPopulation() {
  return Array.from({ length: TOTAL }, () => new Vehicle());
}

function saveCurrentTrackPool() {
  trackPools[currentTrackId] = { population, savedVehicles, generationCount };
}

function switchTrack(trackId) {
  if (trackId === currentTrackId) return;
  saveCurrentTrackPool();
  currentTrackId = trackId;

  if (trackLayouts[trackId]) {
    restoreTrackLayout(trackLayouts[trackId]);
  } else {
    buildTrack(trackId);
    trackLayouts[trackId] = captureTrackLayout();
  }

  if (trackPools[trackId]) {
    ({ population, savedVehicles, generationCount } = trackPools[trackId]);
  } else {
    population = createPopulation();
    savedVehicles = [];
    generationCount = 0;
    saveCurrentTrackPool();
  }
}

function setup() {
  createCanvas(1200, 800);
  currentTrackId = document.getElementById('track-select').value;

  // tensor flow will worj on the cpu
  tf.setBackend('cpu');

  buildTrack();
  // let a = inside[inside.length - 1];
  // let b = outside[outside.length - 1];
  // walls.push(new Boundary(a.x, a.y, b.x, b.y));

  // On crée les véhicules....
  population = createPopulation();
  trackLayouts[currentTrackId] = captureTrackLayout();
  saveCurrentTrackPool();

  speedSlider = document.getElementById('simulation-speed');
  setupSettingsPanel();
}

function setupSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');
  const setOpen = isOpen => {
    panel.hidden = !isOpen;
    toggle.hidden = isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
  };
  toggle.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });
  document.getElementById('track-select').addEventListener('change', event => switchTrack(event.target.value));

  const ids = ['sensor-range', 'sensor-count', 'sensor-angle', 'max-speed', 'track-width', 'hidden-neurons'];
  for (const id of ids) {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}-value`);
    input.addEventListener('input', () => {
      const suffix = id === 'sensor-range' || id === 'track-width' ? ' px' : id === 'sensor-angle' ? '°' : '';
      output.textContent = `${input.value}${suffix}`;
    });
  }
  document.getElementById('apply-settings').addEventListener('click', applySettings);
}

function applySettings() {
  const read = id => Number(document.getElementById(id).value);
  const nextConfig = {
    sensorRange: read('sensor-range'),
    sensorCount: read('sensor-count'),
    sensorAngle: read('sensor-angle'),
    maxSpeed: read('max-speed'),
    trackWidth: read('track-width'),
    hiddenNeurons: read('hidden-neurons'),
  };

  // Libère tous les cerveaux sauvegardés avant de reconstruire les circuits.
  const allVehicles = new Set([...population, ...savedVehicles]);
  for (const pool of Object.values(trackPools)) {
    for (const vehicle of [...pool.population, ...pool.savedVehicles]) allVehicles.add(vehicle);
  }
  for (const vehicle of allVehicles) vehicle.dispose();
  trackPools = {};
  trackLayouts = {};
  population = [];
  savedVehicles = [];
  ACTIVE_CONFIG = nextConfig;
  generationCount = 0;
  buildTrack();
  trackLayouts[currentTrackId] = captureTrackLayout();
  population = createPopulation();
  saveCurrentTrackPool();
}

// Appelée 60 fois / seconde
function draw() {
  const cycles = Number(speedSlider.value);
  background(0);

  // Par défaut le meilleur candidat est le premier de la population
  let bestP = population[0];

  // Nombre de cyles par frame ("époques par frame")
  for (let n = 0; n < cycles; n++) {
    // Pour chaque voiture
    for (let vehicle of population) {
      // On applique le comportement
      vehicle.applyBehaviors(walls);
      // on regarde si on a passé un checkpoint
      vehicle.check(checkpoints);
      // on vérifie qu'on est pas sorti du circuit
      //Vehicle.bounds();

      // classique.... on met à jour accelerations, vitesses et positions
      vehicle.update();
      // et on dessine
      vehicle.show();

      // Une fois les voitures déplacées
      // On récupère la meilleure, celle qui a passé le plus de checkpoints
      if (vehicle.fitness > bestP.fitness) {
        bestP = vehicle;
      }
    }


    // On supprime les voitures mortes ou celles qui ont fini le circuit
    for (let i = population.length - 1; i >= 0; i--) {
      const vehicle = population[i];
      if (vehicle.dead || vehicle.finished) {
        savedVehicles.push(population.splice(i, 1)[0]);
      }
    }

    // Si jamais on a plus de voitures, on passe à la génération suivante
    if (population.length == 0) {
      buildTrack(currentTrackId);
      trackLayouts[currentTrackId] = captureTrackLayout();
      nextGeneration();
      generationCount++;
    }
  }

  // on dessine les murs du circuit
  for (let wall of walls) {
    wall.show();
  }

  // On dessine les checkpoints du circuit
  for (let cp of checkpoints) {
    push();
    stroke("blue");
    strokeWeight(2);
    // un checkpoint est une ligne entre cp.a et cp.b
    line(cp.a.x, cp.a.y, cp.b.x, cp.b.y);
    pop();
  }

  // On dessine les voitures
  for (let vehicle of population) {
    vehicle.show();
  }

  // On met la voiture la meilleure en surbrillance
  bestP.highlight();

  // on affiche le numéro de la génération
  fill(255);
  textSize(24);
  noStroke();
  text('generation ' + generationCount, 10, 50);
  const trackName = currentTrackId === 'random' ? 'Circuit aléatoire' : TRACK_PRESETS[currentTrackId].label;
  text(trackName, 10, 78);
  saveCurrentTrackPool();

  // ellipse(start.x, start.y, 10);
  // ellipse(end.x, end.y, 10);
}
