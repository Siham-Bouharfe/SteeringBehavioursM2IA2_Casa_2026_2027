const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameRules = require('../gameRules.js');

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x ** 2 + this.y ** 2; }
  mag() { return Math.hypot(this.x, this.y); }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  normalize() { return this.mag() ? this.div(this.mag()) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  static sub(a, b) { return a.copy().sub(b); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

function load() {
  const deterministicMath = Object.create(Math);
  deterministicMath.random = seededRandom();
  const context = vm.createContext({
    Math: deterministicMath,
    GameRules, p5: { Vector }, createVector: (x, y) => new Vector(x, y),
    HALF_PI: Math.PI / 2,
    constrain: (n, low, high) => Math.max(low, Math.min(high, n)),
    map: (n, a, b, low, high) => low + (n - a) / (b - a) * (high - low),
  });
  for (const file of ['vehicle.js', 'cat.js', 'gardenClub.js', 'sketch.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  context.Cat = vm.runInContext('Cat', context);
  return context;
}

function seededRandom() {
  let seed = 19;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('wander uses desired velocity minus velocity, stays bounded and never moves the cat', () => {
  const { Cat } = load();
  const cat = new Cat(20, 30);
  cat.vel.set(0.5, 0);
  const position = cat.pos.copy();
  const force = cat.wander(1, () => 0.5);
  assert.ok(force.x > 0);
  assert.ok(Math.abs(force.y) < 1e-9);
  assert.ok(force.mag() <= cat.maxForce + 1e-12);
  assert.deepEqual(cat.pos, position);
  assert.equal(cat.acc.magSq(), 0);
  cat.vel.set(cat.maxSpeed, 0);
  assert.ok(cat.wander(1, () => 0.5).x < 0, 'A wandering cat must brake above its walking pace');
});

test('wander keeps a continuous, reproducible angle and handles rest and zero time', () => {
  const { Cat } = load();
  const a = new Cat(0, 0), b = new Cat(0, 0);
  const randomA = seededRandom(), randomB = seededRandom();
  for (let frame = 0; frame < 100; frame++) {
    const before = a.wanderTheta || 0;
    assert.deepEqual(a.wander(1, randomA), b.wander(1, randomB));
    assert.ok(Math.abs(a.wanderTheta - before) <= 0.28 + 1e-12);
  }
  const angle = a.wanderTheta;
  assert.ok(Number.isFinite(a.wander(0, () => 1).mag()));
  assert.equal(a.wanderTheta, angle);
});

test('near-Minette wander has hysteresis and yields when Minette walks away', () => {
  const { Cat } = load();
  const leader = new Cat(0, 0), cat = new Cat(100, 0);
  assert.equal(cat.isWanderingNear(leader), true);
  cat.pos.x = 140;
  assert.equal(cat.isWanderingNear(leader), true);
  cat.pos.x = 155;
  assert.equal(cat.isWanderingNear(leader), false);
  cat.pos.x = 140;
  assert.equal(cat.isWanderingNear(leader), false);
  cat.pos.x = 100;
  assert.equal(cat.isWanderingNear(leader), true);
  leader.vel.set(1, 0);
  assert.equal(cat.isWanderingNear(leader), false);
});

test('wander composes separation, return and obstacle avoidance within maxForce', () => {
  const { Cat } = load();
  const leader = new Cat(0, 0), cat = new Cat(75, 0);
  const obstacle = { pos: new Vector(75, -45), r: 14 };
  const force = cat.applyNearbyWander(leader, [leader, cat], [obstacle], 1, () => 0.5);
  assert.ok(cat.sensorReadings.some(sensor => sensor.hitObstacle));
  assert.ok(force.mag() <= cat.maxForce + 1e-12);
  assert.deepEqual(cat.acc, force);
  assert.deepEqual(cat.pos, new Vector(75, 0));
  cat.update();
  assert.equal(cat.acc.magSq(), 0);
  assert.ok(cat.path.length > 0, 'Locomotion must use the real Vehicle.update');
});

test('cats explore around a stationary Minette without escaping the neighborhood', () => {
  const { Cat } = load();
  const leader = new Cat(1000, 1000);
  const cats = [new Cat(1050, 1000), new Cat(970, 1050), new Cat(960, 970)];
  const random = seededRandom();
  let traveled = 0;
  for (let frame = 0; frame < 1200; frame++) {
    for (const cat of cats) {
      cat.maxSpeed = 1.8;
      cat.maxForce = 0.13;
      assert.equal(cat.isWanderingNear(leader), true);
      const before = cat.pos.copy();
      cat.applyNearbyWander(leader, [...cats, leader], [], 1, random);
      cat.update();
      traveled += Vector.dist(before, cat.pos);
      assert.ok(Vector.dist(cat.pos, leader.pos) < 155);
      assert.ok(cat.vel.mag() <= cat.maxSpeed + 1e-12);
    }
  }
  assert.ok(traveled > 500, 'Cats must actually explore rather than remain fixed');
});

test('the game updates nearby strays and followers through wander and resumes following', () => {
  const context = load();
  const result = vm.runInContext(`(() => {
    playerCat = new Cat(1000, 1000);
    playerCat.facingHeading = -HALF_PI;
    followers = [new Cat(1050, 1000)];
    strayCats = [new Cat(960, 1040)];
    for (let frame = 0; frame < 20; frame++) { updateFollowers(1); updateStreetCats(1); }
    const nearby = [...followers, ...strayCats].every(cat => cat.nearMinetteWander && cat.path.length > 0);
    const angle = followers[0].wanderTheta;
    playerCat.vel.set(1.5, 0);
    updateFollowers(1);
    return { nearby, following: !followers[0].nearMinetteWander,
      wanderStopped: followers[0].wanderTheta === angle };
  })()`, context);
  assert.equal(result.nearby, true);
  assert.equal(result.following, true);
  assert.equal(result.wanderStopped, true);
});
