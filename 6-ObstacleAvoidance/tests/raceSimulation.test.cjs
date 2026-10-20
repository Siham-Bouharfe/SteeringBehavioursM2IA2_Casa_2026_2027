const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameRules = require('../gameRules.js');
const RaceBrain = require('../raceBrain.js');
const RaceDynamics = require('../raceDynamics.js');

class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  copy() { return new Vector(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.hypot(this.x, this.y); }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  normalize() { const length = this.mag(); return length > 0 ? this.div(length) : this; }
  setMag(value) { return this.normalize().mult(value); }
  limit(value) { if (this.mag() > value) this.setMag(value); return this; }
}

function makeRacer(name, slot, genomeSeed = null) {
  const brain = new RaceBrain.CatRaceNetwork();
  if (genomeSeed !== null) {
    let state = genomeSeed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    brain.mutate(0.04, random);
  }
  const predict = brain.predict.bind(brain);
  brain.__predictionCalls = 0;
  brain.predict = inputs => {
    brain.__predictionCalls++;
    return predict(inputs);
  };
  return {
    name,
    pos: new Vector(slot.x, slot.y),
    vel: new Vector(Math.cos(slot.heading) * 1.35, Math.sin(slot.heading) * 1.35),
    acc: new Vector(0, 0),
    maxSpeed: 2.9,
    maxForce: 0.13,
    raceMaxSpeed: 2.9,
    raceHeading: slot.heading,
    raceProgress: slot.progress,
    raceBrain: brain,
    raceFinishedAt: null,
    raceCrashed: false,
    raceOffTrackFrames: 0,
    seek(target) {
      const desired = new Vector(target.x - this.pos.x, target.y - this.pos.y);
      if (desired.magSq()) desired.setMag(this.maxSpeed);
      return desired.sub(this.vel).limit(this.maxForce);
    },
    separation(cats, radius) {
      const steer = new Vector(0, 0);
      let count = 0;
      for (const other of cats) {
        if (other === this) continue;
        const offset = new Vector(this.pos.x - other.pos.x, this.pos.y - other.pos.y);
        const distance = offset.mag();
        if (!distance || distance >= radius) continue;
        steer.add(offset.normalize().div(distance));
        count++;
      }
      return count ? steer.div(count).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce) : steer;
    },
    applyForce(force) { this.acc.add(force); },
    update() {
      this.vel.add(this.acc).limit(this.maxSpeed);
      this.pos.add(this.vel);
      this.acc.set(0, 0);
    },
  };
}

test('8-20-2 neural racers stay mobile and finish a complete circuit lap', () => {
  const context = {
    ...RaceBrain,
    ...RaceDynamics,
    GameRules,
    Vector,
    p5: { Vector: { sub: (a, b) => new Vector(a.x - b.x, a.y - b.y) } },
    createVector: (x, y) => new Vector(x, y),
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    console,
  };
  vm.createContext(context);
  const sketchPath = path.join(__dirname, '..', 'sketch.js');
  vm.runInContext(fs.readFileSync(sketchPath, 'utf8'), context, { filename: sketchPath });

  context.park = { x: 624, y: 624, w: 552, h: 552 };
  vm.runInContext('racePark = park; track = createRaceTrack();', context);
  const points = context.track.points;
  const grid = RaceDynamics.getRaceGrid(9, points);
  context.cats = grid.map((slot, index) => makeRacer(`Neural-${index}`, slot, index === 0 ? null : 700 + index));
  vm.runInContext(`
    raceTrack = track;
    raceParticipants = cats;
    playerCat = cats[0];
    keysDown.clear();
    raceElapsed = 0;
    for (let frame = 0; frame < 1600; frame++) {
      for (const racer of raceParticipants) {
        if (racer.raceFinishedAt === null) updateRacer(racer, 1);
      }
    }
  `, context);

  assert.ok(context.cats.every(cat => cat.raceProgress > 10), 'all networks should make sustained progress');
  assert.ok(context.cats.every(cat => !cat.raceCrashed), `seeded and evolved networks should remain on the circuit: ${context.cats.map(cat => `${cat.name} progress=${cat.raceProgress.toFixed(1)} crashed=${cat.raceCrashed} off=${cat.raceOffTrackFrames}`).join('; ')}`);
  assert.ok(context.cats.every(cat => cat.raceFinishedAt !== null), 'seeded and evolved neural racers should complete the lap');
  assert.ok(context.cats.every(cat => cat.raceBrain.__predictionCalls > 0),
    'each automatic racer, including the player when no keys are pressed, must use its neural network');
});

