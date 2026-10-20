import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Adaptateur vectoriel minimal pour exercer le vrai vehicle.js sans DOM.
class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  copy() { return new Vector(this.x, this.y); }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  setMag(n) { const m = this.mag(); return m ? this.mult(n / m) : this; }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
}
function scene(w = 800, h = 600) {
  let currentTime = 0;
  const drawCalls = [];
  const drawStub = name => (...args) => drawCalls.push([name, ...args]);
  const context = vm.createContext({ createVector: (x, y) => new Vector(x, y),
    p5: { Vector: Object.assign(Vector, { random2D: () => new Vector(1, 0) }) },
    width: w, height: h, millis: () => currentTime,
    drawingContext: {}, CLOSE: 'close',
    push: drawStub('push'), pop: drawStub('pop'), translate: drawStub('translate'),
    rotate: drawStub('rotate'), noStroke: drawStub('noStroke'), fill: drawStub('fill'),
    beginShape: drawStub('beginShape'), vertex: drawStub('vertex'),
    endShape: drawStub('endShape'), circle: drawStub('circle'),
    rect: drawStub('rect'), constrain: (value, low, high) => Math.max(low, Math.min(high, value)),
    random: (minimum, maximum) => minimum === undefined ? 0.5 :
      maximum === undefined ? minimum * 0.5 : minimum });
  for (const file of ['vehicle.js', 'FleeVehicle.js', 'population.js', 'target.js',
    'cibleFuyante.js', 'leurre.js', 'targetCollisions.js', 'confetti.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  return { ...vm.runInContext('({ Vehicle, FleeVehicle, Target, CibleFuyante, Leurre, Confetti, TargetCollisions, population: SeekPopulation })', context),
    drawCalls, setTime: value => currentTime = value };
}
const rng = () => 0.1;
const target = new Vector(400, 300);

test('population : bornes, conservation des instances et valeurs invalides', () => {
  const { Vehicle, population: p } = scene();
  const vehicles = [];
  const resize = n => p.resize(vehicles, n, target, 800, 600, (x, y) => new Vehicle(x, y), rng);
  resize(20);
  const first = vehicles[0]; first.vel.set(2, 1);
  resize(35); assert.equal(vehicles.length, 35); assert.equal(vehicles[0], first);
  resize(8); assert.equal(vehicles.length, 8); assert.equal(first.vel.x, 2);
  resize(8); assert.equal(vehicles[0], first);
  resize(200); assert.equal(vehicles.length, 200);
  resize(1); assert.equal(vehicles.length, 1);
  for (const n of [0, 201, 1.5, NaN, '20']) assert.throws(() => resize(n), { name: 'RangeError' });
});

test('slider : input met à jour population et compteur sans change', () => {
  const { Vehicle, population: p } = scene();
  const events = {}; const slider = { value: '20', addEventListener: (name, fn) => events[name] = fn };
  const output = {}; const vehicles = [];
  p.bindSlider(slider, output, vehicles, target, () => ({ width: 800, height: 600 }),
    (x, y) => new Vehicle(x, y), rng);
  for (const count of [1, 57, 200, 8]) {
    slider.value = String(count); events.input();
    assert.equal(vehicles.length, count); assert.equal(output.value, `${count} / 200`);
  }
  assert.equal(events.change, undefined);
});

test('edges fourni : quatre seuils stricts, angles et vitesse conservée', () => {
  const { Vehicle } = scene();
  for (const [x, y, expectedX, expectedY] of [
    [817, 100, -16, 100], [-17, 100, 816, 100],
    [100, 617, 100, -16], [100, -17, 100, 616],
    [817, -17, -16, 616], [816, 616, 816, 616], [-16, -16, -16, -16],
  ]) {
    const v = new Vehicle(x, y); v.vel.set(2, -3); v.edges();
    assert.deepEqual([v.pos.x, v.pos.y], [expectedX, expectedY]);
    assert.deepEqual([v.vel.x, v.vel.y], [2, -3]);
  }
});

test('seek fourni : forces proches/lointaines limitées et cible intacte', () => {
  const { Vehicle } = scene();
  for (const position of [new Vector(0.001, 0), new Vector(800, 600), new Vector(0, 0)]) {
    const v = new Vehicle(0, 0); const original = [position.x, position.y];
    const force = v.seek(position);
    assert.ok(force.mag() <= v.maxForce + 1e-12);
    if (position.mag()) assert.ok(force.x > 0);
    assert.deepEqual([position.x, position.y], original);
    v.vel.set(100, 100); v.applyBehaviors(position); v.update();
    assert.ok(v.vel.mag() <= v.maxSpeed + 1e-12);
    assert.equal(v.acc.mag(), 0);
  }
});

test('arrivée : seuil inclusif, même instance et paramètres préservés', () => {
  const { Vehicle, population: p } = scene();
  const v = new Vehicle(416.01, 300);
  assert.equal(p.hasArrived(v, target), false);
  v.pos.x = 416; assert.equal(p.hasArrived(v, target), true);
  v.vel.set(3, 1); v.acc.set(1, 2);
  const parameters = [v.r, v.maxSpeed, v.maxForce];
  p.step(v, target, 800, 600, rng);
  assert.equal(v.vel.mag(), 0); assert.equal(v.acc.mag(), 0);
  assert.ok(Math.hypot(v.pos.x - target.x, v.pos.y - target.y) > 20);
  assert.deepEqual([v.r, v.maxSpeed, v.maxForce], parameters);
});

test('arrivée avant/après déplacement, après wrap, et une seule réapparition', () => {
  const { Vehicle, population: p } = scene();
  const before = new Vehicle(400, 300);
  before.update = () => assert.fail('Pas de locomotion après une arrivée avant déplacement');
  let calls = 0;
  p.step(before, target, 800, 600, () => { calls++; return 0.1; });
  assert.equal(calls, 2);
  const after = new Vehicle(418, 300); after.vel.set(-4, 0);
  p.step(after, target, 800, 600, rng); assert.equal(after.vel.mag(), 0);
  const wrap = new Vehicle(815, 100); wrap.vel.set(4, 0);
  p.step(wrap, new Vector(0, 100), 800, 600, rng);
  assert.equal(wrap.vel.mag(), 0); assert.ok(wrap.pos.x >= 0);
});

test('la population délègue l’arrivée au gestionnaire d’explosion quand il est fourni', () => {
  const { Vehicle, population: p } = scene();
  const vehicle = new Vehicle(400, 300);
  let arrivals = 0;
  vehicle.update = () => assert.fail('La locomotion est court-circuitée après capture');
  p.step(vehicle, target, 800, 600, rng, caught => {
    arrivals++;
    assert.equal(caught, vehicle);
    return true;
  });
  assert.equal(arrivals, 1);
});

test('tirage : marges, repli déterministe borné, petite géométrie impossible', () => {
  const { Vehicle, population: p } = scene();
  const point = p.spawnPosition(target, 800, 600, 16, rng);
  assert.ok(point.x >= 16 && point.x <= 784 && point.y >= 16 && point.y <= 584);
  let calls = 0;
  const fallback = p.spawnPosition(target, 800, 600, 16, () => { calls++; return 0.5; });
  assert.equal(calls, 64); assert.equal(fallback.x, 16); assert.equal(fallback.y, 16);
  assert.ok(p.spawnPosition(new Vector(20, 20), 40, 40, 16, () => 0.5));
  const smallTarget = new Vector(5, 5);
  assert.equal(p.spawnPosition(smallTarget, 10, 10, 16, rng), null);
  const v = new Vehicle(5, 5); v.vel.set(1, 2);
  assert.equal(p.respawn(v, smallTarget, 10, 10, rng), false);
  assert.deepEqual([v.pos.x, v.pos.y, v.vel.x, v.vel.y], [5, 5, 1, 2]);
  const vehicles = [];
  p.resize(vehicles, 200, smallTarget, 10, 10, (x, y) => new Vehicle(x, y), rng);
  assert.equal(vehicles.length, 200);
});

test('population : arrivées simultanées et véhicules supprimés non mis à jour', () => {
  const { Vehicle, population: p } = scene();
  const vehicles = [new Vehicle(400, 300), new Vehicle(400, 300)];
  for (const v of vehicles) p.step(v, target, 800, 600, rng);
  assert.equal(vehicles.length, 2);
  assert.ok(vehicles.every(v => !p.hasArrived(v, target)));
  const removed = vehicles[1]; removed.update = () => assert.fail('Véhicule supprimé');
  p.resize(vehicles, 1, target, 800, 600, () => assert.fail('Création inutile'));
  for (const v of vehicles) p.step(v, target, 800, 600, rng);
});

test('Target hérite de Vehicle, se déplace de façon autonome et garde sa couleur', () => {
  const { Vehicle, Target } = scene(); const t = new Target(50, 60);
  assert.ok(t instanceof Vehicle); assert.equal(t.r, 34); assert.equal(t.vel.mag(), 0);
  t.sampleBackground([20, 80, 180, 255]);
  assert.deepEqual(t.sampledColor, [20, 80, 180, 255]);
  const appliedForces = [];
  const applyForce = t.applyForce.bind(t);
  t.applyForce = force => { appliedForces.push(force.copy()); applyForce(force); };
  t.update();
  assert.equal(t.maxSpeed, 4);
  assert.equal(t.maxForce, 0.1);
  assert.equal(t.wanderSpeed, 1.2);
  assert.equal(t.wanderForce, 0.04);
  assert.equal(t.r, 18);
  assert.ok(appliedForces[0].mag() <= Math.min(t.maxForce, t.wanderForce) + 1e-12);
  assert.ok(t.pos.x > 50);
  assert.ok(t.vel.mag() <= Math.min(t.maxSpeed, t.wanderSpeed) + 1e-12);
  assert.equal(t.acc.mag(), 0);
});

test('taille réelle de la cible règle le contact et la zone de réapparition', () => {
  const { Vehicle, population: p } = scene();
  const largeTarget = { pos: new Vector(400, 300), r: 40 };
  const v = new Vehicle(456, 300);
  assert.equal(p.hasArrived(v, largeTarget), true);
  v.pos.x = 457;
  assert.equal(p.hasArrived(v, largeTarget), false);

  const point = p.spawnPosition(largeTarget, 800, 600, v.r, () => 0.5);
  assert.ok(point);
  assert.ok(Math.hypot(point.x - largeTarget.pos.x, point.y - largeTarget.pos.y) > 60);
});

test('la population choisit la cible la plus proche et réapparaît hors des deux cibles', () => {
  const { Vehicle, population: p } = scene();
  const targets = [
    { pos: new Vector(100, 100), r: 30 },
    { pos: new Vector(700, 500), r: 45 },
  ];
  const vehicle = new Vehicle(200, 100);
  let chosenPoint;
  vehicle.applyBehaviors = point => { chosenPoint = point; };
  vehicle.update = () => {};
  p.step(vehicle, targets, 800, 600, rng);
  assert.equal(chosenPoint, targets[0].pos);

  const spawn = p.spawnPosition(targets, 800, 600, vehicle.r, () => 0.5);
  assert.ok(targets.every(target =>
    Math.hypot(spawn.x - target.pos.x, spawn.y - target.pos.y) >
      target.r + vehicle.r + 4));
});

test('l’arrivée tient compte des deux rayons pour chacune des cibles', () => {
  const { Vehicle, population: p } = scene();
  const targets = [
    { pos: new Vector(100, 100), r: 20 },
    { pos: new Vector(400, 300), r: 40 },
  ];
  const vehicle = new Vehicle(456, 300);
  assert.equal(p.hasArrived(vehicle, targets), true);
  vehicle.pos.x = 457;
  assert.equal(p.hasArrived(vehicle, targets), false);
});

test('flee inverse la vitesse désirée avant de calculer le steering', () => {
  const { FleeVehicle } = scene();
  const v = new FleeVehicle(10, 20);
  v.maxSpeed = 5;
  v.maxForce = 2;
  v.vel.set(1, 0);

  const force = v.flee(new Vector(0, 20));

  // Desired = (5, 0), steering = desired - current = (4, 0), limité à 2.
  assert.ok(Math.abs(force.x - 2) < 1e-12);
  assert.ok(Math.abs(force.y) < 1e-12);
  assert.ok(force.mag() <= v.maxForce + 1e-12);

  const coincident = v.flee(new Vector(10, 20));
  assert.ok(coincident.x > 0);
  assert.ok(coincident.mag() <= v.maxForce + 1e-12);
});

test('le rendu des véhicules ne dessine pas le vecteur rouge hérité', () => {
  const { FleeVehicle, drawCalls } = scene();
  const vehicle = new FleeVehicle(80, 90);
  vehicle.drawVelocityVector = () => assert.fail('Le vecteur de vitesse ne doit pas être dessiné');
  vehicle.show();

  assert.ok(drawCalls.some(([name]) => name === 'beginShape'));
  assert.ok(drawCalls.some(([name]) => name === 'circle'));
});

test('CibleFuyante choisit le véhicule le plus proche dans son rayon réglable', () => {
  const { CibleFuyante } = scene();
  const target = new CibleFuyante(300, 300, 200);
  const far = { pos: new Vector(480, 300), r: 16 };
  const near = { pos: new Vector(350, 300), r: 16 };
  const outside = { pos: new Vector(501, 300), r: 16 };
  target.update([far, outside, near], 0);

  assert.equal(target.escapeThreat, near);
  assert.equal(target.escapeStartedAt, 0);
  assert.equal(target.consumeLureBurst(), true);
  assert.equal(target.consumeLureBurst(), false);
  assert.ok(target.vel.x < 0);
  assert.ok(target.vel.mag() <= 6.8 + 1e-12);
  assert.equal(target.maxSpeed, 4);

  const safeAgain = new CibleFuyante(300, 300, 40);
  safeAgain.update([near], 0);
  assert.equal(safeAgain.escapeThreat, null);
});

test('CibleFuyante arrête sa fuite à 300 px ou après cinq secondes', () => {
  const { CibleFuyante } = scene();
  const target = new CibleFuyante(300, 300, 200);
  const threat = { pos: new Vector(350, 300), r: 16 };
  target.update([threat], 0);
  assert.equal(target.escapeThreat, threat);

  threat.pos.x = 601;
  target.update([threat], 100);
  assert.equal(target.escapeStartedAt, null);
  assert.equal(target.ignoredThreat, threat);

  const timedTarget = new CibleFuyante(300, 300, 200);
  const timedThreat = { pos: new Vector(350, 300), r: 16 };
  timedTarget.update([timedThreat], 0);
  timedTarget.update([timedThreat], 5000);
  assert.equal(timedTarget.escapeStartedAt, null);
  assert.equal(timedTarget.ignoredThreat, timedThreat);
});

test('deux cibles explosent au contact en tenant compte de leurs rayons', () => {
  const { TargetCollisions } = scene();
  const first = { pos: new Vector(100, 120), r: 20 };
  const touching = { pos: new Vector(140, 120), r: 20 };
  const distant = { pos: new Vector(210, 120), r: 15 };
  const targets = [first, touching, distant];

  const explosions = TargetCollisions.resolve(targets);

  assert.equal(explosions.length, 1);
  assert.deepEqual([explosions[0].x, explosions[0].y], [120, 120]);
  assert.deepEqual(targets, [distant]);
  assert.equal(TargetCollisions.resolve(targets).length, 0);
});

test('un véhicule rattrapant une cible déclenche un contact unique au bon rayon', () => {
  const { TargetCollisions } = scene();
  const target = { pos: new Vector(100, 120), r: 20 };
  const targets = [target];
  const vehicle = { pos: new Vector(141, 120), r: 20 };
  assert.equal(TargetCollisions.resolveVehicleContact(vehicle, targets), null);
  vehicle.pos.x = 140;
  const contact = TargetCollisions.resolveVehicleContact(vehicle, targets);
  assert.equal(contact.target, target);
  assert.deepEqual([contact.x, contact.y], [100, 120]);
  assert.equal(targets.length, 0);
});

test('les tomates apparaissent hors du cercle de collision de leur cible', () => {
  const { Leurre, TargetCollisions } = scene();
  for (const radius of [18, 34, 46]) {
    const target = { pos: new Vector(400, 300), r: radius };
    const targets = [target];
    for (const angle of [-0.78, 0.78]) {
      const position = Leurre.launchPosition(target, angle);
      const lure = new Leurre(position.x, position.y, angle);
      targets.push(lure);
    }
    assert.equal(TargetCollisions.resolve(targets).length, 0);
    assert.equal(targets.length, 3);
    assert.ok(targets.slice(1).every(lure =>
      Math.hypot(lure.pos.x - target.pos.x, lure.pos.y - target.pos.y) > target.r + lure.r));
  }
});

test('une cible de remplacement est créée immédiatement quand la dernière disparaît', () => {
  const { population: p } = scene();
  const remaining = [];
  let createdWithIndex = null;
  p.ensureTargetCount(remaining, 1, index => { createdWithIndex = index; return { index }; });
  assert.equal(remaining.length, 1);
  assert.equal(createdWithIndex, 0);
  assert.equal(remaining[0].index, 0);
  p.ensureTargetCount(remaining, 1, () => assert.fail('Aucune cible supplémentaire attendue'));
  assert.equal(remaining.length, 1);
});

test('le leurre hérite de Target, s’élance et expire après quelques secondes', () => {
  const { Target, Leurre } = scene();
  const lure = new Leurre(200, 100, Math.PI);
  assert.ok(lure instanceof Target);
  assert.ok(lure.wanderDirection.x < 0);
  lure.update();
  assert.ok(lure.pos.x < 200);
  assert.equal(lure.isExpired(4199), false);
  assert.equal(lure.isExpired(4200), true);
});

test('les confettis héritent de Vehicle, retombent et expirent proprement', () => {
  const { Vehicle, Confetti, drawCalls, setTime } = scene();
  const particle = new Confetti(40, 50, Math.PI / 2, 2);
  assert.ok(particle instanceof Vehicle);
  particle.update();
  assert.ok(particle.vel.y > 0);
  particle.show();
  assert.ok(drawCalls.some(([name]) => name === 'rect' || name === 'circle'));
  assert.equal(particle.isExpired(899), false);
  assert.equal(particle.isExpired(900), true);
  setTime(900);
  assert.equal(particle.isExpired(), true);
});
