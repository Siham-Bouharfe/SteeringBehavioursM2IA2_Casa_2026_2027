import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const folder = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = file => readFileSync(path.join(folder, file), 'utf8');

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  heading() { return Math.atan2(this.y, this.x); }
  limit(max) { const m = Math.hypot(this.x, this.y); if (m > max) { this.x *= max / m; this.y *= max / m; } return this; }
  setMag(mag) { const m = Math.hypot(this.x, this.y) || 1; this.x *= mag / m; this.y *= mag / m; return this; }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static fromAngle(angle) { return new Vector(Math.cos(angle), Math.sin(angle)); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
}

test('les angles des capteurs sont symétriques et le cas d’un seul capteur est frontal', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(source('settings.js'), context);
  assert.deepEqual(Array.from(vm.runInContext('sensorAngles(5, 120)', context)), [-60, -30, 0, 30, 60]);
  assert.deepEqual(Array.from(vm.runInContext('sensorAngles(1, 120)', context)), [0]);
});

test('Vehicle applique portée, nombre/angle de capteurs, vitesse et neurones configurés', () => {
  const createdBrains = [];
  const rayAngles = [];
  class Ray { constructor(pos, angle, sight) { this.pos = pos; this.angle = angle; this.sight = sight; rayAngles.push(angle); } }
  class NeuralNetwork { constructor(inputs, hidden, outputs) { createdBrains.push({ inputs, hidden, outputs }); } }
  const config = { sensorRange: 140, sensorCount: 5, sensorAngle: 120, maxSpeed: 8, trackWidth: 60, hiddenNeurons: 24 };
  const context = vm.createContext({
    Math, start: { x: 10, y: 20 }, Ray, NeuralNetwork,
    createVector: (x, y) => new Vector(x, y), radians: degrees => degrees * Math.PI / 180,
    p5: { Vector },
  });
  vm.runInContext(source('settings.js'), context);
  context.configForTest = config;
  vm.runInContext('ACTIVE_CONFIG = configForTest', context);
  vm.runInContext(source('vehicle.js'), context);
  const vehicle = vm.runInContext('new Vehicle()', context);
  assert.equal(vehicle.sight, 140);
  assert.equal(vehicle.maxspeed, 8);
  assert.equal(vehicle.rays.length, 5);
  assert.equal(vehicle.hiddenNodes, 24);
  assert.ok(vehicle.rays.every(ray => ray.sight === 140));
  assert.deepEqual(rayAngles.map(angle => Math.round(angle * 180 / Math.PI)), [-60, -30, 0, 30, 60]);
  assert.deepEqual(createdBrains[0], { inputs: 5, hidden: 24, outputs: 2 });
});

test('Vehicle normalise les entrées sensorielles avec sa portée configurée', () => {
  let mappedSight;
  class Ray { cast() { return null; } }
  class NeuralNetwork { predict() { return [0.5, 0.5]; } }
  const context = vm.createContext({
    Math,
    start: { x: 0, y: 0 }, Ray, NeuralNetwork,
    createVector: (x, y) => new Vector(x, y), radians: degrees => degrees * Math.PI / 180,
    map: (value, inMin, inMax) => { if (value === 125 && inMin === 0) mappedSight = inMax; return 0.5; },
    PI: Math.PI, p5: { Vector },
  });
  vm.runInContext(source('settings.js'), context);
  context.configForTest = { sensorRange: 125, sensorCount: 3, sensorAngle: 90, maxSpeed: 5, trackWidth: 60, hiddenNeurons: 8 };
  vm.runInContext('ACTIVE_CONFIG = configForTest', context);
  vm.runInContext(source('vehicle.js'), context);
  const vehicle = vm.runInContext('new Vehicle()', context);
  vehicle.look([]);
  assert.equal(mappedSight, 125);
});

