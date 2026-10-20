const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class TestVector {
  constructor(x, y) { this.x = x; this.y = y; }
  copy() { return new TestVector(this.x, this.y); }
  add(vector) { this.x += vector.x; this.y += vector.y; return this; }
  sub(vector) { this.x -= vector.x; this.y -= vector.y; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  heading() { return Math.atan2(this.y, this.x); }
  mult(n) { this.x *= n; this.y *= n; return this; }
  setMag(value) {
    const magnitude = this.mag();
    if (magnitude) { this.x = this.x / magnitude * value; this.y = this.y / magnitude * value; }
    return this;
  }
  limit(value) { if (this.mag() > value) this.setMag(value); return this; }
  set(x, y) { this.x = x; this.y = y; return this; }
}

class TestVehicle {
  constructor(x, y) {
    this.pos = new TestVector(x, y);
    this.vel = new TestVector(0, 0);
    this.acc = new TestVector(0, 0);
    this.maxSpeed = 1;
    this.maxForce = 1;
  }
  getDetourTarget() { return null; }
  arrive(target) {
    return new TestVector(target.x - this.pos.x, target.y - this.pos.y)
      .setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
  }
  separation() { return new TestVector(0, 0); }
  alignment() { return new TestVector(0, 0); }
  cohesion() { return new TestVector(0, 0); }
  applyForce(force) { this.acc.add(force); }
  update() {
    this.lastAcceleration = this.acc.copy();
    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }
}

function loadFireflies() {
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    Vehicle: TestVehicle,
    createVector: (x, y) => new TestVector(x, y),
    p5: { Vector: { dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) } },
    GameRules: {
      composeSteering(entries, limit) {
        const force = entries.reduce((sum, entry) => {
          sum.x += entry.force.x * entry.weight;
          sum.y += entry.force.y * entry.weight;
          return sum;
        }, new TestVector(0, 0));
        return force.limit(limit);
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'firefly.js'), 'utf8'), context);
  return module.exports;
}

test('garden lights populate the world while leaving the race clearing open', () => {
  const { createGardenFireflies } = loadFireflies();
  const clearing = { x: 600, y: 600, w: 600, h: 600 };
  const fireflies = createGardenFireflies(3600, 3000, clearing);

  assert.ok(fireflies.length >= 10);
  assert.ok(fireflies.every(firefly => firefly instanceof TestVehicle));
  assert.ok(fireflies.every(firefly =>
    firefly.pos.x < clearing.x - 100 || firefly.pos.x > clearing.x + clearing.w + 100 ||
    firefly.pos.y < clearing.y - 100 || firefly.pos.y > clearing.y + clearing.h + 100));
});

test('nearest light is selected within perception range and invalid perception is explicit', () => {
  const { nearestFireflyTarget } = loadFireflies();
  const lights = [
    { id: 'far', pos: new TestVector(80, 0) },
    { id: 'near', pos: new TestVector(12, 0) },
  ];

  assert.equal(nearestFireflyTarget(new TestVector(0, 0), lights, 50).id, 'near');
  assert.equal(nearestFireflyTarget(new TestVector(0, 0), lights, 10), null);
  assert.throws(() => nearestFireflyTarget(null, lights), /Perception invalide/);
});

test('fireflies drift with bounded steering and separate their motion from drawing', () => {
  const { Firefly } = loadFireflies();
  const firefly = new Firefly(100, 100, 2);
  const initial = firefly.pos.copy();
  const phase = firefly.phase;

  firefly.update([firefly], [], 2);

  assert.ok(firefly.phase > phase);
  assert.ok(Math.hypot(firefly.pos.x - initial.x, firefly.pos.y - initial.y) > 0);
  assert.ok(Math.hypot(firefly.lastAcceleration.x, firefly.lastAcceleration.y) <= firefly.maxForce + 1e-12);
});
