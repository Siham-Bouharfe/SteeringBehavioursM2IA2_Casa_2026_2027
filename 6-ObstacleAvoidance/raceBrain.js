// Adaptation de l'algorithme 9-b : capteurs, vitesse, angle de trajectoire,
// réseau 8-20-2, tournoi et mutation.
const RACE_SENSOR_ANGLES = Object.freeze([-60, -30, 0, 30, 60].map(degrees => degrees * Math.PI / 180));
const RACE_SENSOR_RANGE = 150;
const RACE_BRAIN_INPUTS = RACE_SENSOR_ANGLES.length + 3;
const RACE_BRAIN_HIDDEN = 20;
const RACE_BRAIN_OUTPUTS = 2;
const RACE_BRAIN_VERSION = 3;

function sigmoid(value) {
  const stableValue = Math.max(-30, Math.min(30, value));
  return 1 / (1 + Math.exp(-stableValue));
}

function castRaceRay(origin, angle, walls, maxRange = RACE_SENSOR_RANGE, rivals = []) {
  const endX = origin.x + Math.cos(angle) * maxRange;
  const endY = origin.y + Math.sin(angle) * maxRange;
  let nearestAmount = 1;
  let hit = null;

  for (const wall of walls) {
    const start = wall.a;
    const finish = wall.b;
    const wallX = finish.x - start.x;
    const wallY = finish.y - start.y;
    const rayX = endX - origin.x;
    const rayY = endY - origin.y;
    const denominator = rayX * wallY - rayY * wallX;
    if (Math.abs(denominator) < 1e-9) continue;

    const offsetX = start.x - origin.x;
    const offsetY = start.y - origin.y;
    const amountAlongRay = (offsetX * wallY - offsetY * wallX) / denominator;
    const amountAlongWall = (offsetX * rayY - offsetY * rayX) / denominator;
    if (amountAlongRay < 0 || amountAlongRay > nearestAmount || amountAlongWall < 0 || amountAlongWall > 1) continue;
    nearestAmount = amountAlongRay;
    hit = { x: origin.x + rayX * amountAlongRay, y: origin.y + rayY * amountAlongRay };
  }

  for (const rival of rivals) {
    if (rival.pos === origin || rival.raceFinishedAt !== null) continue;
    const dx = rival.pos.x - origin.x, dy = rival.pos.y - origin.y;
    const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
    const perpendicular = dx * dx + dy * dy - projection * projection;
    const radius = 6;
    if (projection < 0 || perpendicular > radius * radius) continue;
    const distance = Math.max(0, projection - Math.sqrt(Math.max(0, radius * radius - perpendicular)));
    if (distance < nearestAmount * maxRange) {
      nearestAmount = distance / maxRange;
      hit = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };
    }
  }
  return {
    distance: nearestAmount * maxRange,
    normalizedDistance: nearestAmount,
    end: hit || { x: endX, y: endY },
  };
}

function raceInputsFor(cat, track, rivals = []) {
  const dynamics = typeof module !== 'undefined' && module.exports
    ? require('./raceDynamics.js')
    : { getRaceLookahead, sampleRacePath, buildRaceInputs };
  const heading = cat.vel.magSq() > 0.01 ? cat.vel.heading() : cat.raceHeading;
  const readings = RACE_SENSOR_ANGLES.map(offset =>
    castRaceRay(cat.pos, heading + offset, track.sensorWalls, RACE_SENSOR_RANGE, rivals));
  const target = dynamics.getRaceLookahead(track.points, cat.raceProgress);
  const center = dynamics.sampleRacePath(track.points, cat.raceProgress);
  const before = dynamics.sampleRacePath(track.points, cat.raceProgress - 0.05);
  const after = dynamics.sampleRacePath(track.points, cat.raceProgress + 0.05);
  return { readings, inputs: dynamics.buildRaceInputs(readings, cat.vel.mag(), cat.raceMaxSpeed,
    cat.pos, heading, target, center, { x: after.x - before.x, y: after.y - before.y }, track.width / 2) };
}

function raceFitness(agent, elapsedSeconds) {
  const progress = Number.isFinite(agent.raceProgress)
    ? Math.min(agent.raceProgress, agent.raceCourseLength || Infinity) : 0;
  const finished = agent.raceFinishedAt !== null && agent.raceFinishedAt !== undefined;
  const time = finished ? agent.raceFinishedAt : elapsedSeconds;
  const finishBonus = finished && !agent.raceCrashed ? 5000 : 0;
  const crashPenalty = agent.raceCrashed ? 1500 : 0;
  return progress * 1000 + finishBonus - time * 10 - crashPenalty;
}

