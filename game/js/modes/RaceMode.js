/**
 * RaceMode.js — Mode Course (IA & Neuroévolution)
 * Modules 9 & 9b:
 * - Neural Network steering applied EXCLUSIVELY to racing cars
 * - Multi-sensor proximity raycasting against circuit boundaries
 * - Genetic algorithm (Tournament / Roulette selection + Gaussian mutation)
 * - Anti-camping & wrong-way detection
 * - Speed multiplier controls (1x, 2x, 5x, 10x)
 */

class RaceRay {
  constructor(angleOffset, maxRange = 160) {
    this.angleOffset = angleOffset;
    this.maxRange = maxRange;
    this.hitPoint = null;
    this.dist = maxRange;
  }

  cast(pos, carAngle, walls) {
    const angle = carAngle + this.angleOffset;
    const dir = Vector2.fromAngle(angle);
    const p1 = pos;
    const p2 = Vector2.add(pos, dir.copy().mul(this.maxRange));

    let closestDist = this.maxRange;
    let closestPt = null;

    for (const wall of walls) {
      const pt = RaceRay.lineIntersect(p1, p2, wall.a, wall.b);
      if (pt) {
        const d = Vector2.dist(pos, pt);
        if (d < closestDist) {
          closestDist = d;
          closestPt = pt;
        }
      }
    }

    this.hitPoint = closestPt;
    this.dist = closestDist;
    return this.dist / this.maxRange; // normalized [0, 1]
  }

  static lineIntersect(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-6) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return new Vector2(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }
    return null;
  }
}

class RaceCar {
  constructor(startPos, startAngle, brain = null) {
    this.pos = startPos.copy();
    this.vel = Vector2.fromAngle(startAngle).mul(1.5);
    this.acc = Vector2.zero();
    this.angle = startAngle;

    this.maxSpeed = 6.0;
    this.maxForce = 0.45;
    this.dead = false;

    // Checkpoint tracking
    this.checkpointsPassed = 0;
    this.checkpointIndex = 0;
    this.laps = 0;
    this.framesSinceCheckpoint = 0;
    this.stalledFrames = 0;
    this.prevPos = this.pos.copy();

    // Fitness
    this.fitness = 0;
    this.fitnessNormalized = 0;
    this.distToNext = 0;
    this.isElite = false;

    // Sensors: 7 rays distributed from -90° to +90°
    this.sensorAngles = [-75, -50, -25, 0, 25, 50, 75].map(deg => deg * Math.PI / 180);
    this.rays = this.sensorAngles.map(a => new RaceRay(a, 170));

    // Neural Network (8 inputs: 7 sensors + 1 speed, 16 hidden, 2 outputs: steering, thrust)
    if (brain) {
      this.brain = brain;
    } else {
      this.brain = new RaceNeuralNetwork(8, 16, 2);
    }
  }

  update(walls, checkpoints) {
    if (this.dead) return;

    this.framesSinceCheckpoint++;

    // Anti-camping / stall detection
    if (this.framesSinceCheckpoint % 40 === 0) {
      if (Vector2.dist(this.pos, this.prevPos) < 15) {
        this.stalledFrames += 40;
      } else {
        this.stalledFrames = 0;
        this.prevPos = this.pos.copy();
      }
    }

    if (this.stalledFrames > 90 || this.framesSinceCheckpoint > 320) {
      this.dead = true;
      return;
    }

    // 1. Raycasting perception
    const inputs = [];
    for (const ray of this.rays) {
      const normDist = ray.cast(this.pos, this.angle, walls);
      inputs.push(normDist);
      // Wall collision check
      if (ray.dist < 8) {
        this.dead = true;
        return;
      }
    }
    // Normalized current speed as 8th input
    inputs.push(this.vel.mag() / this.maxSpeed);

    // 2. Neural network decision
    const outputs = this.brain.predict(inputs);
    // output[0] = turn force [-maxForce, maxForce]
    const steerAngle = (outputs[0] * 2 - 1) * this.maxForce;
    // output[1] = thrust [0.5, maxSpeed]
    const thrust = Math.max(1.0, outputs[1] * this.maxSpeed);

    this.angle += steerAngle;
    const desiredVel = Vector2.fromAngle(this.angle).mul(thrust);
    const steerForce = Vector2.sub(desiredVel, this.vel).limit(this.maxForce);

    this.acc.add(steerForce);
    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc = Vector2.zero();

    // 3. Checkpoint verification
    this.verifyCheckpoint(checkpoints);
  }

