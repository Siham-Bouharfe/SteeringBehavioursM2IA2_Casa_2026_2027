import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const folder = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v, y) { if (typeof v === 'number') { this.x += v; this.y += y; } else { this.x += v.x; this.y += v.y; } return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const m = this.mag(); if (m) this.div(m); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

function loadClasses() {
  const context = vm.createContext({
    console, Math, window: {}, WANDER_WEIGHT: 0.08, PI: Math.PI,
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    random: () => 0, min: Math.min, max: Math.max,
    cos: Math.cos, sin: Math.sin, debug: false,
  });
  for (const file of ['vehicle.js', 'anneauChat.js', 'chat.js']) {
    vm.runInContext(readFileSync(path.join(folder, file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('({ Chat, AnneauChat, Vehicle })', context);
}

test('Chat et chaque anneau sont des Vehicle; la chaîne contient le nombre demandé', () => {
  const { Chat, Vehicle } = loadClasses();
  const chat = new Chat(100, 100, 0, '#888', 5);
  assert.ok(chat instanceof Vehicle);
  assert.equal(chat.parts().length, 6);
  assert.ok(chat.rings.every(ring => ring instanceof Vehicle));
});

test('la longueur de la chaîne peut changer sans casser les indices des anneaux', () => {
  const { Chat } = loadClasses();
  const chat = new Chat(100, 100, 0, '#888', 2);
  chat.setRingCount(5);
  assert.equal(chat.rings.length, 5);
  assert.deepEqual(Array.from(chat.rings, ring => ring.segmentIndex), [1, 2, 3, 4, 5]);
  chat.setRingCount(1);
  assert.equal(chat.rings.length, 1);
  assert.equal(chat.rings[0].segmentIndex, 1);
});

test('l’espacement des anneaux peut être modifié sur un chat existant', () => {
  const { Chat } = loadClasses();
  const chat = new Chat(100, 100, 0, '#888', 2, 26);
  chat.setRingSpacing(42);
  assert.equal(chat.ringSpacing, 42);
  chat.setRingCount(3);
  assert.equal(chat.rings.length, 3);
  assert.equal(chat.ringSpacing, 42);
});

test('arrive produit une force bornée et réduit la vitesse désirée près du point', () => {
  const { Chat } = loadClasses();
  const chat = new Chat(0, 0, 0, '#888', 1);
  const ring = chat.rings[0];
  ring.pos.set(0, 0);
  ring.vel.set(0, 0);
  const near = ring.arrive(new Vector(2, 0), 48);
  const far = ring.arrive(new Vector(200, 0), 48);
  assert.ok(near.mag() < far.mag());
  assert.ok(far.mag() <= ring.maxForce + 1e-9);
  assert.deepEqual([near.x, near.y], [ring.maxSpeed * 2 / 48, 0]);
});

test('la séparation ignore les voisins immédiats du même chat, mais garde les autres chats', () => {
  const { Chat } = loadClasses();
  const first = new Chat(100, 100, 0, '#888', 3);
  const second = new Chat(200, 100, 0, '#a88', 1);
  const parts = [...first.parts(), ...second.parts()];
  const neighbors = first.neighborsFor(first.rings[0], parts);
  assert.ok(!neighbors.includes(first));
  assert.ok(!neighbors.includes(first.rings[1]));
  assert.ok(neighbors.includes(first.rings[2]));
  assert.ok(neighbors.includes(second));
});

test('les poids des comportements modulent les forces et steer alimente chaque segment', () => {
  const { Chat } = loadClasses();
  const chat = new Chat(100, 100, 0, '#888', 2);
  chat.follow = () => new Vector(1, 0);
  chat.separate = () => new Vector(0, 1);
  chat.wander = () => new Vector(1, 1);
  for (const ring of chat.rings) {
    ring.arrive = () => new Vector(1, 0);
    ring.separate = () => new Vector(0, 1);
  }
  chat.steer({ points: [] }, chat.parts(), 2, 3);
  assert.deepEqual([chat.acc.x, chat.acc.y], [2 + 0.08, 3 + 0.08]);
  for (const ring of chat.rings) {
    assert.deepEqual([ring.acc.x, ring.acc.y], [2, 3]);
  }
});

test('separate repousse un voisin proche et respecte maxForce', () => {
  const { Chat } = loadClasses();
  const chat = new Chat(100, 100, 0, '#888', 0);
  const neighbor = new Chat(110, 100, 0, '#a88', 0);
  const force = chat.separate([neighbor]);
  assert.ok(force.x < 0);
  assert.ok(force.mag() <= chat.maxForce + 1e-9);
  assert.deepEqual([chat.separate([new Chat(500, 500, 0, '#a88', 0)]).x,
    chat.separate([new Chat(500, 500, 0, '#a88', 0)]).y], [0, 0]);
});

test('le sketch démarre avec un chat et exécute une frame', () => {
  const listeners = new Map();
  const controls = new Map([
    ['follow-weight', '1.4'], ['separation-weight', '1.2'], ['path-width', '40'], ['chat-length', '12'],
    ['ring-spacing', '26'], ['follow-value', '1.4'], ['separation-value', '1.2'],
    ['path-width-value', '40 px'], ['chat-length-value', '12 anneaux'], ['ring-spacing-value', '26 px'],
  ].map(([id, value]) => [id, {
    value,
    addEventListener: (event, listener) => listeners.set(id, listener),
    set textContent(text) { this.text = text; },
  }]));
  const noOp = () => {};
  const context = vm.createContext({
    console, Math, window: {}, windowWidth: 900, windowHeight: 700, width: 900, height: 700,
    WANDER_WEIGHT: 0.08, PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, ROUND: 'round', CLOSE: 'close',
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    random: (min = 0, max) => max === undefined ? min / 2 : (min + max) / 2,
    min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin,
    document: { getElementById: id => controls.get(id) },
    color: (...args) => args, lerpColor: (a, b) => a,
    ...Object.fromEntries(['createCanvas', 'background', 'strokeJoin', 'stroke', 'strokeWeight', 'noFill',
      'beginShape', 'vertex', 'endShape', 'fill', 'ellipse', 'line', 'push', 'translate', 'rotate',
      'noStroke', 'triangle', 'circle', 'pop'].map(name => [name, noOp])),
  });
  for (const file of ['path.js', 'vehicle.js', 'anneauChat.js', 'chat.js', 'sketch.js']) {
    vm.runInContext(readFileSync(path.join(folder, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext('setup(); draw();', context);
  assert.equal(vm.runInContext('chats.length', context), 1);
  assert.equal(vm.runInContext('chats[0].rings.length', context), 12);

  const originalPathPoint = vm.runInContext('[path.points[0].x, path.points[0].y]', context);
  controls.get('path-width').value = '60';
  listeners.get('path-width')();
  assert.equal(controls.get('path-width-value').text, '60 px');
  assert.equal(vm.runInContext('path.radius', context), 30);
  assert.deepEqual(vm.runInContext('[path.points[0].x, path.points[0].y]', context), originalPathPoint);

  controls.get('chat-length').value = '4';
  listeners.get('chat-length')();
  assert.equal(vm.runInContext('chats[0].rings.length', context), 4);
  assert.equal(controls.get('chat-length-value').text, '4 anneaux');

  controls.get('ring-spacing').value = '38';
  listeners.get('ring-spacing')();
  assert.equal(vm.runInContext('chats[0].ringSpacing', context), 38);
  assert.equal(controls.get('ring-spacing-value').text, '38 px');
});