function raceSteeringCommand(velocity, outputs, maxSpeed, maxForce) {
  if (!velocity || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) ||
      !Array.isArray(outputs) || outputs.length !== RACE_BRAIN_OUTPUTS ||
      outputs.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
      !Number.isFinite(maxSpeed) || maxSpeed <= 0 || !Number.isFinite(maxForce) || maxForce <= 0) {
    throw new TypeError('Paramètres invalides pour la force de pilotage du coureur.');
  }

  const speed = Math.hypot(velocity.x, velocity.y);
  const heading = speed > 0.01 ? Math.atan2(velocity.y, velocity.x) : 0;
  const desiredHeading = heading + (outputs[0] * 2 - 1) * maxForce * 2.2;
  const desiredSpeed = Math.max(0.7, outputs[1] * maxSpeed);
  const forceX = Math.cos(desiredHeading) * desiredSpeed - velocity.x;
  const forceY = Math.sin(desiredHeading) * desiredSpeed - velocity.y;
  const forceMagnitude = Math.hypot(forceX, forceY);
  const scale = forceMagnitude > maxForce ? maxForce / forceMagnitude : 1;
  return {
    desiredHeading,
    desiredSpeed,
    force: { x: forceX * scale, y: forceY * scale },
  };
}

function selectRaceParent(population, random = Math.random, tournamentSize = 5) {
  if (!Array.isArray(population) || population.length === 0) {
    throw new RangeError('La sélection par tournoi requiert une population non vide.');
  }
  let best = null;
  const sampleCount = Math.min(population.length, tournamentSize);
  for (let index = 0; index < sampleCount; index++) {
    const candidate = population[Math.min(population.length - 1, Math.floor(random() * population.length))];
    if (!best || candidate.fitness > best.fitness) best = candidate;
  }
  return best;
}

function raceBrainKey(cat, playerCat) {
  return cat === playerCat ? 'player' : cat.name;
}

function prepareIndividualRaceBrains(cats, playerCat, savedBrains, learningRecords, difficulty, random = Math.random) {
  if (!Array.isArray(cats) || !playerCat || !savedBrains || !learningRecords ||
      typeof difficulty !== 'string' || typeof random !== 'function') {
    throw new TypeError('Paramètres invalides pour préparer les cerveaux individuels.');
  }

  for (const cat of cats) {
    const key = raceBrainKey(cat, playerCat);
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('Chaque coureur doit avoir un nom stable pour son cerveau personnel.');
    }
    let champion = savedBrains[key]
      ? new CatRaceNetwork(savedBrains[key])
      : cat.raceBrain
        ? cat.raceBrain.copy()
        : new CatRaceNetwork(null, random);
    let record = learningRecords[key];
    const validRecord = record &&
      Number.isSafeInteger(record.races) && record.races >= 0 &&
      Number.isSafeInteger(record.generation) && record.generation >= 0 &&
      (record.bestFitness === null || Number.isFinite(record.bestFitness)) &&
      typeof record.difficulty === 'string' &&
      Number.isFinite(record.mutationRate) && record.mutationRate >= 0.025 && record.mutationRate <= 0.2;
    if (!validRecord) {
      champion.mutate(0.035, random);
      record = {
        races: 0,
        generation: 0,
        bestFitness: null,
        difficulty,
        mutationRate: 0.06,
      };
      learningRecords[key] = record;
    }
    if (record.difficulty !== difficulty) {
      record.bestFitness = null;
      record.difficulty = difficulty;
    }

    savedBrains[key] = champion.copy();
    cat.raceBrain = record.races > 0
      ? champion.copy().mutate(record.mutationRate, random)
      : champion.copy();
    cat.raceBrainTrainingEligible = true;
    cat.raceBrainKey = key;
  }
}

function evolveIndividualRaceBrains(cats, playerCat, elapsedSeconds, difficulty, savedBrains, learningRecords) {
  if (!Array.isArray(cats) || !playerCat || !Number.isFinite(elapsedSeconds) ||
      typeof difficulty !== 'string' || !savedBrains || !learningRecords) {
    throw new TypeError('Paramètres invalides pour faire évoluer les cerveaux individuels.');
  }

  let promotedCount = 0;
  for (const cat of cats) {
    const key = raceBrainKey(cat, playerCat);
    const champion = savedBrains[key]
      ? new CatRaceNetwork(savedBrains[key])
      : cat.raceBrain.copy();
    const record = learningRecords[key];
    if (!record) throw new Error(`L’historique d’apprentissage de ${cat.name} est introuvable.`);

    if (!cat.raceBrainTrainingEligible) {
      cat.raceBrain = champion;
      continue;
    }

    const fitness = raceFitness(cat, elapsedSeconds);
    record.races++;
    record.crashes = (record.crashes || 0) + (cat.raceCrashed ? 1 : 0);
    if (!cat.raceCrashed && cat.raceFinishedAt !== null)
      record.bestLap = Math.min(record.bestLap || Infinity, cat.raceFinishedAt);
    record.lastFitness = fitness;
    if (!Number.isFinite(record.bestFitness) || fitness > record.bestFitness) {
      record.bestFitness = fitness;
      record.generation++;
      record.mutationRate = Math.max(0.025, record.mutationRate * 0.88);
      savedBrains[key] = cat.raceBrain.copy();
      promotedCount++;
    } else {
      record.mutationRate = Math.min(0.2, record.mutationRate * 1.2);
    }

    cat.raceBrain = new CatRaceNetwork(savedBrains[key]);
  }
  return promotedCount;
}

