/**
 * main.js — SteerWorld Game Hub
 * Main loop, state router, animated menu canvas, and input dispatcher.
 */

let currentMode = 'menu'; // 'menu' | 'city' | 'evo' | 'race'
let cityMode = null;
let evoMode = null;
let raceMode = null;
let uiManager = null;

// Background particles for interactive menu
let menuParticles = [];
let menuTargets = [];

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);

  uiManager = new UIManager();

  // Create ambient seeking particles for the main menu
  for (let i = 0; i < 40; i++) {
    menuParticles.push({
      pos: new Vector2(Math.random() * width, Math.random() * height),
      vel: Vector2.random2D().mul(2),
      acc: Vector2.zero(),
      maxSpeed: 3.5,
      maxForce: 0.15,
      color: i % 2 === 0 ? [0, 245, 255] : [255, 0, 170]
    });
  }

  for (let i = 0; i < 4; i++) {
    menuTargets.push({
      pos: new Vector2(Math.random() * width, Math.random() * height),
      vel: Vector2.random2D().mul(1.5)
    });
  }

  // Hide loading screen smoothly
  const loading = document.getElementById('loading-screen');
  if (loading) {
    setTimeout(() => {
      loading.classList.add('fade-out');
      setTimeout(() => loading.classList.add('gone'), 500);
    }, 400);
  }

  showMenu();
}

function draw() {
  if (currentMode === 'menu') {
    drawMenuBackground();
  } else if (currentMode === 'city' && cityMode) {
    cityMode.handleInput(keyIsDown, window);
    cityMode.update();
    cityMode.draw(window);
    uiManager.update('city', cityMode);
  } else if (currentMode === 'evo' && evoMode) {
    evoMode.update();
    evoMode.draw(window);
    uiManager.update('evo', evoMode);
  } else if (currentMode === 'race' && raceMode) {
    raceMode.update();
    raceMode.draw(window);
    uiManager.update('race', raceMode);
  }
}

function drawMenuBackground() {
  background(13, 17, 23);

  // Subtle animated cyber grid
  stroke(255, 255, 255, 6);
  strokeWeight(1);
  const t = frameCount * 0.5;
  for (let x = 0; x < width; x += 60) line(x, 0, x, height);
  for (let y = 0; y < height; y += 60) line(0, y, width, y);

  // Update wandering targets
  for (const tgt of menuTargets) {
    tgt.pos.add(tgt.vel);
    if (tgt.pos.x < 0 || tgt.pos.x > width) tgt.vel.x *= -1;
    if (tgt.pos.y < 0 || tgt.pos.y > height) tgt.vel.y *= -1;
  }

  // Update & draw seeking particles
  for (let i = 0; i < menuParticles.length; i++) {
    const pt = menuParticles[i];
    const tgt = menuTargets[i % menuTargets.length];

    // Mouse attraction if inside window
    let targetPos = tgt.pos;
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
      if (Vector2.dist(pt.pos, { x: mouseX, y: mouseY }) < 250) {
        targetPos = new Vector2(mouseX, mouseY);
      }
    }

    const seekForce = SteeringBehaviors.seek(pt.pos, pt.vel, targetPos, pt.maxSpeed, pt.maxForce);
    pt.acc.add(seekForce);
    pt.vel.add(pt.acc).limit(pt.maxSpeed);
    pt.pos.add(pt.vel);
    pt.acc = Vector2.zero();

    noStroke();
    fill(pt.color[0], pt.color[1], pt.color[2], 160);
    circle(pt.pos.x, pt.pos.y, 4);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (cityMode) { cityMode.w = windowWidth; cityMode.h = windowHeight; cityMode.initObstacles(); cityMode.initRoadPath(); }
  if (evoMode)  { evoMode.w = windowWidth; evoMode.h = windowHeight; }
  if (raceMode) { raceMode.w = windowWidth; raceMode.h = windowHeight; raceMode.initCircuit(); }
}

function mousePressed() {
  // If in Evo Mode and click is outside UI panels, spawn food/poison
  if (currentMode === 'evo' && evoMode) {
    const isShift = keyIsDown(SHIFT);
    evoMode.handleMouse(mouseX, mouseY, isShift);
  }
}

function keyPressed() {
  if (key === 'd' || key === 'D') {
    if (cityMode) cityMode.debug = !cityMode.debug;
  }
  if (key === 'e' || key === 'E') {
    if (evoMode) evoMode.showDebug = !evoMode.showDebug;
  }
}

/* ── Mode Transitions ────────────────────────────────────── */

function showMenu() {
  currentMode = 'menu';
  if (uiManager) uiManager.setMode('menu');
}

function startCity() {
  cityMode = new CityMode(windowWidth, windowHeight);
  currentMode = 'city';
  if (uiManager) {
    uiManager.setMode('city');
    uiManager.showToast('Mode Ville activé ! Contrôle avec ZQSD / Flèches');
  }
}

function startEvo() {
  evoMode = new EvoMode(windowWidth, windowHeight);
  currentMode = 'evo';
  if (uiManager) {
    uiManager.setMode('evo');
    uiManager.showToast('Mode Évolution activé ! Clic = Nourriture, Shift+Clic = Poison');
  }
}

function startRace() {
  raceMode = new RaceMode(windowWidth, windowHeight);
  currentMode = 'race';
  if (uiManager) {
    uiManager.setMode('race');
    uiManager.showToast('Mode Course activé ! Les voitures apprennent via TensorFlow.js');
  }
}

