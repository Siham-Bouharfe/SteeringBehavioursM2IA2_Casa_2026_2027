let targets = [];
const vehicles = [];
let sceneCanvas;
let seekSettings;
let ambientMusic;
let gradientSpeed = 1;
let gradientIntensity = 1;
let backgroundMouse = { x: 0, y: 0, initialized: false };
let activeScenario = 'seek';
let targetCount = 2;
let detectionRadius = 200;
let debugMode = false;
let confetti = [];
let lures = [];
let targetRespawnAt = null;

function sceneHeight() {
  return Math.max(1, windowHeight - document.getElementById('controls').offsetHeight);
}

function setup() {
  sceneCanvas = createCanvas(windowWidth, sceneHeight());
  sceneCanvas.parent('scene');
  backgroundMouse = { x: width / 2, y: height / 2, initialized: true };
  targets = [];
  confetti = [];
  lures = [];
  targetRespawnAt = null;
  for (let index = 0; index < targetCount; index++) targets.push(createTarget(index));
  seekSettings = new SeekSettings(4, 0.2);
  ambientMusic = new AmbientMusic();

  bindParameterSlider('max-speed', 'max-speed-value', value => seekSettings.setMaxSpeed(value));
  bindParameterSlider('max-force', 'max-force-value', value => seekSettings.setMaxForce(value));
  bindParameterSlider('gradient-speed', 'gradient-speed-value', value => gradientSpeed = Number(value));
  bindParameterSlider('gradient-intensity', 'gradient-intensity-value', value => gradientIntensity = Number(value));
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('simulation-menu');
  settingsToggle.addEventListener('click', () => {
    const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
    settingsToggle.setAttribute('aria-expanded', String(!expanded));
    settingsPanel.hidden = expanded;
    requestAnimationFrame(() => resizeCanvas(windowWidth, sceneHeight()));
  });
  const targetCountSlider = document.getElementById('target-count');
  const targetCountOutput = document.getElementById('target-count-value');
  targetCountSlider.addEventListener('input', () => {
    targetCount = Number(targetCountSlider.value);
    targetCountOutput.value = targetCount;
    while (targets.length > targetCount) targets.pop();
    while (targets.length < targetCount) targets.push(createTarget(targets.length));
  });
  const detectionSlider = document.getElementById('detection-radius');
  const detectionOutput = document.getElementById('detection-radius-value');
  detectionSlider.addEventListener('input', () => {
    detectionRadius = Number(detectionSlider.value);
    detectionOutput.value = `${detectionRadius} px`;
    for (const target of targets) {
      if (target instanceof CibleFuyante) target.detectionRadius = detectionRadius;
    }
  });
  document.getElementById('scenario').addEventListener('change', event => {
    activeScenario = event.target.value;
    targetRespawnAt = null;
    lures.length = 0;
    targets.length = 0;
    for (let index = 0; index < targetCount; index++) targets.push(createTarget(index));
  });

  const musicButton = document.getElementById('music-toggle');
  const audioStatus = document.getElementById('audio-status');
  document.addEventListener('pointerdown', () => {
    ambientMusic.unlock().catch(() => {});
  }, { once: true });
  musicButton.addEventListener('click', async () => {
    try {
      const enabled = await ambientMusic.toggle();
      if (enabled === null) {
        musicButton.textContent = 'Audio indisponible';
        audioStatus.value = ambientMusic.errorMessage || 'Web Audio non disponible';
      } else if (enabled) {
        musicButton.textContent = 'Couper la musique';
        audioStatus.value = 'Musique FM active';
      } else {
        musicButton.textContent = 'Activer la musique';
        audioStatus.value = 'Audio désactivé';
      }
    } catch (error) {
      musicButton.textContent = 'Audio indisponible';
      audioStatus.value = error.message || 'Le navigateur a bloqué le son';
    }
  });

  const slider = document.getElementById('vehicle-count');
  slider.value = SeekPopulation.INITIAL_COUNT;
  SeekPopulation.bindSlider(slider, document.getElementById('vehicle-count-value'),
    vehicles, targets, () => ({ width, height }), (x, y) => new FleeVehicle(x, y));

  let lastPointer = null;
  sceneCanvas.elt.addEventListener('pointermove', event => {
    const rect = sceneCanvas.elt.getBoundingClientRect();
    const x = constrain((event.clientX - rect.left) * width / rect.width, 0, width);
    const y = constrain((event.clientY - rect.top) * height / rect.height, 0, height);
    const now = event.timeStamp;
    ambientMusic.setPointerPosition(x, width);
    if (lastPointer) {
      ambientMusic.setPointerMotion(
        x - lastPointer.x,
        y - lastPointer.y,
        width,
        height,
        now - lastPointer.time
      );
    }
    backgroundMouse = { x, y, initialized: true };
    lastPointer = { x, y, time: now };
  });
}

