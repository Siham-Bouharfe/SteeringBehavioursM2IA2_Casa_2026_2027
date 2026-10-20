const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, Vector, seededRandom } = require('./helpers/gameHarness.cjs');

function world(game) {
  const player = new game.Cat(1800, 1500);
  const stray = new game.Cat(1800, 1200); stray.name = 'Moka';
  return { player, strays: [stray], followers: [], refuge: { pos: new Vector(1800, 2400), r: 58 },
    moths: [], obstacles: [], difficulty: 'normal' };
}

test('all new visible entities inherit Vehicle', () => {
  const g = loadGame();
  const points = [new Vector(0, 0), new Vector(100, 0)];
  const entities = [new g.GardenTree(0, 0, 20, null), new g.GardenBed(0, 0, 20, 20, '#fff', 0),
    new g.GardenFood(0, 0, 1), new g.ShadowMoth(points, 0), new g.EscortCat(points), new g.MissionBeacon(0, 0)];
  assert.ok(entities.every(entity => entity instanceof g.Vehicle));
});

test('lost-cat mission requires recruitment and a real return to the refuge; rewards occur once', () => {
  const game = loadGame(), state = world(game), missions = new game.GardenMissions();
  assert.equal(missions.start('lost', state), true);
  assert.equal(missions.start('escort', state), false);
  assert.equal(missions.tick(1, state), null);
  state.followers.push(state.strays.shift());
  state.player.pos.set(state.refuge.pos); state.followers[0].pos.set(1800, 2360);
  const result = missions.tick(1, state);
  assert.equal(result.success, true); assert.equal(result.reward, 140);
  assert.equal(missions.completed.lost, 1);
  assert.equal(state.followers.length, 0);
  assert.equal(missions.tick(1, state), null);
});

test('escort waits for Zouin, follows projected road segments and arrives at the refuge', () => {
  const game = loadGame(), state = world(game), missions = new game.GardenMissions();
  state.obstacles = game.run('createCity(); cityObstacles');
  missions.start('escort', state);
  const escort = missions.active.cat;
  const before = escort.pos.copy();
  for (let frame = 0; frame < 10; frame++) missions.tick(1 / 60, state);
  assert.ok(Vector.dist(before, escort.pos) < 0.01, 'Pompon must wait when Zouin is too far');
  let result = null;
  for (let frame = 0; frame < 2600 && !result; frame++) {
    state.player.pos.set(escort.pos.x, escort.pos.y + 40);
    result = missions.tick(1 / 60, state);
    assert.ok(escort.vel.mag() <= escort.maxSpeed + 1e-9);
  }
  assert.ok(result?.success);
  assert.equal(result.reward, 180);
  assert.ok(Vector.dist(escort.pos, state.refuge.pos) < 45);
});

test('escape mission can be won, lost after three hits or cancelled without deleting another moth', () => {
  const game = loadGame(), state = world(game), missions = new game.GardenMissions();
  missions.start('escape', state);
  const pursuer = missions.active.moth;
  assert.ok(pursuer instanceof game.Vehicle);
  missions.active.hits = 3;
  const failure = missions.tick(1, state);
  assert.equal(failure.success, false); assert.equal(failure.reward, 0);
  assert.equal(state.moths.length, 0);
  missions.start('escape', state);
  const success = missions.tick(25, state);
  assert.equal(success.success, true); assert.equal(success.reward, 160);
  state.moths.push(new game.ShadowMoth([new Vector(0, 0), new Vector(10, 0)], 0));
  missions.start('escape', state);
  state.moths.pop();
  missions.cancel(state);
  assert.equal(state.moths.length, 1);
});

