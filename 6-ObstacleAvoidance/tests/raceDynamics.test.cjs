const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RACE_OFF_TRACK_GRACE,
  buildRaceInputs,
  getRaceDifficulty,
  getRaceGrid,
  getRaceLookahead,
  getRaceOutcome,
  projectRaceProgress,
  sampleRacePath,
  shouldCrashRacer,
} = require('../raceDynamics.js');

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

test('three race difficulties change pace, time limit and recovery window equally for all racers', () => {
  const easy = getRaceDifficulty('easy');
  const normal = getRaceDifficulty('normal');
  const hard = getRaceDifficulty('hard');
  assert.equal(easy.label, 'Détente');
  assert.ok(easy.opponentSpeed < normal.opponentSpeed);
  assert.ok(normal.opponentSpeed < hard.opponentSpeed);
  assert.equal(easy.playerSpeed, easy.opponentSpeed);
  assert.equal(normal.playerSpeed, normal.opponentSpeed);
  assert.equal(hard.playerSpeed, hard.opponentSpeed);
  assert.ok(easy.timeLimit > normal.timeLimit && normal.timeLimit > hard.timeLimit);
  assert.ok(easy.offTrackGrace > normal.offTrackGrace && normal.offTrackGrace > hard.offTrackGrace);
  assert.equal(getRaceDifficulty('unknown'), normal);
});

test('race outcome clearly distinguishes a completed lap, a crash, a timeout and an active race', () => {
  assert.equal(getRaceOutcome(100, 100, false, 20, 60), 'finished');
  assert.equal(getRaceOutcome(60, 100, true, 20, 60), 'off-track');
  assert.equal(getRaceOutcome(60, 100, false, 60, 60), 'timeout');
  assert.equal(getRaceOutcome(60, 100, false, 20, 60), 'in-progress');
  assert.throws(() => getRaceOutcome(NaN, 100, false, 20, 60), TypeError);
});

test('the starting grid places every racer in a spaced lane with a valid heading', () => {
  const grid = getRaceGrid(9, square);
  assert.equal(grid.length, 9);
  assert.equal(grid[0].progress, 0);
  assert.ok(grid[0].heading >= -Math.PI && grid[0].heading <= Math.PI);
  assert.ok(Math.hypot(grid[0].x - grid[1].x, grid[0].y - grid[1].y) >= 25);
  assert.ok(grid[2].progress < grid[0].progress);
  assert.throws(() => getRaceGrid(-1, square), TypeError);
});

test('closed-path sampling and lookahead work before the start and across the lap seam', () => {
  assert.deepEqual(sampleRacePath(square, 0), square[0]);
  assert.deepEqual(sampleRacePath(square, -1), square[3]);
  assert.deepEqual(getRaceLookahead(square, 0, 1), square[1]);
  assert.equal(sampleRacePath([], 0), null);
});

test('race progress projection stays unwrapped on either side of the start line', () => {
  const beforeStart = projectRaceProgress({ x: 0, y: 10 }, square, -0.1);
  assert.ok(Math.abs(beforeStart.progress + 0.1) < 1e-9);
  assert.ok(beforeStart.distance < 1e-9);

  const afterLap = projectRaceProgress({ x: 10, y: 0 }, square, 3.9);
  assert.ok(Math.abs(afterLap.progress - 4.1) < 1e-9);
});

test('a close wall sensor is not a crash; sustained off-track time is', () => {
  assert.ok(RACE_OFF_TRACK_GRACE > 75);
  assert.equal(shouldCrashRacer(75), false);
  assert.equal(shouldCrashRacer(RACE_OFF_TRACK_GRACE), false);
  assert.equal(shouldCrashRacer(RACE_OFF_TRACK_GRACE + 1), true);
  assert.equal(shouldCrashRacer(Infinity), false);
});

test('neural inputs encode the signed route angle and track offset with five wall sensors', () => {
  const sensors = Array.from({ length: 5 }, (_, index) => ({ normalizedDistance: index / 4 }));
  const common = {
    sensorReadings: sensors,
    speed: 2,
    maxSpeed: 4,
    position: { x: 0, y: 12 },
    heading: 0,
    target: { x: 0, y: 20 },
    pathCenter: { x: 12, y: 0 },
    tangent: { x: 0, y: 1 },
    trackHalfWidth: 20,
  };
  const inputs = buildRaceInputs(common.sensorReadings, common.speed, common.maxSpeed,
    common.position, common.heading, common.target, common.pathCenter, common.tangent, common.trackHalfWidth);

  assert.equal(inputs.length, 8);
  assert.deepEqual(inputs.slice(0, 6), [0, 0.25, 0.5, 0.75, 1, 0.5]);
  assert.equal(inputs[6], 0.5);
  assert.equal(inputs[7], 0.6);
  const leftTurn = buildRaceInputs(sensors, 2, 4, common.position, Math.PI,
    common.target, common.pathCenter, common.tangent, 20);
  assert.equal(leftTurn[6], -0.5);
  assert.throws(() => buildRaceInputs(sensors.slice(1), 2, 4, common.position,
    0, common.target, common.pathCenter, common.tangent, 20), TypeError);
});