function createTarget(index) {
  const x = width * ((index + 1) / (targetCount + 1));
  const y = height * (0.3 + 0.4 * (index % 2));
  return activeScenario === 'flee'
    ? new CibleFuyante(x, y, detectionRadius)
    : new Target(x, y);
}

function releaseLures(target) {
  if (!target.escapeThreat) return;
  const awayAngle = Math.atan2(
    target.pos.y - target.escapeThreat.pos.y,
    target.pos.x - target.escapeThreat.pos.x
  );
  for (const offset of [-0.78, 0.78]) {
    const angle = awayAngle + offset;
    const position = Leurre.launchPosition(target, angle);
    const lure = new Leurre(position.x, position.y, angle);
    lure.maxSpeed = seekSettings.maxSpeed;
    lure.maxForce = seekSettings.maxForce;
    lures.push(lure);
  }
}

function createConfettiBurst(x, y, pieces) {
  for (let index = 0; index < pieces; index++) {
    const angle = (Math.PI * 2 * index) / pieces + random(-0.16, 0.16);
    confetti.push(new Confetti(x, y, angle, index));
  }
}

function syncTargetGroups(allTargets) {
  const mainTargets = allTargets.filter(target => !(target instanceof Leurre));
  const decoys = allTargets.filter(target => target instanceof Leurre);
  targets.splice(0, targets.length, ...mainTargets);
  lures.splice(0, lures.length, ...decoys);
}

function bindParameterSlider(id, outputId, onChange) {
  const slider = document.getElementById(id);
  const output = document.getElementById(outputId);
  const update = () => {
    output.value = slider.value;
    onChange(slider.value);
  };
  slider.addEventListener('input', update);
  update();
}