  verifyCheckpoint(checkpoints) {
    if (checkpoints.length === 0) return;

    const cp = checkpoints[this.checkpointIndex];
    // Distance from car to line segment of checkpoint
    const d = RaceRay.distToSegment(this.pos, cp.a, cp.b);
    this.distToNext = d;

    if (d < 38) {
      this.checkpointsPassed++;
      this.checkpointIndex = (this.checkpointIndex + 1) % checkpoints.length;
      this.framesSinceCheckpoint = 0;
      this.stalledFrames = 0;

      if (this.checkpointIndex === 0) {
        this.laps++;
      }
    }
  }

  draw(p, isBest = false) {
    if (this.dead && !isBest) return;

    p.push();
    p.translate(this.pos.x, this.pos.y);
    p.rotate(this.angle);

    if (isBest) {
      // Highlight leader car
      p.fill(255, 0, 170); // Neon Magenta
      p.stroke(255, 255, 255);
      p.strokeWeight(1.5);
      p.rect(-8, -4, 16, 8, 2);

      // Windshield
      p.fill(13, 17, 23);
      p.rect(0, -3, 4, 6);
    } else {
      // Regular living cars (ghostly translucent)
      p.fill(255, 255, 255, 45);
      p.noStroke();
      p.rect(-6, -3, 12, 6, 2);
    }

    p.pop();

    // Draw sensor rays for the leader
    if (isBest && !this.dead) {
      for (const ray of this.rays) {
        p.stroke(255, 255, 0, 120);
        p.strokeWeight(1);
        if (ray.hitPoint) {
          p.line(this.pos.x, this.pos.y, ray.hitPoint.x, ray.hitPoint.y);
          p.fill(255, 50, 70);
          p.noStroke();
          p.circle(ray.hitPoint.x, ray.hitPoint.y, 4);
        }
      }
    }
  }
}

// Distance from point P to segment A-B
RaceRay.distToSegment = function(p, a, b) {
  const l2 = Vector2.dist(a, b) * Vector2.dist(a, b);
  if (l2 === 0) return Vector2.dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = new Vector2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
  return Vector2.dist(p, proj);
};

class RaceMode {
  constructor(w, h) {
    this.w = w;
    this.h = h;

    this.populationSize = 45;
    this.mutationRate = 0.12;
    this.speedMultiplier = 1;
    this.generation = 1;
    this.bestScoreEver = 0;
    this.historyScores = [];

    this.initCircuit();
    this.initPopulation();
  }

  initCircuit() {
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const rx = this.w * 0.38;
    const ry = this.h * 0.32;
    const trackWidth = 84;

    this.centerline = [];
    const count = 22;

    // Organic racetrack curvature
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // Slight chicane perturbation
      const rMod = 1 + 0.15 * Math.sin(angle * 3) - 0.08 * Math.cos(angle * 2);
      const x = cx + Math.cos(angle) * rx * rMod;
      const y = cy + Math.sin(angle) * ry * rMod;
      this.centerline.push(new Vector2(x, y));
    }

    // Build inner & outer boundary walls
    this.innerWalls = [];
    this.outerWalls = [];
    this.allWalls = [];
    this.checkpoints = [];

    const halfW = trackWidth * 0.5;

    for (let i = 0; i < this.centerline.length; i++) {
      const pCurrent = this.centerline[i];
      const pNext = this.centerline[(i + 1) % this.centerline.length];

      const dir = Vector2.sub(pNext, pCurrent).normalize();
      const normal = new Vector2(-dir.y, dir.x); // perpendicular

      const innerPt = Vector2.add(pCurrent, normal.copy().mul(-halfW));
      const outerPt = Vector2.add(pCurrent, normal.copy().mul(halfW));

      // Checkpoint line across track
      this.checkpoints.push({ a: innerPt, b: outerPt });
    }