test('Zouin keeps using his neural network while keyboard keys are held', () => {
  const context = {
    ...RaceBrain,
    ...RaceDynamics,
    GameRules,
    Vector,
    p5: { Vector: { sub: (a, b) => new Vector(a.x - b.x, a.y - b.y) } },
    createVector: (x, y) => new Vector(x, y),
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    console,
  };
  vm.createContext(context);
  const sketchPath = path.join(__dirname, '..', 'sketch.js');
  vm.runInContext(fs.readFileSync(sketchPath, 'utf8'), context, { filename: sketchPath });
  context.park = { x: 624, y: 624, w: 552, h: 552 };
  vm.runInContext('racePark = park; track = createRaceTrack(); raceTrack = track;', context);
  const slot = RaceDynamics.getRaceGrid(1, context.track.points)[0];
  context.cats = [makeRacer('Zouin', slot)];
  context.cats[0].raceMaxSpeed = 3.7;
  context.cats[0].maxSpeed = 3.7;
  vm.runInContext(`
    playerCat = cats[0];
    raceParticipants = cats;
    raceDifficulty = 'easy';
    raceElapsed = 0;
    raceTimeLimit = 85;
    raceCountdown = 0;
    keysDown.add('arrowup');
  `, context);
  const initial = { x: context.cats[0].pos.x, y: context.cats[0].pos.y };

  vm.runInContext('for (let frame = 0; frame < 45; frame++) updateRacer(playerCat, 1);', context);

  assert.ok(context.cats[0].vel.mag() > 1.35, 'the neural throttle should accelerate Zouin');
  assert.ok(context.cats[0].raceBrain.__predictionCalls > 0);
  assert.equal(context.cats[0].raceBrainActive, true);
  assert.ok(Math.hypot(context.cats[0].pos.x - initial.x, context.cats[0].pos.y - initial.y) > 40,
    'the neural controller should move the cat along the course');
});

test('race works with the real Vehicle and Cat classes, not just test doubles', () => {
  const VectorWithStatics = Vector;
  VectorWithStatics.sub = (a, b) => a.copy().sub(b);
  VectorWithStatics.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const context = {
    ...RaceBrain,
    ...RaceDynamics,
    GameRules,
    p5: { Vector: VectorWithStatics },
    createVector: (x, y) => new Vector(x, y),
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    console,
  };
  vm.createContext(context);
  for (const filename of ['vehicle.js', 'cat.js', 'sketch.js']) {
    const sourcePath = path.join(__dirname, '..', filename);
    vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
  }
  context.park = { x: 624, y: 624, w: 552, h: 552 };
  vm.runInContext(`
    racePark = park;
    track = createRaceTrack();
    raceTrack = track;
    raceGrid = getRaceGrid(9, track.points);
    cats = raceGrid.map((slot, index) => {
      const cat = new Cat(slot.x, slot.y);
      cat.maxSpeed = cat.raceMaxSpeed = index === 0 ? 4 : 3.48;
      cat.raceHeading = slot.heading;
      cat.raceProgress = slot.progress;
      cat.raceFinishedAt = null;
      cat.raceCrashed = false;
      cat.raceOffTrackFrames = 0;
      cat.raceBrain = new CatRaceNetwork();
      return cat;
    });
    raceParticipants = cats;
    playerCat = cats[0];
    keysDown.clear();
    raceElapsed = 0;
    raceDifficulty = 'hard';
    for (let frame = 0; frame < 1600; frame++) {
      for (const racer of raceParticipants) {
        if (racer.raceFinishedAt === null) updateRacer(racer, 1);
      }
    }
  `, context);

  const result = vm.runInContext(`({
    areVehicles: cats.every(cat => cat instanceof Vehicle),
    finished: cats.every(cat => cat.raceFinishedAt !== null),
    stayedOnTrack: cats.every(cat => !cat.raceCrashed),
    progress: cats.map(cat => cat.raceProgress),
  })`, context);
  assert.equal(result.areVehicles, true);
  assert.equal(result.stayedOnTrack, true, JSON.stringify(result.progress));
  assert.equal(result.finished, true, JSON.stringify(result.progress));

  const playerResult = vm.runInContext(`
    const slot = raceGrid[0];
    const player = cats[0];
    playerCat = player;
    raceParticipants = [player];
    player.pos.set(slot.x, slot.y);
    player.vel.set(Math.cos(slot.heading) * 1.35, Math.sin(slot.heading) * 1.35);
    player.maxSpeed = player.raceMaxSpeed = 4;
    player.raceHeading = slot.heading;
    player.raceProgress = slot.progress;
    player.raceFinishedAt = null;
    player.raceCrashed = false;
    keysDown.add('arrowup');
    const start = player.pos.copy();
    for (let frame = 0; frame < 45; frame++) updateRacer(player, 1);
    ({ speed: player.vel.mag(), distance: p5.Vector.dist(start, player.pos) })
  `, context);
  assert.ok(playerResult.speed > 1.35, 'real Cat should respond to the accelerator');
  assert.ok(playerResult.distance > 40, 'real Cat should move along the race when driven');
});