function drawHypnoticBackground(musicLevel, modulation) {
  const time = millis() * 0.00012 * gradientSpeed;
  const pulse = (musicLevel * 5 + (modulation.wave + 1) * 1.5) * gradientIntensity;
  const pointerX = backgroundMouse.initialized ? backgroundMouse.x : width / 2;
  const pointerY = backgroundMouse.initialized ? backgroundMouse.y : height / 2;
  const centerX = pointerX;
  const centerY = pointerY;
  const radius = Math.max(width, height) * (0.88 + pulse * 0.015) * gradientIntensity;
  const context = drawingContext;
  const gradient = context.createRadialGradient(
    centerX, centerY, Math.max(1, radius * 0.025), centerX, centerY, radius
  );
  const palette = [
    { stop: 0, hue: 345, saturation: 84, lightness: 66 }, // rose
    { stop: 0.2, hue: 352, saturation: 88, lightness: 62 }, // rouge corail
    { stop: 0.4, hue: 12, saturation: 88, lightness: 69 }, // saumon
    { stop: 0.6, hue: 31, saturation: 92, lightness: 63 }, // orange
    { stop: 0.8, hue: 205, saturation: 70, lightness: 53 }, // bleu horizon
    { stop: 1, hue: 225, saturation: 74, lightness: 34 }, // bleu soir
  ];
  for (let index = 0; index < palette.length; index++) {
    const color = palette[index];
    const drift = Math.sin(time * 0.7 + modulation.phase * 0.14 + index * 0.8) * 5;
    const hueDrift = Math.sin(time * 0.35 + index) * 3;
    gradient.addColorStop(color.stop,
      `hsl(${color.hue + hueDrift} ${color.saturation}% ${constrain(color.lightness + drift + pulse * 0.18, 24, 78)}%)`);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  push();
  noFill();
  translate(centerX, centerY);
  rotate(time * (0.28 + modulation.frequency * 0.05) + pulse * 0.03);
  const ringHues = [345, 352, 12, 31, 205, 225];
  for (let index = 0; index < 11; index++) {
    const wave = sin(modulation.phase * 0.6 + index * 0.42) * (8 + pulse * 2);
    const size = radius * (0.15 + index * 0.055) + wave;
    colorMode(HSB, 360, 100, 100, 255);
    stroke(ringHues[index % ringHues.length], 65, 96, 12 + pulse * 0.8);
    strokeWeight(1.5 + pulse * 0.04);
    ellipse(0, 0, size, size * (0.78 + 0.035 * sin(time * 0.4 + index)));
  }
  colorMode(RGB, 255);
  pop();
}

function draw() {
  const musicLevel = ambientMusic.getLevel();
  const modulation = ambientMusic.advanceModulation(deltaTime / 1000);
  drawHypnoticBackground(musicLevel, modulation);
  seekSettings.applyTo(vehicles);
  seekSettings.applyTo([...targets, ...lures]);
  for (const target of targets) {
    target.update(activeScenario === 'flee' ? vehicles : []);
    target.edges();
    target.sampleBackground(get(constrain(target.pos.x, 0, width - 1),
      constrain(target.pos.y, 0, height - 1)));
    if (target instanceof CibleFuyante && target.consumeLureBurst()) releaseLures(target);
  }
  for (const lure of lures) {
    lure.update();
    lure.edges();
  }
  lures = lures.filter(lure => !lure.isExpired());

  let activeTargets = targets.concat(lures);
  const collisions = TargetCollisions.resolve(activeTargets);
  for (const collision of collisions) {
    createConfettiBurst(collision.x, collision.y, Math.max(4, Math.floor(240 / collisions.length)));
  }
  if (collisions.length) syncTargetGroups(activeTargets);
  if (collisions.length && targets.length === 0) {
    SeekPopulation.ensureTargetCount(targets, targetCount, createTarget);
    targetRespawnAt = null;
  } else if (collisions.length && targets.length < targetCount) {
    targetRespawnAt = millis() + 1100;
  }
  if (targetRespawnAt !== null && millis() >= targetRespawnAt) {
    while (targets.length < targetCount) targets.push(createTarget(targets.length));
    targetRespawnAt = null;
  }

  activeTargets = targets.concat(lures);
  for (const vehicle of vehicles) {
    const handleArrival = caughtVehicle => {
      const contact = TargetCollisions.resolveVehicleContact(caughtVehicle, activeTargets);
      if (!contact) return false;
      syncTargetGroups(activeTargets);
      if (contact.target instanceof Leurre) {
        createConfettiBurst(contact.x, contact.y, 12);
      } else {
        createConfettiBurst(contact.x, contact.y, 36);
        ambientMusic.playExplosion();
        if (targets.length === 0) {
          SeekPopulation.ensureTargetCount(targets, targetCount, createTarget);
          targetRespawnAt = null;
        } else if (targets.length < targetCount) {
          targetRespawnAt = millis() + 1100;
        }
      }
      activeTargets = targets.concat(lures);
      SeekPopulation.respawn(caughtVehicle, activeTargets, width, height);
      return true;
    };
    if (activeTargets.length) {
      SeekPopulation.step(vehicle, activeTargets, width, height, Math.random, handleArrival);
    }
    vehicle.show();
  }

  confetti.forEach(particle => {
    particle.update();
    particle.show();
  });
  confetti = confetti.filter(particle => !particle.isExpired());
  targets.forEach(target => target.show());
  lures.forEach(lure => lure.show());
  if (debugMode && activeScenario === 'flee') {
    targets.forEach(target => target.showDetection(true, vehicles));
  }
}

function keyPressed() {
  if (key && key.toLowerCase() === 'd') debugMode = !debugMode;
}

function windowResized() {
  resizeCanvas(windowWidth, sceneHeight());
  backgroundMouse.x = constrain(backgroundMouse.x, 0, width);
  backgroundMouse.y = constrain(backgroundMouse.y, 0, height);
  for (const target of targets) target.edges();
  for (const lure of lures) lure.edges();
  for (const vehicle of vehicles) vehicle.edges();
}