class CatRaceNetwork {
  constructor(genome, random = Math.random) {
    if (genome) {
      if (genome.raceBrainVersion !== RACE_BRAIN_VERSION ||
          !Array.isArray(genome.inputWeights) || genome.inputWeights.length !== RACE_BRAIN_HIDDEN ||
          genome.inputWeights.some(row => !Array.isArray(row) || row.length !== RACE_BRAIN_INPUTS) ||
          !Array.isArray(genome.hiddenBiases) || genome.hiddenBiases.length !== RACE_BRAIN_HIDDEN ||
          !Array.isArray(genome.outputWeights) || genome.outputWeights.length !== RACE_BRAIN_OUTPUTS ||
          genome.outputWeights.some(row => !Array.isArray(row) || row.length !== RACE_BRAIN_HIDDEN) ||
          !Array.isArray(genome.outputBiases) || genome.outputBiases.length !== RACE_BRAIN_OUTPUTS ||
          [...genome.inputWeights.flat(), ...genome.hiddenBiases,
            ...genome.outputWeights.flat(), ...genome.outputBiases].some(value => !Number.isFinite(value))) {
        throw new TypeError('Le génome 9-b de la course est invalide ou d’une ancienne version.');
      }
      this.inputWeights = genome.inputWeights.map(row => row.slice());
      this.hiddenBiases = genome.hiddenBiases.slice();
      this.outputWeights = genome.outputWeights.map(row => row.slice());
      this.outputBiases = genome.outputBiases.slice();
      this.raceBrainVersion = RACE_BRAIN_VERSION;
      return;
    }

    this.raceBrainVersion = RACE_BRAIN_VERSION;

    // Réseau expert de départ : son premier neurone transforme l'erreur
    // d'angle vers la trajectoire en commande de virage. La génétique le
    // fait ensuite évoluer au lieu de laisser toute la première génération
    // partir avec des poids aléatoires incapables de boucler le circuit.
    this.inputWeights = Array.from({ length: RACE_BRAIN_HIDDEN }, () => Array(RACE_BRAIN_INPUTS).fill(0));
    this.hiddenBiases = Array(RACE_BRAIN_HIDDEN).fill(0);
    this.inputWeights[0][RACE_SENSOR_ANGLES.length + 1] = 8;
    // Le capteur frontal freine via le réseau lui-même, notamment derrière un autre chat.
    this.inputWeights[1][2] = -10;
    this.hiddenBiases[1] = 7;
    this.outputWeights = Array.from({ length: RACE_BRAIN_OUTPUTS }, () => Array(RACE_BRAIN_HIDDEN).fill(0));
    this.outputWeights[0][0] = 4;
    this.outputWeights[1][1] = -2.5;
    this.outputBiases = [-2, 2.2];
  }

  predict(inputs) {
    if (!Array.isArray(inputs) || inputs.length !== RACE_BRAIN_INPUTS ||
        inputs.some(value => !Number.isFinite(value))) {
      throw new TypeError(`Le réseau 9-b attend ${RACE_BRAIN_INPUTS} entrées : 5 capteurs, vitesse, angle de trajectoire et décalage latéral.`);
    }

    const hidden = this.inputWeights.map((weights, index) =>
      sigmoid(weights.reduce((sum, weight, inputIndex) =>
        sum + weight * inputs[inputIndex], this.hiddenBiases[index])));
    return this.outputWeights.map((weights, index) => sigmoid(
      weights.reduce((sum, weight, hiddenIndex) => sum + weight * hidden[hiddenIndex], this.outputBiases[index])
    ));
  }

  copy() {
    return new CatRaceNetwork(this);
  }

  mutate(rate = 0.15, random = Math.random) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new RangeError('Le taux de mutation doit être compris entre 0 et 1.');
    }
    const gaussian = () => {
      const first = Math.max(Number.EPSILON, random());
      const second = random();
      return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    };
    const mutateWeight = value => random() < rate
      ? Math.max(-12, Math.min(12, value + gaussian() * 0.1))
      : value;
    this.inputWeights = this.inputWeights.map(row => row.map(mutateWeight));
    this.hiddenBiases = this.hiddenBiases.map(mutateWeight);
    this.outputWeights = this.outputWeights.map(row => row.map(mutateWeight));
    this.outputBiases = this.outputBiases.map(mutateWeight);
    return this;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CatRaceNetwork,
    RACE_BRAIN_HIDDEN,
    RACE_BRAIN_INPUTS,
    RACE_BRAIN_VERSION,
    RACE_SENSOR_ANGLES,
    RACE_SENSOR_RANGE,
    castRaceRay,
    raceInputsFor,
    raceFitness,
    raceSteeringCommand,
    selectRaceParent,
    raceBrainKey,
    prepareIndividualRaceBrains,
    evolveIndividualRaceBrains,
  };
}
