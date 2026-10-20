const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { if (typeof x === 'object') { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.hypot(this.x, this.y); }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  normalize() { return this.mag() ? this.div(this.mag()) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  static sub(a, b) { return a.copy().sub(b); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

function seededRandom(seed = 1234) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function loadGame(seed = 1234) {
  const math = Object.create(Math);
  math.random = seededRandom(seed);
  const saved = new Map();
  const context = vm.createContext({
    Math: math, console, performance,
    p5: { Vector }, createVector: (x, y) => new Vector(x, y),
    PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, width: 1280, height: 720,
    frameCount: 1, deltaTime: 16.667, millis: () => 1000,
    random: (a = 1, b) => b === undefined ? math.random() * a : a + math.random() * (b - a),
    constrain: (n, low, high) => Math.max(low, Math.min(high, n)),
    map: (n, a, b, low, high) => low + (n - a) / (b - a) * (high - low),
    sq: n => n * n,
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    document: { getElementById: () => null },
    clearTimeout() {}, setTimeout() {},
  });
  const files = ['gameRules.js', 'vehicle.js', 'gardenBehaviors.js', 'gardenGenetics.js',
    'gardenTree.js', 'gardenBed.js', 'gardenFood.js', 'shadowMoth.js', 'firefly.js', 'cat.js',
    'escortCat.js', 'missionBeacon.js', 'extractionZone.js', 'gardenMissions.js', 'catConversation.js', 'raceBrain.js',
    'raceDynamics.js', 'raceTrainee.js', 'personalTraining.js', 'gardenClub.js', 'sketch.js'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8'), context, { filename: file });
  const classes = vm.runInContext('({ Vehicle, Cat, EscortCat, ShadowMoth, GardenTree, GardenBed, GardenFood, Firefly, GardenMissions, MissionBeacon, GardenBehaviors, GardenGenetics, CatConversation, CatRaceNetwork, RaceTrainee, PersonalTraining })', context);
  return { context, ...classes, run: source => vm.runInContext(source, context), saved };
}
module.exports = { loadGame, Vector, seededRandom };
