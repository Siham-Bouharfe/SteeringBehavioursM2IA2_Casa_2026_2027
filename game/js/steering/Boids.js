/**
 * Boids.js — Individual boid agent for flocking simulations.
 */
class Boid {
  constructor(x, y) {
    this.pos = new Vector2(x, y);
    this.vel = Vector2.random2D().mul(2);
    this.acc = Vector2.zero();

    this.maxSpeed = 3.2;
    this.maxForce = 0.18;

    // Perception radii
    this.separationDist  = 28;
    this.alignRadius     = 60;
    this.cohesionRadius  = 80;
    this.boundaryMargin  = 60;

    // Weights
    this.wSep  = 1.8;
    this.wAli  = 1.0;
    this.wCoh  = 0.9;
    this.wObs  = 2.5;
    this.wBnd  = 1.5;

    // Rendering
    this.size  = 4;
    this.color = [0, 245, 255]; // cyan
  }

  /* Apply forces and integrate */
  update(boids, obstacles, w, h) {
    const sep = SteeringBehaviors.separate(this.pos, this.vel, boids, this.separationDist, this.maxSpeed, this.maxForce);
    const ali = SteeringBehaviors.align   (this.pos, this.vel, boids, this.alignRadius,    this.maxSpeed, this.maxForce);
    const coh = SteeringBehaviors.cohesion(this.pos, this.vel, boids, this.cohesionRadius,  this.maxSpeed, this.maxForce);
    const obs = SteeringBehaviors.obstacleAvoid(this.pos, this.vel, obstacles, 80, this.maxSpeed, this.maxForce);
    const bnd = SteeringBehaviors.boundaries(this.pos, this.vel, w, h, this.boundaryMargin, this.maxSpeed, this.maxForce);

    this.acc.add(sep.copy().mul(this.wSep));
    this.acc.add(ali.copy().mul(this.wAli));
    this.acc.add(coh.copy().mul(this.wCoh));
    this.acc.add(obs.copy().mul(this.wObs));
    this.acc.add(bnd.copy().mul(this.wBnd));

    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc = Vector2.zero();

    // Hard wrap (safety)
    if (this.pos.x < -10)  this.pos.x = w + 10;
    if (this.pos.x > w+10) this.pos.x = -10;
    if (this.pos.y < -10)  this.pos.y = h + 10;
    if (this.pos.y > h+10) this.pos.y = -10;
  }

  draw(p) {
    p.push();
    p.translate(this.pos.x, this.pos.y);
    p.rotate(this.vel.heading());
    p.noStroke();
    p.fill(this.color[0], this.color[1], this.color[2], 210);
    p.triangle(8, 0, -4, 3, -4, -3);
    p.pop();
  }
}

/* ── Flock container ──────────────────────────────────────── */
class Flock {
  constructor(count, w, h) {
    this.boids = [];
    for (let i = 0; i < count; i++) {
      this.boids.push(new Boid(
        30 + Math.random() * (w - 60),
        30 + Math.random() * (h - 60)
      ));
    }
  }

  update(obstacles, w, h) {
    for (const b of this.boids) b.update(this.boids, obstacles, w, h);
  }

  draw(p) {
    for (const b of this.boids) b.draw(p);
  }
}
