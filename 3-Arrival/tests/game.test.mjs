import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  copy() { return new Vector(this.x, this.y); }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const m = this.mag(); return m ? this.mult(1 / m) : this; }
  rotate(angle) {
    const x = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    this.y = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    this.x = x;
    return this;
  }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

function loadGame() {
  const noop = () => {};
  const context = vm.createContext({
    window: {}, createVector: (x, y) => new Vector(x, y),
    p5: { Vector: Object.assign(Vector, { random2D: () => new Vector(1, 0) }) },
    width: 800, height: 600, millis: () => 1000, frameCount: 60,
    random: (min = 1, max) => max === undefined ? min / 2 : (min + max) / 2,
    map: (value, start1, stop1, start2, stop2) => start2 +
      (value - start1) * (stop2 - start2) / (stop1 - start1),
    TWO_PI: Math.PI * 2,
    push: noop, pop: noop, translate: noop, rotate: noop, noStroke: noop,
    stroke: noop, strokeWeight: noop, fill: noop, ellipse: noop, triangle: noop,
    circle: noop, line: noop, text: noop, textAlign: noop, textSize: noop,
    textStyle: noop, rect: noop, CENTER: 'center', LEFT: 'left', TOP: 'top',
    BOLD: 'bold', NORMAL: 'normal', drawingContext: { shadowColor: '', shadowBlur: 0 },
  });
  for (const file of ['vehicle.js', 'chat.js', 'croquette.js', 'anneau.js',
    'texteFlottant.js', 'hud.js', 'maison.js', 'miette.js', 'arrivalRules.js', 'croquetteGlyph.js', 'missionManager.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  return vm.runInContext('({ Vehicle, Chat, Croquette, Anneau, TexteFlottant, Hud, Maison, Miette, ArrivalRules, CroquetteGlyph, MissionManager })', context);
}

test('chaque entité visible du jeu hérite directement de Vehicle', () => {
  const { Vehicle, Chat, Croquette, Anneau, TexteFlottant, Hud, Maison, Miette, CroquetteGlyph } = loadGame();
  for (const Entity of [Chat, Croquette, Anneau, TexteFlottant, Hud, Maison, Miette, CroquetteGlyph]) {
    assert.equal(Object.getPrototypeOf(Entity.prototype), Vehicle.prototype);
  }
});

test('le chat suit le curseur avec Arrival sans dépasser ses limites de mouvement', () => {
  const { Chat } = loadGame();
  const cat = new Chat(100, 100);
  cat.followPointer(300, 100);
  assert.ok(cat.pos.x > 100);
  assert.ok(cat.vel.mag() <= cat.maxSpeed);
  assert.equal(cat.acc.mag(), 0);
});

test('la capture d’une croquette tient compte du rayon du chat et de la croquette', () => {
  const { Chat, Croquette } = loadGame();
  const cat = new Chat(100, 100);
  const food = new Croquette(131, 100);
  assert.equal(cat.hasCaught(food), true);
  food.pos.x = 132;
  assert.equal(cat.hasCaught(food), false);
});

test('chaque anneau suit le point précédent avec Arrival', () => {
  const { Anneau } = loadGame();
  const ring = new Anneau(100, 100, 0);
  ring.follow(new Vector(200, 100));
  assert.ok(ring.pos.x > 100);
  assert.ok(ring.vel.mag() <= ring.maxSpeed);
  assert.equal(ring.acc.mag(), 0);
});

test('les anneaux décalent leur point de suivi en vague sans modifier la cible de base', () => {
  const { Anneau } = loadGame();
  const ring = new Anneau(100, 100, 4);
  const base = new Vector(150, 100);
  const wavePoint = ring.getFollowPoint(base, 0, 125, 3);
  assert.equal(base.x, 150);
  assert.equal(base.y, 100);
  assert.notEqual(wavePoint.y, base.y);
  assert.ok(Math.abs(wavePoint.y - base.y) <= 6);
  const stationaryPoint = ring.getFollowPoint(base, 0, 125, 0);
  assert.equal(stationaryPoint.x, base.x);
  assert.equal(stationaryPoint.y, base.y);
  const edgePoint = ring.getFollowPoint(new Vector(1, 1), 0, 125, 3);
  assert.ok(edgePoint.x >= ring.r && edgePoint.y >= ring.r);
});

test('les textes flottants expirent après leur durée prévue', () => {
  const { TexteFlottant } = loadGame();
  const message = new TexteFlottant(50, 60, 'Miam !', 100);
  assert.equal(message.isExpired(1049), false);
  assert.equal(message.isExpired(1050), true);
});

test('maison et miettes de célébration sont aussi des entités Vehicle', () => {
  const { Vehicle, Maison, Miette } = loadGame();
  assert.ok(new Maison(100, 400, 0) instanceof Vehicle);
  const crumb = new Miette(100, 100, -Math.PI / 2, 5, 100);
  assert.ok(crumb instanceof Vehicle);
  crumb.update();
  assert.ok(crumb.pos.y < 100);
  assert.equal(crumb.isExpired(1550), true);
});

test('les maisons s’allument et montrent leur petit chat près du chat joueur', () => {
  const { Maison } = loadGame();
  const house = new Maison(100, 400, 0);
  house.update({ pos: new Vector(100, 370) });
  assert.equal(house.catAtWindow, true);
  assert.ok(house.reaction > 0);
  house.update({ pos: new Vector(700, 500) });
  assert.equal(house.catAtWindow, false);
  assert.ok(house.reaction < 0.14);
});

test('les croquettes dorées donnent un anneau doré sans changer la chaîne de classes', () => {
  const { Vehicle, Croquette, Anneau } = loadGame();
  const food = new Croquette(30, 40, true);
  const ring = new Anneau(30, 40, 0, food.isGolden);
  assert.ok(food instanceof Vehicle);
  assert.ok(ring instanceof Vehicle);
  assert.equal(food.isGolden, true);
  assert.equal(ring.isGolden, true);
});

test('les annonces de combo et le grand OUIIIII arrivent au bon compte', () => {
  const { ArrivalRules, CroquetteGlyph } = loadGame();
  assert.equal(ArrivalRules.isMilestone(9), false);
  assert.equal(ArrivalRules.isMilestone(10), true);
  assert.equal(ArrivalRules.isMilestone(20), true);
  assert.equal(ArrivalRules.isCombo(1000, 3499), true);
  assert.equal(ArrivalRules.isCombo(1000, 3500), false);
  const points = CroquetteGlyph.wordLayout(400, 200, 6);
  assert.equal(points.length, 92);
  assert.ok(Math.min(...points.map(point => point.x)) >= 400 - 33 * 6 / 2);
  assert.ok(Math.max(...points.map(point => point.x)) <= 400 + 33 * 6 / 2);
});

test('les croquettes composent le mot, le maintiennent puis éclatent par steering borné', () => {
  const { CroquetteGlyph } = loadGame();
  const particle = new CroquetteGlyph(0, 0, 40, 0, 0, 0, 0, 6, 0);
  const forces = [];
  const applyForce = particle.applyForce.bind(particle);
  particle.applyForce = force => { forces.push(force.copy()); applyForce(force); };

  assert.equal(CroquetteGlyph.phaseAt(100, 0), 'gather');
  particle.update(100);
  assert.ok(particle.pos.x > 0);
  assert.ok(forces.at(-1).mag() <= particle.maxForce + 1e-12);

  assert.equal(CroquetteGlyph.phaseAt(2600, 0), 'hold');
  particle.update(3300);
  assert.equal(CroquetteGlyph.phaseAt(3300, 0), 'burst');
  assert.ok(particle.vel.x > 0);
  assert.ok(forces.at(-1).mag() <= particle.maxForce + 1e-12);
  assert.equal(particle.isExpired(4550), true);
});

test('la majorité des croquettes de célébration atteint sa position avant l’explosion', () => {
  const { CroquetteGlyph } = loadGame();
  const targets = CroquetteGlyph.wordLayout(400, 200, 6);
  const particles = targets.map((target, index) => new CroquetteGlyph(
    (index * 127) % 800, (index * 83) % 600,
    target.x, target.y, 400, 200, index, 6, 0
  ));
  for (let frame = 0; frame <= 156; frame++) {
    const now = frame * 1000 / 60;
    particles.forEach(particle => particle.update(now));
  }
  const assembled = particles.filter((particle, index) =>
    Vector.dist(particle.pos, new Vector(targets[index].x, targets[index].y)) < 12);
  assert.ok(assembled.length >= particles.length * 0.9,
    `Seulement ${assembled.length}/${particles.length} croquettes sont assemblées`);
});

test('les missions progressent, récompensent et passent aux objectifs suivants', () => {
  const { MissionManager } = loadGame();
  const missions = new MissionManager();
  assert.equal(missions.getState().type, 'snacks');
  for (let index = 0; index < 4; index++) {
    assert.equal(missions.recordSnack({ isGolden: false, isCombo: false }), null);
  }
  assert.equal(missions.recordSnack({ isGolden: false, isCombo: true }).type, 'snacks');
  assert.equal(missions.getState().type, 'combo');
  assert.equal(missions.recordSnack({ isGolden: false, isCombo: false }), null);
  assert.equal(missions.recordSnack({ isGolden: false, isCombo: true }), null);
  assert.equal(missions.recordSnack({ isGolden: false, isCombo: true }).type, 'combo');
  assert.equal(missions.getState().type, 'golden');
  assert.equal(missions.recordSnack({ isGolden: false, isCombo: true }), null);
  assert.equal(missions.getState().progress, 0);
  assert.equal(missions.recordSnack({ isGolden: true, isCombo: false }).type, 'golden');
  assert.equal(missions.getState().type, 'snacks');
});
