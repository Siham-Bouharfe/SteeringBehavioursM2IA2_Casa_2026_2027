const test = require('node:test');
const assert = require('node:assert/strict');
const {
  threatWeight,
  composeSteering,
  predictiveFleeForce,
  nearestThreat,
  segmentProjectionAmount,
  screenPointToGround,
  waveOutcome,
  missionForContract,
  canCollectRescueGroup,
  canCompleteEvacuation,
  rescueQuota,
  canDeliverRescueGroup,
  rescueContractReward,
  createGenome,
  mutateGenome,
  evaluateBrain,
  movementAxes,
  playerDriveIntent,
  normalizeMovementKey,
  worldToMinimap,
  remainingCooldown,
  keepUnexpiredEffects,
} = require('../gameRules.js');

test('keyboard movement supports WASD, ZQSD and arrow keys', () => {
  assert.deepEqual(movementAxes(new Set(['w', 'd'])), { x: 1, y: -1 });
  assert.deepEqual(movementAxes(new Set(['z', 'q'])), { x: -1, y: -1 });
  assert.deepEqual(movementAxes(new Set(['arrowdown', 'arrowleft'])), { x: -1, y: 1 });
  assert.deepEqual(movementAxes(new Set(['>'])), { x: 1, y: 0 });
  assert.deepEqual(movementAxes(new Set()), { x: 0, y: 0 });
});

test('le chat avance selon son regard, recule sans se retourner et pivote à droite/gauche', () => {
  const ahead = playerDriveIntent(-Math.PI / 2, { x: 0, y: -1 }, 1, 4);
  assert.ok(Math.abs(ahead.desiredVelocity.x) < 1e-9);
  assert.ok(ahead.desiredVelocity.y < 0);
  assert.equal(ahead.heading, -Math.PI / 2);

  const backwards = playerDriveIntent(-Math.PI / 2, { x: 0, y: 1 }, 1, 4);
  assert.ok(backwards.desiredVelocity.y > 0);
  assert.equal(backwards.heading, -Math.PI / 2);
  assert.equal(backwards.direction, -1);

  const right = playerDriveIntent(-Math.PI / 2, { x: 1, y: 0 }, 1, 4);
  const left = playerDriveIntent(-Math.PI / 2, { x: -1, y: 0 }, 1, 4);
  assert.ok(right.heading > -Math.PI / 2);
  assert.ok(left.heading < -Math.PI / 2);
  assert.deepEqual(right.desiredVelocity, { x: 0, y: 0 });

  const turningAhead = playerDriveIntent(-Math.PI / 2, { x: 1, y: -1 }, 1, 4);
  assert.ok(turningAhead.desiredVelocity.x > 0);
  assert.ok(turningAhead.desiredVelocity.y < 0);
  assert.deepEqual(playerDriveIntent(0, { x: 0, y: 0 }, 1, 4).desiredVelocity, { x: 0, y: 0 });
  assert.throws(() => playerDriveIntent(NaN, { x: 0, y: 0 }, 1, 4), TypeError);
});

test('movement keys normalize by physical arrow-key code across keyboard layouts', () => {
  assert.equal(normalizeMovementKey('ArrowRight', 'ArrowRight'), 'arrowright');
  assert.equal(normalizeMovementKey('>', 'Period'), '>');
  assert.equal(normalizeMovementKey('D', 'KeyD'), 'd');
  assert.equal(normalizeMovementKey(' ', 'Space'), ' ');
});

test('minimap mapping fits the full city and rejects invalid dimensions', () => {
  const topLeft = worldToMinimap({ x: 0, y: 0 }, 3600, 3000, 170, 127);
  const bottomRight = worldToMinimap({ x: 3600, y: 3000 }, 3600, 3000, 170, 127);
  assert.ok(Math.abs(topLeft.x - 8.8) < 1e-9);
  assert.equal(topLeft.y, 0);
  assert.ok(Math.abs(bottomRight.x - 161.2) < 1e-9);
  assert.ok(Math.abs(bottomRight.y - 127) < 1e-9);
  assert.equal(worldToMinimap({ x: 0, y: 0 }, 0, 3000, 170, 127), null);
});

test('decoy cooldown expires cleanly and expired effects are removed', () => {
  assert.equal(remainingCooldown(4, 1.5), 2.5);
  assert.equal(remainingCooldown(0.2, 1), 0);
  assert.equal(remainingCooldown(-2, 0.5), 0);
  const effects = [{ expiresAt: 100 }, { expiresAt: 101 }, null];
  assert.deepEqual(keepUnexpiredEffects(effects, 100), [{ expiresAt: 101 }]);
});

test('flee weight rises as a threat gets closer and is zero outside range', () => {
  assert.equal(threatWeight(200, 200), 0);
  assert.equal(threatWeight(100, 200), 0.5);
  assert.equal(threatWeight(0, 200), 1);
  assert.equal(threatWeight(2, 0), 0);
});

test('weighted steering combines flock and obstacle forces without exceeding maxForce', () => {
  const combined = composeSteering([
    { force: { x: 0.1, y: 0 }, weight: 1 },
    { force: { x: 0, y: 0.1 }, weight: 2 },
  ], 0.2);
  assert.ok(combined.x > 0 && combined.y > 0);
  assert.ok(Math.hypot(combined.x, combined.y) <= 0.2 + Number.EPSILON);
  assert.deepEqual(composeSteering([], 0.2), { x: 0, y: 0 });
});

