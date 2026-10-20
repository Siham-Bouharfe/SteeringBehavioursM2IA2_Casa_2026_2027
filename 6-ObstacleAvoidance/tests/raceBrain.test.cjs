const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CatRaceNetwork,
  RACE_BRAIN_HIDDEN,
  RACE_BRAIN_INPUTS,
  RACE_BRAIN_VERSION,
  RACE_SENSOR_ANGLES,
  RACE_SENSOR_RANGE,
  castRaceRay,
  raceFitness,
  raceSteeringCommand,
  selectRaceParent,
  prepareIndividualRaceBrains,
  evolveIndividualRaceBrains,
} = require('../raceBrain.js');

test('9-b network uses sensors, speed and route context in an 8-20-2 topology', () => {
  const network = new CatRaceNetwork(null, () => 0.75);
  const outputs = network.predict([1, 0.8, 0.5, 0.7, 1, 0.4, 0, 0]);

  assert.equal(RACE_SENSOR_ANGLES.length, 5);
  assert.equal(RACE_SENSOR_RANGE, 150);
  assert.equal(RACE_BRAIN_INPUTS, 8);
  assert.equal(RACE_BRAIN_HIDDEN, 20);
  assert.equal(network.raceBrainVersion, RACE_BRAIN_VERSION);
  assert.equal(network.inputWeights.length, 20);
  assert.equal(network.inputWeights[0].length, 8);
  assert.equal(network.outputWeights.length, 2);
  assert.ok(outputs.every(value => value >= 0 && value <= 1));
});

test('ray sensors return the nearest wall hit and a normalized clear distance', () => {
  const origin = { x: 0, y: 0 };
  const walls = [{ a: { x: 80, y: -20 }, b: { x: 80, y: 20 } }];
  const hit = castRaceRay(origin, 0, walls, 150);
  const clear = castRaceRay(origin, Math.PI / 2, walls, 150);

  assert.equal(hit.distance, 80);
  assert.equal(hit.normalizedDistance, 80 / 150);
  assert.deepEqual(hit.end, { x: 80, y: 0 });
  assert.equal(clear.distance, 150);
  assert.equal(clear.normalizedDistance, 1);
});

test('race neural network copies independently and mutates only selected genes with deterministic noise', () => {
  const network = new CatRaceNetwork(null, () => 0.75);
  const copy = network.copy();
  let calls = 0;
  copy.mutate(1, () => (calls++ % 2 === 0 ? 0.75 : 0.5));

  assert.notDeepEqual(copy.inputWeights, network.inputWeights);
  assert.ok(copy.inputWeights.flat().every(weight => weight <= 12 && weight >= -12));
  assert.ok(Math.abs(copy.inputWeights[0][6] - 8) < 0.5,
    'Une mutation légère ne doit pas écrêter brutalement le poids expert initial de 8 à 4');
  assert.equal(network.inputWeights[0][6], 8);
  assert.equal(network.inputWeights[1][2], -10);
  assert.deepEqual(network.inputWeights.slice(2), Array.from({ length: 18 }, () => Array(8).fill(0)));
});

test('seed network turns toward its route input and maintains forward throttle', () => {
  const network = new CatRaceNetwork();
  const turnLeft = network.predict([1, 1, 1, 1, 1, 0.4, -0.5, 0]);
  const straight = network.predict([1, 1, 1, 1, 1, 0.4, 0, 0]);
  const turnRight = network.predict([1, 1, 1, 1, 1, 0.4, 0.5, 0]);

  assert.ok(turnLeft[0] < 0.5);
  assert.ok(Math.abs(straight[0] - 0.5) < 1e-12);
  assert.ok(turnRight[0] > 0.5);
  assert.ok(straight[1] > 0.85);
});

test('race neural network rejects invalid inputs, old genomes and mutation rates', () => {
  const network = new CatRaceNetwork(null, () => 0.5);
  assert.throws(() => network.predict([0, 0, Infinity, 1]), TypeError);
  assert.throws(() => network.predict([1, 1, 1, 1, 1, 1]), TypeError);
  assert.throws(() => network.mutate(1.1), RangeError);
  assert.throws(() => new CatRaceNetwork({ inputWeights: [[1]], hiddenBiases: [] }), TypeError);
  assert.throws(() => new CatRaceNetwork({ ...network, raceBrainVersion: RACE_BRAIN_VERSION - 1 }), TypeError);
});

