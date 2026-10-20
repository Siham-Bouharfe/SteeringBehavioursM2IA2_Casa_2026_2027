// 9-b : tournoi + mutation, limités aux variantes privées d'un seul chat.
class PersonalTraining {
  constructor(cat, champion, track, difficulty, options = {}) {
    this.cat = cat;
    this.track = track;
    this.difficulty = difficulty;
    this.random = options.random || Math.random;
    this.populationSize = options.populationSize || 6;
    this.generations = options.generations || 2;
    this.generation = 0;
    this.trials = 0;
    this.champion = champion.copy();
    this.bestFitness = -Infinity;
    this.bestLap = null;
    this.done = false;
    this.nextPopulation(null);
  }

  nextPopulation(previous) {
    this.population = Array.from({ length: this.populationSize }, (_, index) => {
      const parent = index === 0 || !previous ? this.champion : selectRaceParent(previous, this.random).brain;
      const brain = parent.copy();
      if (index > 0) brain.mutate(0.035 + index * 0.006, this.random);
      return { brain, agent: new RaceTrainee(brain, this.track, this.difficulty), fitness: -Infinity };
    });
    this.index = 0;
  }

  step(budget = 120) {
    for (let count = 0; count < budget && !this.done; count++) {
      const candidate = this.population[this.index];
      candidate.agent.step(this.track, this.difficulty);
      if (!candidate.agent.done) continue;
      this.trials++;
      candidate.fitness = raceFitness(candidate.agent, candidate.agent.frames / 60);
      if (candidate.fitness > this.bestFitness) {
        this.bestFitness = candidate.fitness;
        this.champion = candidate.brain.copy();
        this.bestLap = candidate.agent.raceFinishedAt;
      }
      if (++this.index < this.population.length) continue;
      if (++this.generation >= this.generations) this.done = true;
      else this.nextPopulation(this.population);
    }
    return this.done;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { PersonalTraining };