test('predictive flee points away from future threat position and respects maxForce', () => {
  const force = predictiveFleeForce(
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 1, y: 0 }, 3, 0.2, 4,
  );
  assert.ok(force.x < 0);
  assert.equal(force.y, 0);
  assert.ok(Math.hypot(force.x, force.y) <= 0.2 + Number.EPSILON);

  const coincident = predictiveFleeForce(
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 3, 0.2, 4,
  );
  assert.deepEqual(coincident, { x: 0.2, y: 0 });
});

test('nearestThreat selects only the nearest threat inside the perception radius', () => {
  const agent = { x: 0, y: 0 };
  const close = { x: 10, y: 0 };
  const threats = [{ x: 80, y: 0 }, close, { x: 300, y: 0 }];
  assert.equal(nearestThreat(agent, threats, 100), close);
  assert.equal(nearestThreat(agent, threats, 9), null);
});

test('path projection clamps to the segment and handles a zero-length segment', () => {
  assert.equal(segmentProjectionAmount({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 0.5);
  assert.equal(segmentProjectionAmount({ x: -2, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 0);
  assert.equal(segmentProjectionAmount({ x: 13, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 1);
  assert.equal(segmentProjectionAmount({ x: 3, y: 3 }, { x: 1, y: 1 }, { x: 1, y: 1 }), 0);
});

test('oblique-camera pointer rays map screen center and preserve the ground axes', () => {
  const config = { width: 1280, height: 720, elevation: Math.PI * 0.38, distance: 1000, fov: Math.PI / 4 };
  const center = screenPointToGround(640, 360, config.width, config.height, config.elevation, config.distance, config.fov);
  const topLeft = screenPointToGround(0, 0, config.width, config.height, config.elevation, config.distance, config.fov);
  const bottomRight = screenPointToGround(1280, 720, config.width, config.height, config.elevation, config.distance, config.fov);
  assert.ok(Math.abs(center.x - 640) < 1e-8);
  assert.ok(Math.abs(center.y - 360) < 1e-8);
  assert.ok(topLeft.x > center.x && topLeft.y < center.y);
  assert.ok(bottomRight.x < center.x && bottomRight.y > center.y);
});

test('the final wave only awards victory while at least one cat survives', () => {
  assert.equal(waveOutcome(5, 5, 3), null);
  assert.equal(waveOutcome(6, 5, 1), 'victory');
  assert.equal(waveOutcome(6, 5, 0), 'defeat');
});

test('the five Miaou City contracts form a playable campaign and reject invalid indexes', () => {
  assert.equal(missionForContract(1).type, 'rescue');
  assert.equal(missionForContract(3).target, 4);
  assert.match(missionForContract(5).title, /Extraction/);
  assert.equal(missionForContract(0), null);
  assert.equal(missionForContract(6), null);
});

test('rescue pickups use combined radii and evacuation checks the mission quota', () => {
  assert.equal(canCollectRescueGroup(40, 16, 24), true);
  assert.equal(canCollectRescueGroup(41, 16, 24), false);
  assert.equal(canCompleteEvacuation(7, 8), false);
  assert.equal(canCompleteEvacuation(8, 8), true);
});

test('rescue contracts scale the group quota, require entering the refuge and award progression rewards', () => {
  assert.equal(rescueQuota(1), 3);
  assert.equal(rescueQuota(2), 4);
  assert.equal(rescueQuota(99), 5);
  assert.equal(canDeliverRescueGroup(70, 58, 12, 3, 3), true);
  assert.equal(canDeliverRescueGroup(71, 58, 12, 3, 3), false);
  assert.equal(canDeliverRescueGroup(20, 58, 12, 2, 3), false);
  assert.equal(rescueContractReward(1, 3), 185);
  assert.equal(rescueContractReward(3, 5), 295);
  assert.equal(rescueContractReward(0, 3), 0);
});

test('genetic mutation is reproducible and keeps traits within playable limits', () => {
  const parent = { speedFactor: 1, predictionFrames: 10, sensorLength: 100, brainWeights: Array(16).fill(0) };
  const increase = mutateGenome(parent, () => 1);
  const decrease = mutateGenome(parent, () => 0);
  assert.deepEqual(increase, { speedFactor: 1.12, predictionFrames: 12, sensorLength: 118, brainWeights: Array(16).fill(0.22) });
  assert.deepEqual(decrease, { speedFactor: 0.88, predictionFrames: 8, sensorLength: 82, brainWeights: Array(16).fill(-0.22) });
  assert.ok(mutateGenome({ ...parent, speedFactor: 9, predictionFrames: 90, sensorLength: 900 }, () => 1).speedFactor <= 1.28);
  assert.ok(mutateGenome({ ...parent, speedFactor: 0, predictionFrames: 0, sensorLength: 0 }, () => 0).sensorLength >= 65);
});

test('the small neural controller is deterministic for fixed genes', () => {
  assert.equal(evaluateBrain({ brainWeights: Array(16).fill(0) }, [0, 0, 0]), 0.5);
  const genome = createGenome(() => 0.5);
  assert.deepEqual(genome.brainWeights, Array(16).fill(0));
  assert.equal(evaluateBrain(genome, [1, 0.5, 1]), 0.5);
});
