const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, seededRandom } = require('./helpers/gameHarness.cjs');

test('all three difficulties complete with neural commands alone; seek, separation and keys cannot pilot racers', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const game = loadGame();
    const result = game.run(`(() => {
      racePark = { x: 624, y: 624, w: 552, h: 552 };
      raceTrack = createRaceTrack();
      raceDifficulty = '${difficulty}';
      const grid = getRaceGrid(9, raceTrack.points);
      raceParticipants = grid.map((slot, index) => {
        const cat = new Cat(slot.x, slot.y);
        cat.name = 'Chat ' + index;
        cat.raceBrain = new CatRaceNetwork().mutate(0.025, Math.random);
        cat.raceProgress = slot.progress;
        cat.raceCourseLength = raceTrack.points.length;
        cat.raceHeading = slot.heading;
        cat.raceMaxSpeed = cat.maxSpeed = getRaceDifficulty(raceDifficulty).playerSpeed;
        cat.vel.set(Math.cos(slot.heading) * 1.35, Math.sin(slot.heading) * 1.35);
        cat.raceFinishedAt = null;
        cat.raceCrashed = false;
        cat.maxForce = 0.13;
        cat.seek = cat.separation = () => { throw new Error('Un pilote extérieur au réseau est actif'); };
        const predict = cat.raceBrain.predict.bind(cat.raceBrain);
        cat.calls = 0;
        cat.raceBrain.predict = inputs => { cat.calls++; return predict(inputs); };
        return cat;
      });
      playerCat = raceParticipants[0];
      keysDown.add('arrowleft'); keysDown.add('arrowdown');
      for (let frame = 0; frame < 2600; frame++) {
        raceElapsed = frame / 60;
        for (const cat of raceParticipants) if (cat.raceFinishedAt === null) updateRacer(cat, 1);
      }
      return raceParticipants.map(cat => ({ finished: cat.raceFinishedAt !== null && !cat.raceCrashed,
        calls: cat.calls, active: cat.raceBrainActive, progress: cat.raceProgress }));
    })()`);
    assert.ok(result.every(cat => cat.finished && cat.active && cat.calls > 0), `${difficulty}: ${JSON.stringify(result)}`);
  }
});

test('a disabled neural steering output cannot be rescued by a hidden path follower', () => {
  const game = loadGame();
  const result = game.run(`(() => {
    racePark = { x: 624, y: 624, w: 552, h: 552 }; raceTrack = createRaceTrack();
    const slot = getRaceGrid(1, raceTrack.points)[0];
    const cat = new Cat(slot.x, slot.y);
    cat.raceBrain = { predict: () => [0.5, 0] };
    cat.raceProgress = slot.progress; cat.raceHeading = slot.heading;
    cat.raceFinishedAt = null; cat.raceMaxSpeed = cat.maxSpeed = 3;
    cat.vel.set(Math.cos(slot.heading), Math.sin(slot.heading));
    playerCat = cat; raceParticipants = [cat];
    for (let frame = 0; frame < 1200 && cat.raceFinishedAt === null; frame++) updateRacer(cat, 1);
    return { crashed: cat.raceCrashed, progress: cat.raceProgress };
  })()`);
  assert.ok(result.crashed || result.progress < 20, JSON.stringify(result));
});

test('private tournament training preserves other brains, the live cat and the baseline elite', () => {
  const game = loadGame();
  const track = game.run('racePark = { x: 624, y: 624, w: 552, h: 552 }; createRaceTrack()');
  const cat = new game.Cat(1800, 1500), other = new game.Cat(1900, 1500);
  cat.raceBrain = new game.CatRaceNetwork(); other.raceBrain = new game.CatRaceNetwork();
  const initial = JSON.stringify(other.raceBrain);
  const baseline = new game.RaceTrainee(cat.raceBrain.copy(), track, 'normal');
  while (!baseline.done) baseline.step(track, 'normal');
  const baselineFitness = game.run('raceFitness')(baseline, baseline.frames / 60);
  const job = new game.PersonalTraining(cat, cat.raceBrain, track, 'normal', {
    populationSize: 4, generations: 2, random: seededRandom(41),
  });
  let batches = 0;
  while (!job.done && batches++ < 500) job.step(64);
  assert.equal(job.done, true);
  assert.equal(job.trials, 8);
  assert.equal(job.generation, 2);
  assert.ok(job.bestFitness >= baselineFitness);
  assert.equal(JSON.stringify(other.raceBrain), initial);
  assert.equal(cat.pos.x, 1800); assert.equal(cat.pos.y, 1500);
  assert.notEqual(job.champion, cat.raceBrain);
  const trained = new game.RaceTrainee(job.champion.copy(), track, 'normal');
  while (!trained.done) trained.step(track, 'normal');
  assert.ok(trained.raceFinishedAt !== null && !trained.raceCrashed,
    'Le cerveau retenu après plusieurs générations doit encore terminer le circuit');
});

test('rival cats are perceived by the network and a front obstacle reduces neural throttle', () => {
  const game = loadGame();
  const cast = game.run('castRaceRay');
  const hit = cast({ x: 0, y: 0 }, 0, [], 150, [{ pos: { x: 30, y: 0 }, raceFinishedAt: null }]);
  assert.equal(hit.distance, 24);
  const brain = new game.CatRaceNetwork();
  assert.ok(brain.predict([1, 1, 0, 1, 1, .5, 0, 0])[1] < brain.predict([1, 1, 1, 1, 1, .5, 0, 0])[1]);
});
