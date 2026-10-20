/**
 * EvolutionaryAgent.js
 * Implements Module 8: Evolutionary Steering Behavior (Darwinian survival & cloning).
 * DNA with 4 genes:
 *   dna[0]: food attraction weight [-2, 2]
 *   dna[1]: poison attraction weight [-2, 2]
 *   dna[2]: food perception radius [10, 150]
 *   dna[3]: poison perception radius [10, 150]
 */
class EvolutionaryAgent {
  constructor(x, y, dna = null) {
    this.pos = new Vector2(x, y);
    this.vel = Vector2.random2D().mul(2);
    this.acc = Vector2.zero();
    this.maxSpeed = 4.5;
    this.maxForce = 0.35;
    this.r = 6;
    this.health = 1.0;
    this.age = 0;

    if (dna) {
      this.dna = [...dna];
    } else {
      this.dna = [
        (Math.random() * 4) - 2,        // food weight
        (Math.random() * 4) - 2,        // poison weight
        20 + Math.random() * 120,       // food perception
        20 + Math.random() * 120        // poison perception
      ];
    }

    this.mr = 0.05; // mutation rate
  }

  mutate() {
    // Food weight
    if (Math.random() < this.mr) {
      this.dna[0] += (Math.random() * 0.4) - 0.2;
      this.dna[0] = Math.max(-2.5, Math.min(2.5, this.dna[0]));
    }
    // Poison weight
    if (Math.random() < this.mr) {
      this.dna[1] += (Math.random() * 0.4) - 0.2;
      this.dna[1] = Math.max(-2.5, Math.min(2.5, this.dna[1]));
    }
    // Food perception
    if (Math.random() < this.mr) {
      this.dna[2] += (Math.random() * 24) - 12;
      this.dna[2] = Math.max(10, Math.min(180, this.dna[2]));
    }
    // Poison perception
    if (Math.random() < this.mr) {
      this.dna[3] += (Math.random() * 24) - 12;
      this.dna[3] = Math.max(10, Math.min(180, this.dna[3]));
    }
  }

  clone() {
    if (this.health > 0.4 && Math.random() < 0.0022) {
      const child = new EvolutionaryAgent(this.pos.x, this.pos.y, this.dna);
      child.mutate();
      return child;
    }
    return null;
  }

  applyBehaviors(foodList, poisonList, obstacles, w, h) {
    const steerFood = this.eat(foodList, 0.28, this.dna[2]);
    const steerPoison = this.eat(poisonList, -0.85, this.dna[3]);
    const steerBoundaries = SteeringBehaviors.boundaries(this.pos, this.vel, w, h, 30, this.maxSpeed, this.maxForce);
    const steerObstacles = SteeringBehaviors.obstacleAvoid(this.pos, this.vel, obstacles, 70, this.maxSpeed, this.maxForce);

    steerFood.mul(this.dna[0]);
    steerPoison.mul(this.dna[1]);
    steerBoundaries.mul(1.5);
    steerObstacles.mul(2.0);

    this.acc.add(steerFood);
    this.acc.add(steerPoison);
    this.acc.add(steerBoundaries);
    this.acc.add(steerObstacles);
  }

  eat(list, nutrition, perception) {
    let record = Infinity;
    let closestIndex = -1;

    for (let i = list.length - 1; i >= 0; i--) {
      const d = Vector2.dist(this.pos, list[i]);
      if (d < 8) {
        list.splice(i, 1);
        this.health = Math.min(1.0, this.health + nutrition);
      } else if (d < record && d < perception) {
        record = d;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1 && list[closestIndex]) {
      return SteeringBehaviors.seek(this.pos, this.vel, list[closestIndex], this.maxSpeed, this.maxForce);
    }
    return Vector2.zero();
  }

  update() {
    this.health -= 0.0035; // loss of life over time
    this.age++;

    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc = Vector2.zero();
  }

  isDead() {
    return this.health <= 0;
  }

  draw(p, showDebug = false) {
    p.push();
    p.translate(this.pos.x, this.pos.y);
    const heading = this.vel.heading();
    p.rotate(heading);

    if (showDebug) {
      // Food perception circle & weight indicator
      p.noFill();
      p.stroke(57, 255, 20, 100);
      p.strokeWeight(1);
      p.circle(0, 0, this.dna[2] * 2);
      p.stroke(57, 255, 20);
      p.line(0, 0, this.dna[0] * 20, 0);

      // Poison perception circle & weight indicator
      p.stroke(255, 50, 70, 100);
      p.circle(0, 0, this.dna[3] * 2);
      p.stroke(255, 50, 70);
      p.line(0, 0, this.dna[1] * 20, 0);
    }

    // Agent body: color interpolated between red (health = 0) and green (health = 1)
    const h = Math.max(0, Math.min(1, this.health));
    const rCol = Math.round(255 * (1 - h));
    const gCol = Math.round(255 * h);
    p.fill(rCol, gCol, 40);
    p.stroke(255, 255, 255, 120);
    p.strokeWeight(1);

    // Triangle oriented forward
    p.triangle(this.r * 2, 0, -this.r, -this.r, -this.r, this.r);
    p.pop();
  }
}

