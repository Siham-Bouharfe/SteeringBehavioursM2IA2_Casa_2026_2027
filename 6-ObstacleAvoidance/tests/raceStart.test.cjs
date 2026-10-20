const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameRules = require('../gameRules.js');
const RaceBrain = require('../raceBrain.js');
const RaceDynamics = require('../raceDynamics.js');

class TestVector {
  constructor(x, y) { this.x = x; this.y = y; }
  copy() { return new TestVector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(vector) { this.x += vector.x; this.y += vector.y; return this; }
  sub(vector) { this.x -= vector.x; this.y -= vector.y; return this; }
  mult(value) { this.x *= value; this.y *= value; return this; }
  div(value) { this.x /= value; this.y /= value; return this; }
  normalize() { const length = this.mag(); return length ? this.div(length) : this; }
  setMag(value) { return this.normalize().mult(value); }
  limit(value) { if (this.mag() > value) this.setMag(value); return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.hypot(this.x, this.y); }
  heading() { return Math.atan2(this.y, this.x); }
}

function makeCat(name, x, y) {
  return {
    name,
    pos: new TestVector(x, y),
    vel: new TestVector(0, 0),
    maxSpeed: 2,
    maxForce: 0.13,
    raceBrain: null,
    acc: new TestVector(0, 0),
    seek(target) {
      const desired = new TestVector(target.x - this.pos.x, target.y - this.pos.y);
      if (desired.magSq()) desired.setMag(this.maxSpeed);
      return desired.sub(this.vel).limit(this.maxForce);
    },
    separation(cats, radius) {
      const force = new TestVector(0, 0);
      let count = 0;
      for (const other of cats) {
        if (other === this) continue;
        const offset = new TestVector(this.pos.x - other.pos.x, this.pos.y - other.pos.y);
        const distance = offset.mag();
        if (!distance || distance >= radius) continue;
        force.add(offset.normalize().div(distance));
        count++;
      }
      return count ? force.div(count).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce) : force;
    },
    applyForce(force) { this.acc.add(force); },
    update() {
      this.vel.add(this.acc).limit(this.maxSpeed);
      this.pos.add(this.vel);
      this.acc.set(0, 0);
    },
  };
}

test('starting Miaou Grand Prix initializes every racer and enters the countdown', () => {
  const countdownDisplay = { hidden: true, textContent: '' };
  const context = {
    ...RaceDynamics,
    ...RaceBrain,
    TestVector,
    createVector: (x, y) => new TestVector(x, y),
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    random: (min = 1, max) => max === undefined ? min * 0.5 : (min + max) / 2,
    GameRules,
    countdownDisplay,
    clearTimeout() {},
    setTimeout() {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gardenClub.js'), 'utf8'), context);
  const sketchPath = path.join(__dirname, '..', 'sketch.js');
  vm.runInContext(fs.readFileSync(sketchPath, 'utf8'), context, { filename: sketchPath });
  vm.runInContext(`
    gameState = 'running';
    playerCat = makeRaceTestCat('Minette', 0, 0);
    followers = [];
    strayCats = Array.from({ length: 8 }, (_, i) => makeRaceTestCat('Chat ' + i, i * 10, 0));
    raceTrack = { points: [
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }
    ] };
    raceLevel = 1;
    raceDifficulty = 'easy';
    audioFeedback = { play() {} };
    hud = {
      raceArcadeHud: { classList: { add() {} } },
      arcadeCountdown: countdownDisplay,
      toast: { textContent: '', hidden: true },
    };
    function makeRaceTestCat(name, x, y) {
      return {
        name, pos: new TestVector(x, y), vel: new TestVector(0, 0),
        maxSpeed: 2, maxForce: 0.13, raceBrain: null
      };
    }
    startCatRace();
  `, context);

  const result = vm.runInContext(`({
    state: gameState,
    countdown: raceCountdown,
    racers: raceParticipants.length,
    allInitialized: raceParticipants.every(cat =>
      Number.isFinite(cat.raceHeading) && cat.raceFinishedAt === null && cat.raceCrashed === false
    ),
    playerSpeed: playerCat.raceMaxSpeed,
    firstOpponentSpeed: raceParticipants[1].raceMaxSpeed,
    assignedFairStartingSlots: raceParticipants.every(cat =>
      getRaceGrid(raceParticipants.length, raceTrack.points).some(slot =>
        Math.hypot(cat.pos.x - slot.x, cat.pos.y - slot.y) < 1e-9))
  })`, context);

  assert.equal(result.state, 'raceCountdown');
  assert.equal(result.countdown, 3);
  assert.equal(result.racers, 9);
  assert.equal(result.allInitialized, true);
  assert.equal(result.assignedFairStartingSlots, true);
  assert.equal(result.playerSpeed, 2.65);
  assert.equal(result.firstOpponentSpeed, 2.65);
  assert.equal(countdownDisplay.hidden, false);
  assert.equal(countdownDisplay.textContent, '3');
});