test('pursuit, evade and path-following return bounded forces without moving entities', () => {
  const g = loadGame(), agent = new g.Cat(60, 20), target = new g.Cat(90, 20);
  agent.vel.set(1, 0); target.vel.set(-1, 0);
  const before = agent.pos.copy();
  const pursuit = g.GardenBehaviors.pursue(agent, target);
  const evade = g.GardenBehaviors.evade(agent, target);
  const follow = g.GardenBehaviors.follow(agent, [new Vector(0, 0), new Vector(200, 0)]);
  assert.ok(pursuit.x > 0); assert.ok(evade.x < 0); assert.ok(follow.y < 0);
  assert.ok([pursuit, evade, follow].every(force => force.mag() <= agent.maxForce + 1e-9));
  assert.deepEqual(agent.pos, before);
  assert.equal(g.GardenBehaviors.follow(agent, []).magSq(), 0);
  agent.pos.set(195, 0); agent.vel.set(1, 0);
  const corner = g.GardenBehaviors.follow(agent, [new Vector(0, 0), new Vector(200, 0), new Vector(200, 200)]);
  assert.ok(corner.y > 0, 'La projection doit anticiper le segment suivant au virage');
});

test('successful lineages mutate reproducibly within perception and preference bounds', () => {
  const genetics = loadGame().GardenGenetics;
  const parent = genetics.create(seededRandom(2));
  const a = genetics.mutate(parent, seededRandom(7)), b = genetics.mutate(parent, seededRandom(7));
  assert.deepEqual(a, b); assert.equal(parent.generation, 1);
  let child = parent;
  const random = seededRandom(9);
  for (let n = 0; n < 1000; n++) { child = genetics.mutate(child, random); assert.ok(genetics.valid(child)); }
  assert.equal(child.generation, 1001);
  assert.equal(genetics.valid({ ...child, foodRadius: NaN }), false);
});

test('fireflies combine all three boid rules and react to Zouin’s meow', () => {
  const game = loadGame();
  const light = new game.Firefly(100, 100, 0), neighbor = new game.Firefly(120, 100, 1);
  let calls = 0;
  for (const name of ['separation', 'alignment', 'cohesion']) {
    const method = light[name].bind(light);
    light[name] = (...args) => { calls++; return method(...args); };
  }
  const player = new game.Cat(90, 100); player.meowRemaining = .5;
  light.update([light, neighbor], [], 1, player);
  assert.equal(calls, 3);
  assert.ok(light.vel.mag() > 0 && light.vel.mag() <= light.maxForce + 1e-9);
  assert.equal(light.acc.magSq(), 0);
});

test('Zouin keeps the stable player save key; missions, lineages and private learning survive reload', () => {
  const game = loadGame();
  const result = game.run(`(() => {
    playerCat = new Cat(1800,1500); playerCat.name = 'Zouin';
    playerCat.raceBrain = new CatRaceNetwork();
    gardenMissions = new GardenMissions(); gardenMissions.completed.lost = 2;
    savedCatTraits.Moka = GardenGenetics.mutate(GardenGenetics.create(Math.random), Math.random);
    savedRaceLearning.player = { races: 3, generation: 1, trainingTrials: 12,
      bestFitness: 123, difficulty: 'normal', mutationRate: 0.06 };
    coins = 140; saveProgress();
    savedRaceBrains = {}; savedRaceLearning = {}; savedCatTraits = {}; coins = 0;
    gardenMissions.completed.lost = 0;
    loadProgress(); restoreSavedRaceBrains();
    return { name: playerCat.name, key: raceBrainKey(playerCat,playerCat),
      trials: savedRaceLearning.player.trainingTrials, lineage: savedCatTraits.Moka.generation,
      rescued: gardenMissions.completed.lost, coins, validBrain: playerCat.raceBrain instanceof CatRaceNetwork };
  })()`);
  assert.equal(result.name, 'Zouin'); assert.equal(result.key, 'player');
  assert.equal(result.trials, 12); assert.equal(result.lineage, 2);
  assert.equal(result.rescued, 2); assert.equal(result.coins, 140); assert.equal(result.validBrain, true);
});