test('Appliquer recommence avec les nouveaux réglages et construit un circuit à la largeur choisie', () => {
  const values = {
    'sensor-range': '130', 'sensor-count': '9', 'sensor-angle': '150',
    'max-speed': '7.5', 'track-width': '80', 'hidden-neurons': '20',
  };
  let constructed = [];
  class Vehicle { constructor() { constructed.push(true); } dispose() {} }
  class Boundary {
    constructor(x1, y1, x2, y2) { this.a = { x: x1, y: y1 }; this.b = { x: x2, y: y2 }; }
    midpoint() { return { x: (this.a.x + this.b.x) / 2, y: (this.a.y + this.b.y) / 2 }; }
  }
  const controls = new Map(Object.entries(values).map(([id, value]) => [id, {
    value,
    addEventListener(name, callback) { this[name] = callback; },
  }]));
  for (const id of ['sensor-range-value', 'sensor-count-value', 'sensor-angle-value', 'max-speed-value', 'track-width-value', 'hidden-neurons-value']) {
    controls.set(id, { textContent: '', addEventListener(name, callback) { this[name] = callback; } });
  }
  controls.set('apply-settings', { addEventListener(name, callback) { this[name] = callback; } });
  controls.set('settings-panel', { hidden: true });
  controls.set('settings-toggle', { hidden: false, attributes: {}, addEventListener(name, callback) { this[name] = callback; }, setAttribute(name, value) { this.attributes[name] = value; } });
  controls.set('settings-close', { addEventListener(name, callback) { this[name] = callback; } });
  controls.set('track-select', { value: 'monaco', addEventListener(name, callback) { this[name] = callback; } });
  const context = vm.createContext({
    Math, Vehicle, Boundary, width: 1200, height: 800, TWO_PI: Math.PI * 2,
    createVector: (x, y) => ({ x, y, normalize() { const length = Math.hypot(this.x, this.y) || 1; this.x /= length; this.y /= length; return this; } }), random: () => 0,
    map: (v, a, b, c, d) => c + (v - a) * (d - c) / (b - a),
    noise: () => 0.5, cos: Math.cos, sin: Math.sin,
    disposed: 0, document: { getElementById: id => controls.get(id), addEventListener() {} },
  });
  vm.runInContext(source('settings.js'), context);
  vm.runInContext(source('tracks.js'), context);
  vm.runInContext(source('sketch.js'), context);
  vm.runInContext('setupSettingsPanel(); population = [{ dispose() { disposed++; } }]; savedVehicles = [{ dispose() { disposed++; } }]; generationCount = 8;', context);
  assert.equal(controls.get('settings-panel').hidden, true);
  controls.get('settings-toggle').click();
  assert.equal(controls.get('settings-panel').hidden, false);
  controls.get('settings-close').click();
  assert.equal(controls.get('settings-panel').hidden, true);
  controls.get('apply-settings').click();

  assert.equal(vm.runInContext('disposed', context), 2);
  assert.equal(constructed.length, 100);
  assert.equal(vm.runInContext('population.length', context), 100);
  assert.equal(vm.runInContext('generationCount', context), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('ACTIVE_CONFIG', context))), {
    sensorRange: 130, sensorCount: 9, sensorAngle: 150, maxSpeed: 7.5, trackWidth: 80, hiddenNeurons: 20,
  });
  const firstCheckpoint = vm.runInContext('checkpoints[0]', context);
  assert.ok(Math.abs(Math.hypot(firstCheckpoint.a.x - firstCheckpoint.b.x, firstCheckpoint.a.y - firstCheckpoint.b.y) - 80) < 1e-8);

  const monacoPool = vm.runInContext('population', context);
  vm.runInContext('generationCount = 4', context);
  controls.get('track-select').change({ target: { value: 'singapore' } });
  assert.equal(vm.runInContext('generationCount', context), 0);
  const singaporePool = vm.runInContext('population', context);
  assert.notEqual(singaporePool, monacoPool);
  vm.runInContext('generationCount = 2', context);
  controls.get('track-select').change({ target: { value: 'monaco' } });
  assert.equal(vm.runInContext('population', context), monacoPool);
  assert.equal(vm.runInContext('generationCount', context), 4);
});