    for (let i = 0; i < this.checkpoints.length; i++) {
      const nextIdx = (i + 1) % this.checkpoints.length;

      const innerWall = { a: this.checkpoints[i].a, b: this.checkpoints[nextIdx].a };
      const outerWall = { a: this.checkpoints[i].b, b: this.checkpoints[nextIdx].b };

      this.innerWalls.push(innerWall);
      this.outerWalls.push(outerWall);
      this.allWalls.push(innerWall);
      this.allWalls.push(outerWall);
    }

    // Start line & heading
    this.startPos = Vector2.add(this.checkpoints[0].a, this.checkpoints[0].b).mul(0.5);
    const startDir = Vector2.sub(this.centerline[1], this.centerline[0]).normalize();
    this.startAngle = startDir.heading();
  }

  initPopulation() {
    this.cars = [];
    this.savedCars = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.cars.push(new RaceCar(this.startPos, this.startAngle));
    }
  }

  update() {
    // Run simulation multiple times based on speedMultiplier
    for (let cycle = 0; cycle < this.speedMultiplier; cycle++) {
      let aliveCount = 0;

      for (let i = this.cars.length - 1; i >= 0; i--) {
        const car = this.cars[i];
        if (!car.dead) {
          car.update(this.allWalls, this.checkpoints);
          if (car.dead) {
            this.savedCars.push(car);
          } else {
            aliveCount++;
          }
        }
      }

      // If all cars died, advance to next generation
      if (aliveCount === 0) {
        this.nextGeneration();
        break;
      }
    }
  }

  nextGeneration() {
    const result = GeneticAlgorithm.produceNextGeneration(
      this.savedCars,
      this.populationSize,
      this.mutationRate,
      (brain) => new RaceCar(this.startPos, this.startAngle, brain)
    );

    this.generation++;
    this.cars = result.population;
    this.savedCars = [];

    this.bestScoreEver = Math.max(this.bestScoreEver, result.bestCheckpoints);
    this.historyScores.push(result.bestCheckpoints);
    if (this.historyScores.length > 25) this.historyScores.shift();
  }

  draw(p) {
    p.background(11, 15, 21);

    // 1. Draw Asphalt track surface
    p.noStroke();
    p.fill(20, 26, 36);
    p.beginShape();
    for (const cp of this.checkpoints) p.vertex(cp.b.x, cp.b.y);
    p.beginContour();
    for (let i = this.checkpoints.length - 1; i >= 0; i--) {
      p.vertex(this.checkpoints[i].a.x, this.checkpoints[i].a.y);
    }
    p.endContour();
    p.endShape(p.CLOSE);

    // 2. Draw Checkpoints (Subtle glowing lines)
    p.stroke(255, 255, 255, 16);
    p.strokeWeight(1);
    for (const cp of this.checkpoints) {
      p.line(cp.a.x, cp.a.y, cp.b.x, cp.b.y);
    }

    // 3. Draw Track Borders (Neon walls)
    p.stroke(255, 0, 170, 180); // Outer wall neon magenta
    p.strokeWeight(3);
    for (const w of this.outerWalls) p.line(w.a.x, w.a.y, w.b.x, w.b.y);

    p.stroke(0, 245, 255, 180); // Inner wall neon cyan
    p.strokeWeight(3);
    for (const w of this.innerWalls) p.line(w.a.x, w.a.y, w.b.x, w.b.y);

    // Start / Finish line
    p.stroke(255, 255, 255);
    p.strokeWeight(4);
    p.line(this.checkpoints[0].a.x, this.checkpoints[0].a.y, this.checkpoints[0].b.x, this.checkpoints[0].b.y);

    // 4. Find Best Car
    let bestCar = null;
    let maxCp = -1;
    for (const car of this.cars) {
      if (!car.dead && car.checkpointsPassed > maxCp) {
        maxCp = car.checkpointsPassed;
        bestCar = car;
      }
    }
    if (!bestCar) bestCar = this.cars[0];

    // 5. Draw All Cars
    for (const car of this.cars) {
      if (car !== bestCar) car.draw(p, false);
    }
    if (bestCar) bestCar.draw(p, true);
  }
}

