/**
 * EvoMode.js — Mode Évolution (Darwin en action)
 * Implements Module 8: Evolutionary Steering Behavior
 * - Population of Darwinian agents with 4-gene DNA
 * - Natural selection through eating food and avoiding poison
 * - Cloning, mutation, reproduction and death
 * - Interactive environment: add food/poison, adjust parameters
 */
class EvoMode {
  constructor(w, h) {
    this.w = w;
    this.h = h;

    this.populationSize = 40;
    this.agents = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.agents.push(new EvolutionaryAgent(
        50 + Math.random() * (w - 100),
        50 + Math.random() * (h - 100)
      ));
    }

    // Food & Poison lists
    this.food = [];
    this.poison = [];
    for (let i = 0; i < 45; i++) this.spawnFood();
    for (let i = 0; i < 22; i++) this.spawnPoison();

    // Spawning probabilities (per frame)
    this.foodRate = 0.22;
    this.poisonRate = 0.04;

    this.showDebug = false;
    this.generation = 1;

    // Obstacles for environmental complexity
    this.obstacles = [
      { x: w * 0.33, y: h * 0.5, r: 40 },
      { x: w * 0.67, y: h * 0.5, r: 40 }
    ];

    // Stats history
    this.stats = {
      popCount: this.populationSize,
      avgHealth: 1.0,
      avgFoodWeight: 0,
      avgPoisonWeight: 0,
      avgFoodPerception: 50,
      avgPoisonPerception: 50
    };
  }

  spawnFood(x, y) {
    this.food.push(new Vector2(
      x !== undefined ? x : 40 + Math.random() * (this.w - 80),
      y !== undefined ? y : 40 + Math.random() * (this.h - 80)
    ));
  }

  spawnPoison(x, y) {
    this.poison.push(new Vector2(
      x !== undefined ? x : 40 + Math.random() * (this.w - 80),
      y !== undefined ? y : 40 + Math.random() * (this.h - 80)
    ));
  }

  handleMouse(x, y, isShift) {
    if (isShift) {
      this.spawnPoison(x, y);
    } else {
      this.spawnFood(x, y);
    }
  }

  update() {
    // 1. Spawning over time
    if (Math.random() < this.foodRate && this.food.length < 80) {
      this.spawnFood();
    }
    if (Math.random() < this.poisonRate && this.poison.length < 40) {
      this.spawnPoison();
    }

    // 2. Update agents
    const newChildren = [];
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const agent = this.agents[i];

      agent.applyBehaviors(this.food, this.poison, this.obstacles, this.w, this.h);
      agent.update();

      // Cloning / reproduction
      const child = agent.clone();
      if (child) newChildren.push(child);

      // Death check
      if (agent.isDead()) {
        // Drop food upon death (recycling)
        this.spawnFood(agent.pos.x, agent.pos.y);
        this.agents.splice(i, 1);
      }
    }

    // Add newborn agents
    for (const child of newChildren) {
      this.agents.push(child);
    }

    // Extinction prevention: spawn a pioneer if population collapses
    if (this.agents.length < 6) {
      this.agents.push(new EvolutionaryAgent(
        Math.random() * this.w,
        Math.random() * this.h
      ));
    }

    // 3. Compute stats
    this.calculateStats();
  }

  calculateStats() {
    const len = this.agents.length;
    if (len === 0) return;

    let hSum = 0, fwSum = 0, pwSum = 0, fpSum = 0, ppSum = 0;
    for (const a of this.agents) {
      hSum += Math.max(0, a.health);
      fwSum += a.dna[0];
      pwSum += a.dna[1];
      fpSum += a.dna[2];
      ppSum += a.dna[3];
    }

    this.stats.popCount = len;
    this.stats.avgHealth = hSum / len;
    this.stats.avgFoodWeight = fwSum / len;
    this.stats.avgPoisonWeight = pwSum / len;
    this.stats.avgFoodPerception = fpSum / len;
    this.stats.avgPoisonPerception = ppSum / len;
  }

  draw(p) {
    p.background(10, 16, 20);

    // Subtle background grid
    p.stroke(255, 255, 255, 6);
    p.strokeWeight(1);
    for (let x = 0; x < this.w; x += 50) p.line(x, 0, x, this.h);
    for (let y = 0; y < this.h; y += 50) p.line(0, y, this.w, y);

    // Obstacles
    for (const obs of this.obstacles) {
      p.noStroke();
      p.fill(22, 34, 42);
      p.circle(obs.x, obs.y, obs.r * 2);
      p.stroke(57, 255, 20, 30);
      p.strokeWeight(1.5);
      p.circle(obs.x, obs.y, obs.r * 2);
    }

    // Food (Green dots)
    p.noStroke();
    p.fill(57, 255, 20, 220);
    for (const f of this.food) {
      p.circle(f.x, f.y, 7);
    }

    // Poison (Red dots with tiny skull cross)
    p.fill(255, 50, 70, 220);
    for (const po of this.poison) {
      p.circle(po.x, po.y, 7);
    }

    // Agents
    for (const agent of this.agents) {
      agent.draw(p, this.showDebug);
    }
  }
}

