// Circuit fermé suivi par des chats-vehicles.
// Wander reste volontairement discret; ajuster cette constante pour changer son niveau.
const WANDER_WEIGHT = 0.08;
const INITIAL_FOLLOW_WEIGHT = 1.4;
const INITIAL_SEPARATION_WEIGHT = 1.2;
const INITIAL_RING_COUNT = 12;
const INITIAL_RING_SPACING = 26;
const INITIAL_PATH_WIDTH = 40;
const COAT_COLORS = ['#858d9a', '#bd806b', '#d3b276', '#788d78', '#9b83a8'];

let debug = false;
let path;
let chats = [];
let followWeight = INITIAL_FOLLOW_WEIGHT;
let separationWeight = INITIAL_SEPARATION_WEIGHT;
let ringCount = INITIAL_RING_COUNT;
let ringSpacing = INITIAL_RING_SPACING;
let pathWidth = INITIAL_PATH_WIDTH;

function setup() {
  createCanvas(windowWidth, windowHeight);
  newPath();
  const first = path.points[0];
  const next = path.points[1];
  chats.push(new Chat(first.x, first.y, Math.atan2(next.y - first.y, next.x - first.x),
    COAT_COLORS[0], ringCount, ringSpacing));
  setupControls();
}

function draw() {
  background('#f5f0e9');
  path.display();

  const allParts = chats.flatMap(chat => chat.parts());
  // Calcule d'abord toutes les forces à partir du même état, puis déplace les entités.
  for (const chat of chats) chat.steer(path, allParts, followWeight, separationWeight);
  for (const chat of chats) chat.move();
  for (const chat of chats) chat.show();
}

function setupControls() {
  const followSlider = document.getElementById('follow-weight');
  const separationSlider = document.getElementById('separation-weight');
  const followValue = document.getElementById('follow-value');
  const separationValue = document.getElementById('separation-value');
  const pathWidthSlider = document.getElementById('path-width');
  const pathWidthValue = document.getElementById('path-width-value');
  const chatLengthSlider = document.getElementById('chat-length');
  const chatLengthValue = document.getElementById('chat-length-value');
  const ringSpacingSlider = document.getElementById('ring-spacing');
  const ringSpacingValue = document.getElementById('ring-spacing-value');
  if (!followSlider || !separationSlider || !followValue || !separationValue ||
      !pathWidthSlider || !pathWidthValue || !chatLengthSlider || !chatLengthValue ||
      !ringSpacingSlider || !ringSpacingValue) return;
  followSlider.addEventListener('input', () => {
    followWeight = Number(followSlider.value);
    followValue.textContent = followWeight.toFixed(1);
  });
  separationSlider.addEventListener('input', () => {
    separationWeight = Number(separationSlider.value);
    separationValue.textContent = separationWeight.toFixed(1);
  });
  pathWidthSlider.addEventListener('input', () => {
    pathWidth = Number(pathWidthSlider.value);
    path.radius = pathWidth / 2;
    pathWidthValue.textContent = `${pathWidthSlider.value} px`;
  });
  chatLengthSlider.addEventListener('input', () => {
    ringCount = Number(chatLengthSlider.value);
    chatLengthValue.textContent = `${ringCount} anneaux`;
    for (const chat of chats) chat.setRingCount(ringCount);
  });
  ringSpacingSlider.addEventListener('input', () => {
    ringSpacing = Number(ringSpacingSlider.value);
    ringSpacingValue.textContent = `${ringSpacing} px`;
    for (const chat of chats) chat.setRingSpacing(ringSpacing);
  });
}

function newPath() {
  path = new Path();
  path.radius = pathWidth / 2;
  const segments = 30;
  const angleStep = TWO_PI / segments;
  const radiusMin = Math.min(width, height) * 0.29;
  const radiusMax = Math.min(width, height) * 0.39;
  for (let i = 0; i < segments; i++) {
    const angle = i * angleStep;
    const radius = random(radiusMin, radiusMax);
    path.addPoint(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius);
  }
}

function addChat() {
  const index = Math.floor(random(path.points.length));
  const point = path.points[index];
  const next = path.points[(index + 1) % path.points.length];
  const heading = Math.atan2(next.y - point.y, next.x - point.x);
  const offset = random(-55, 55);
  const x = Math.max(30, Math.min(width - 30, point.x + Math.cos(heading + HALF_PI) * offset));
  const y = Math.max(30, Math.min(height - 30, point.y + Math.sin(heading + HALF_PI) * offset));
  chats.push(new Chat(x, y, heading, COAT_COLORS[(chats.length) % COAT_COLORS.length],
    ringCount, ringSpacing));
}

function keyPressed() {
  if (key.toLowerCase() === 'd') {
    debug = !debug;
    Vehicle.debug = debug;
  } else if (key.toLowerCase() === 't') {
    addChat();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  newPath();
}
