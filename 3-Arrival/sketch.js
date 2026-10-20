let chat;
let croquette;
let anneaux = [];
let messages = [];
let croquettesFestives = [];
let maisons = [];
let score = 0;
let snacksEaten = 0;
let lastSnackAt = -Infinity;
let snackSound;
let hud;
let missionManager;

function preload() {
  font = loadFont('./assets/inconsolata.otf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  chat = new Chat(width / 2, height / 2);
  croquette = createCroquette();
  snackSound = new SnackSound();
  hud = new Hud();
  missionManager = new MissionManager();
  createNeighborhood();
}

function draw() {
  drawMiniWorld();
  maisons.forEach(maison => {
    maison.update(chat);
    maison.show();
  });
  updateTail();
  croquette.show();
  chat.followPointer(constrain(mouseX, 0, width), constrain(mouseY, 0, height));

  if (chat.hasCaught(croquette)) eatCroquette();

  anneaux.forEach(anneau => anneau.show());
  chat.show();
  messages.forEach(message => {
    message.update();
    message.show();
  });
  messages = messages.filter(message => !message.isExpired());
  croquettesFestives.forEach(croquetteFestive => {
    croquetteFestive.update();
    if (!croquetteFestive.isExpired()) croquetteFestive.show();
  });
  croquettesFestives = croquettesFestives.filter(croquetteFestive => !croquetteFestive.isExpired());
  hud.show(score, snacksEaten, missionManager.getState());
}

function createNeighborhood() {
  maisons = [];
  const count = Math.max(3, Math.min(6, Math.floor(width / 190)));
  const spacing = width / count;
  const scale = Math.min(1, spacing / 145, height / 550);
  for (let index = 0; index < count; index++) {
    maisons.push(new Maison(spacing * (index + 0.5), height * 0.79, index, scale));
  }
}

function drawMiniWorld() {
  const context = drawingContext;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#48456d');
  sky.addColorStop(0.56, '#aaa0c0');
  sky.addColorStop(0.7, '#d8bfae');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  noStroke();
  fill('#768b79');
  rect(0, height * 0.72, width, height * 0.28);
  fill('#a89586');
  rect(0, height * 0.9, width, height * 0.1);
  fill('#c6ae9a');
  rect(0, height * 0.9, width, 4);
}

function createCroquette() {
  const isGolden = random() < 0.12;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = random(28, Math.max(29, width - 28));
    const y = random(28, Math.max(29, height - 28));
    const point = createVector(x, y);
    if (p5.Vector.dist(point, chat.pos) > 150 &&
        anneaux.every(ring => p5.Vector.dist(point, ring.pos) > ring.r + 30)) {
      return new Croquette(x, y, isGolden);
    }
  }
  return new Croquette(random(width), random(height), isGolden);
}

function updateTail() {
  let leader = chat;
  for (const anneau of anneaux) {
    const direction = leader.vel.mag() > 0.15
      ? leader.vel.copy().normalize()
      : createVector(1, 0);
    direction.mult(leader.r + anneau.r + 4);
    const followPoint = p5.Vector.sub(leader.pos, direction);
    const heading = chat.vel.mag() > 0.15 ? chat.vel.heading() : 0;
    anneau.follow(followPoint, heading, millis(), chat.vel.mag());
    leader = anneau;
  }
}

function eatCroquette() {
  snacksEaten++;
  score += croquette.isGolden ? 3 : 1;
  const now = millis();
  const combo = ArrivalRules.isCombo(lastSnackAt, now);
  lastSnackAt = now;
  const completedMission = missionManager.recordSnack({
    isGolden: croquette.isGolden,
    isCombo: combo,
  });
  if (completedMission) score += 5;
  const tailStart = anneaux.length ? anneaux[anneaux.length - 1].pos : chat.pos;
  anneaux.push(new Anneau(tailStart.x, tailStart.y, anneaux.length, croquette.isGolden));
  const milestone = ArrivalRules.isMilestone(snacksEaten);
  if (milestone) {
    createCroquetteWord(width / 2, height * 0.42, now);
  } else {
    const message = completedMission ? 'MISSION RÉUSSIE ! +5' : croquette.isGolden ? 'CROQUETTE DORÉE ! +3' : combo ? 'Miam ! Combo !' : 'Miam ! +1';
    messages.push(new TexteFlottant(chat.pos.x, chat.pos.y - 30, message, now));
  }
  snackSound.play(score, { golden: croquette.isGolden, celebration: milestone });
  croquette = createCroquette();
}

function createCroquetteWord(centerX, centerY, bornAt) {
  const pixelSize = Math.max(3, Math.min(8, (width - 80) / CroquetteGlyph.WORD_COLUMNS, height * 0.32 / 7));
  const points = CroquetteGlyph.wordLayout(centerX, centerY, pixelSize);
  croquettesFestives = points.map((point, index) => new CroquetteGlyph(
    random(width),
    random(height),
    point.x,
    point.y,
    centerX,
    centerY,
    index,
    pixelSize,
    bornAt
  ));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  createNeighborhood();
}

function keyPressed() {
  if (key === 'd' || key === 'D') Vehicle.debug = !Vehicle.debug;
}

function mousePressed() {
  userStartAudio();
}
