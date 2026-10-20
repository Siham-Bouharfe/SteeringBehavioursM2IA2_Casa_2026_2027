/**
 * GeneticAlgorithm.js
 * Implements genetic evolution routines from Module 9 / 9b:
 * - Fitness calculation (exponential with checkpoint distance bonus)
 * - Tournament & Roulette-wheel selection
 * - Mutation and generation transition
 */
class GeneticAlgorithm {
  static calculateFitness(savedVehicles) {
    let sum = 0;
    for (const vehicle of savedVehicles) {
      // Calculate fitness using checkpoints passed + distance to next checkpoint
      let score = vehicle.checkpointsPassed * 50;
      if (vehicle.laps) score += vehicle.laps * 300;
      
      // Bonus if close to next checkpoint
      if (vehicle.distToNext) {
        score += Math.max(0, 50 - vehicle.distToNext * 0.2);
      }

      vehicle.fitness = Math.pow(2, Math.max(0, vehicle.checkpointsPassed)) + score;
      sum += vehicle.fitness;
    }

    // Normalize
    if (sum > 0) {
      for (const vehicle of savedVehicles) {
        vehicle.fitnessNormalized = vehicle.fitness / sum;
      }
    } else {
      for (const vehicle of savedVehicles) {
        vehicle.fitnessNormalized = 1 / savedVehicles.length;
      }
    }
  }

  // Roulette wheel selection
  static pickOneRoulette(savedVehicles) {
    let index = 0;
    let r = Math.random();

    while (r > 0 && index < savedVehicles.length) {
      r -= (savedVehicles[index].fitnessNormalized || 0);
      index++;
    }
    index = Math.max(0, Math.min(savedVehicles.length - 1, index - 1));

    const parent = savedVehicles[index];
    const childBrain = parent.brain.copy();
    return childBrain;
  }

  // Tournament selection (from 9b, produces higher stability)
  static pickOneTournament(savedVehicles, tournamentSize = 4) {
    let best = null;
    let bestFitness = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * savedVehicles.length);
      const candidate = savedVehicles[idx];
      if (!best || candidate.fitness > bestFitness) {
        best = candidate;
        bestFitness = candidate.fitness;
      }
    }

    return best ? best.brain.copy() : savedVehicles[0].brain.copy();
  }

  static produceNextGeneration(savedVehicles, totalPopulation, mutationRate, vehicleFactory) {
    GeneticAlgorithm.calculateFitness(savedVehicles);

    // Sort to find the absolute best car
    savedVehicles.sort((a, b) => b.fitness - a.fitness);
    const bestParent = savedVehicles[0];

    const newPopulation = [];

    // Elite: keep the best unchanged
    const eliteCar = vehicleFactory(bestParent.brain.copy());
    eliteCar.isElite = true;
    newPopulation.push(eliteCar);

    // Fill the rest with tournament offspring
    for (let i = 1; i < totalPopulation; i++) {
      const brain = (Math.random() < 0.75) 
        ? GeneticAlgorithm.pickOneTournament(savedVehicles, 5)
        : GeneticAlgorithm.pickOneRoulette(savedVehicles);

      brain.mutate(mutationRate);
      newPopulation.push(vehicleFactory(brain));
    }

    // Clean up old brains from memory
    for (const v of savedVehicles) {
      if (v.brain && v.brain.dispose) {
        v.brain.dispose();
      }
    }

    return {
      population: newPopulation,
      bestFitness: bestParent.fitness,
      bestCheckpoints: bestParent.checkpointsPassed
    };
  }
}