test('tournament selection favors the best checkpoint fitness and fitness rewards progress safely', () => {
  const population = [
    { name: 'slow', fitness: 10 },
    { name: 'leader', fitness: 80 },
    { name: 'middle', fitness: 35 },
  ];
  assert.equal(selectRaceParent(population, () => 0.4, 3).name, 'leader');
  assert.ok(raceFitness({ raceProgress: 2, raceFinishedAt: null }, 10) >
    raceFitness({ raceProgress: 1, raceFinishedAt: null }, 10));
  assert.ok(raceFitness({ raceProgress: 2, raceFinishedAt: 9, raceCrashed: false }, 10) >
    raceFitness({ raceProgress: 2, raceFinishedAt: 10, raceCrashed: true }, 10));
});

test('tournament selection rejects an empty population', () => {
  assert.throws(() => selectRaceParent([], () => 0), RangeError);
});

test('every cat mutates and selects only its own personal race brain', () => {
  const cats = ['Minette', 'Moka', 'Plume'].map(name => ({
    name,
    raceBrain: new CatRaceNetwork(),
    raceProgress: 1,
    raceFinishedAt: null,
    raceCrashed: false,
    raceBrainTrainingEligible: true,
  }));
  let randomState = 19283;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const champions = {};
  const learning = {};
  prepareIndividualRaceBrains(cats, cats[0], champions, learning, 'normal', random);

  const brainSignatures = cats.map(cat => JSON.stringify(cat.raceBrain));
  assert.equal(new Set(brainSignatures).size, cats.length,
    'new racers should begin with independent, diversified genomes');
  for (const [index, cat] of cats.entries()) {
    cat.raceBrain.outputBiases[0] += (index + 1) * 0.25;
    cat.raceProgress = 5 + index;
  }
  const promoted = evolveIndividualRaceBrains(cats, cats[0], 12, 'normal', champions, learning);

  assert.equal(promoted, cats.length);
  assert.deepEqual(cats.map(cat => learning[cat.raceBrainKey].races), [1, 1, 1]);
  assert.deepEqual(cats.map(cat => learning[cat.raceBrainKey].generation), [1, 1, 1]);
  assert.equal(new Set(cats.map(cat => JSON.stringify(champions[cat.raceBrainKey]))).size, cats.length,
    'promotion must never copy another cat’s genome');

  const championBiases = cats.map(cat => champions[cat.raceBrainKey].outputBiases[0]);
  prepareIndividualRaceBrains(cats, cats[0], champions, learning, 'normal', random);
  assert.ok(cats.every(cat =>
    JSON.stringify(cat.raceBrain) !== JSON.stringify(champions[cat.raceBrainKey])),
  'the next individual challenge should mutate that cat’s own champion');
  for (const cat of cats) cat.raceProgress = 0;
  const promotedSecondRound = evolveIndividualRaceBrains(
    cats, cats[0], 100, 'normal', champions, learning
  );

  assert.equal(promotedSecondRound, 0, 'a worse trial must not replace any personal champion');
  assert.deepEqual(cats.map(cat => champions[cat.raceBrainKey].outputBiases[0]), championBiases);
});

test('manually driven Minette is not credited with autonomous neural learning', () => {
  const minette = {
    name: 'Minette',
    raceBrain: new CatRaceNetwork(),
    raceProgress: 8,
    raceFinishedAt: null,
    raceCrashed: false,
    raceBrainTrainingEligible: false,
  };
  const saved = { player: minette.raceBrain.copy() };
  const learning = {
    player: { races: 2, generation: 1, bestFitness: 100, difficulty: 'normal', mutationRate: 0.06 },
  };

  const promoted = evolveIndividualRaceBrains([minette], minette, 10, 'normal', saved, learning);

  assert.equal(promoted, 0);
  assert.equal(learning.player.races, 2);
  assert.equal(learning.player.bestFitness, 100);
});

test('race output becomes a steering force bounded by maxForce and a speed bounded by maxSpeed', () => {
  const command = raceSteeringCommand({ x: 8, y: -4 }, [1, 1], 6, 0.5);
  assert.ok(Math.hypot(command.force.x, command.force.y) <= 0.5 + 1e-12);
  assert.ok(command.desiredSpeed <= 6);
  assert.ok(command.desiredHeading > Math.atan2(-4, 8));
  assert.throws(() => raceSteeringCommand({ x: 0, y: 0 }, [2, 0], 6, 0.5), TypeError);
});
