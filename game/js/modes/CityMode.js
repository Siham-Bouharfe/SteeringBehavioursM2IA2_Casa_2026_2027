/**
 * CityMode.js — Mode Ville (GTA-like / The Last Guy)
 * Combines:
 * - Module 1: Seek & Flee (Pursuers & Fleeing targets)
 * - Module 3: Arrival (Decelerating stops)
 * - Module 5: Path Following (Cars / civilians on road loop)
 * - Module 6: Obstacle Avoidance (Raycasting sensors)
 * - Module 7: Boids (Pedestrian flocking crowd)
 */
class CityMode {
  constructor(w, h) {
    this.w = w;
    this.h = h;

    this.score = 0;
    this.debug = false;
    this.gameOver = false;

    // Player Car
    this.player = {
      pos: new Vector2(w * 0.5, h * 0.5),
      vel: Vector2.zero(),
      acc: Vector2.zero(),
      angle: -Math.PI / 2,
      speed: 0,
      maxSpeed: 5.5,
      accel: 0.22,
      friction: 0.94,
      steerSpeed: 0.058,
      r: 14,
      trail: [],
      trailMax: 20
    };

    // Obstacles (Buildings / Roundabouts)
    this.initObstacles();

    // Road Path for civilians (Module 5)
    this.initRoadPath();

    // Civilians on Path (Module 5-2 & 5-3)
    this.civilians = [];
    for (let i = 0; i < 8; i++) {
      const pt = this.roadPath[i % this.roadPath.length];
      this.civilians.push({
        pos: new Vector2(pt.x + (Math.random() * 20 - 10), pt.y + (Math.random() * 20 - 10)),
        vel: Vector2.random2D().mul(2),
        acc: Vector2.zero(),
        maxSpeed: 2.8,
        maxForce: 0.16,
        r: 8,
        color: '#f7d070'
      });
    }

    // Seekers / Chasers (Module 1)
    this.seekers = [];
    for (let i = 0; i < 5; i++) {
      this.seekers.push({
        pos: new Vector2(Math.random() * w, Math.random() * h),
        vel: Vector2.random2D().mul(2.5),
        acc: Vector2.zero(),
        maxSpeed: 3.8,
        maxForce: 0.18,
        r: 10,
        state: 'seek' // 'seek' or 'flee'
      });
    }

    // Pedestrian Boids crowd (Module 7)
    this.flock = new Flock(24, w, h);

    // Pickups (Coins / Stars)
    this.pickups = [];
    for (let i = 0; i < 6; i++) {
      this.spawnPickup();
    }

    // Visual particles / sparks
    this.particles = [];
  }

  initObstacles() {
    this.obstacles = [
      { x: this.w * 0.25, y: this.h * 0.28, r: 48, label: 'Bâtiment A' },
      { x: this.w * 0.75, y: this.h * 0.28, r: 48, label: 'Bâtiment B' },
      { x: this.w * 0.25, y: this.h * 0.72, r: 52, label: 'Banque' },
      { x: this.w * 0.75, y: this.h * 0.72, r: 52, label: 'Hôtel' },
      { x: this.w * 0.50, y: this.h * 0.50, r: 38, label: 'Fontaine' },
      { x: this.w * 0.50, y: this.h * 0.18, r: 32, label: 'Kiosque Nord' },
      { x: this.w * 0.50, y: this.h * 0.82, r: 32, label: 'Kiosque Sud' }
    ];
  }

  initRoadPath() {
    // Closed circuit loop around the downtown area
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const rx = this.w * 0.38;
    const ry = this.h * 0.35;
    this.roadPath = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.roadPath.push(new Vector2(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry));
    }
  }

  spawnPickup() {
    this.pickups.push({
      x: 60 + Math.random() * (this.w - 120),
      y: 60 + Math.random() * (this.h - 120),
      r: 8,
      pulsar: Math.random() * Math.PI * 2
    });
  }

  handleInput(keyIsDown, p) {
    const P = this.player;

    // Up / W / Z: Accelerate
    if (keyIsDown(87) || keyIsDown(90) || keyIsDown(p.UP_ARROW)) {
      P.speed = Math.min(P.maxSpeed, P.speed + P.accel);
    }
    // Down / S: Reverse / Brake
    else if (keyIsDown(83) || keyIsDown(p.DOWN_ARROW)) {
      P.speed = Math.max(-P.maxSpeed * 0.45, P.speed - P.accel * 0.9);
    } else {
      P.speed *= P.friction;
    }

    // Left / A / Q: Steer left
    if (keyIsDown(65) || keyIsDown(81) || keyIsDown(p.LEFT_ARROW)) {
      if (Math.abs(P.speed) > 0.1) {
        P.angle -= P.steerSpeed * Math.sign(P.speed);
      }
    }
    // Right / D: Steer right
    if (keyIsDown(68) || keyIsDown(p.RIGHT_ARROW)) {
      if (Math.abs(P.speed) > 0.1) {
        P.angle += P.steerSpeed * Math.sign(P.speed);
      }
    }
  }

  update() {
    const P = this.player;

    // 1. Update Player Physics
    P.vel = Vector2.fromAngle(P.angle).mul(P.speed);
    P.pos.add(P.vel);

    // Collision with obstacles
    for (const obs of this.obstacles) {
      const d = Vector2.dist(P.pos, obs);
      if (d < obs.r + P.r) {
        // Bounce / push back
        const push = Vector2.sub(P.pos, obs).normalize().mul(obs.r + P.r);
        P.pos = Vector2.add(obs, push);
        P.speed *= -0.3;
      }
    }

    // Screen bounds
    P.pos.x = Math.max(P.r, Math.min(this.w - P.r, P.pos.x));
    P.pos.y = Math.max(P.r, Math.min(this.h - P.r, P.pos.y));

    // Player tire trail
    if (Math.abs(P.speed) > 1.2) {
      P.trail.push(P.pos.copy());
      if (P.trail.length > P.trailMax) P.trail.shift();
    }

    // 2. Pickups collection
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.pulsar += 0.08;
      if (Vector2.dist(P.pos, pk) < P.r + pk.r) {
        this.pickups.splice(i, 1);
        this.score += 100;
        this.spawnPickup();
        this.emitParticles(pk.x, pk.y, [241, 197, 109], 12);
      }
    }

    // 3. Update Civilians (Module 5 Path Following + Module 6 Avoidance)
    for (const civ of this.civilians) {
      const pathForce = SteeringBehaviors.pathFollow(civ.pos, civ.vel, this.roadPath, 35, civ.maxSpeed, civ.maxForce);
      const avoidForce = SteeringBehaviors.obstacleAvoid(civ.pos, civ.vel, this.obstacles, 70, civ.maxSpeed, civ.maxForce);
      const sepForce = SteeringBehaviors.separate(civ.pos, civ.vel, this.civilians, 24, civ.maxSpeed, civ.maxForce);

      // Flee from player if too close
      let fleePlayer = Vector2.zero();
      if (Vector2.dist(civ.pos, P.pos) < 90) {
        fleePlayer = SteeringBehaviors.flee(civ.pos, civ.vel, P.pos, civ.maxSpeed * 1.3, civ.maxForce * 2);
      }

      civ.acc.add(pathForce.mul(1.5));
      civ.acc.add(avoidForce.mul(2.2));
      civ.acc.add(sepForce.mul(1.2));
      civ.acc.add(fleePlayer.mul(2.5));

      civ.vel.add(civ.acc).limit(civ.maxSpeed);
      civ.pos.add(civ.vel);
      civ.acc = Vector2.zero();
    }

    // 4. Update Seekers / Chasers (Module 1 Seek / Flee + Obstacle Avoidance)
    for (const sk of this.seekers) {
      let targetForce = Vector2.zero();

      // Find nearest pickup to seek
      let closestPk = null;
      let minPkDist = Infinity;
      for (const pk of this.pickups) {
        const d = Vector2.dist(sk.pos, pk);
        if (d < minPkDist) {
          minPkDist = d;
          closestPk = pk;
        }
      }

      const distToPlayer = Vector2.dist(sk.pos, P.pos);

      // If player is close, flee the player (Module 1 Flee), otherwise seek pickup
      if (distToPlayer < 120) {
        sk.state = 'flee';
        targetForce = SteeringBehaviors.flee(sk.pos, sk.vel, P.pos, sk.maxSpeed * 1.2, sk.maxForce * 1.5);
      } else if (closestPk) {
        sk.state = 'seek';
        targetForce = SteeringBehaviors.seek(sk.pos, sk.vel, closestPk, sk.maxSpeed, sk.maxForce);
      }

      const avoidForce = SteeringBehaviors.obstacleAvoid(sk.pos, sk.vel, this.obstacles, 75, sk.maxSpeed, sk.maxForce);
      const boundaryForce = SteeringBehaviors.boundaries(sk.pos, sk.vel, this.w, this.h, 40, sk.maxSpeed, sk.maxForce);

      sk.acc.add(targetForce.mul(1.4));
      sk.acc.add(avoidForce.mul(2.2));
      sk.acc.add(boundaryForce.mul(1.5));

      sk.vel.add(sk.acc).limit(sk.maxSpeed);
      sk.pos.add(sk.vel);
      sk.acc = Vector2.zero();
    }

    // 5. Update Boids Flock (Module 7)
    this.flock.update(this.obstacles, this.w, this.h);

    // 6. Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.pos.add(pt.vel);
      pt.life -= 0.04;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  emitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        pos: new Vector2(x, y),
        vel: Vector2.random2D().mul(1 + Math.random() * 3),
        color: color,
        life: 1.0,
        size: 3 + Math.random() * 3
      });
    }
  }

  draw(p) {
    // 1. Draw city ground grid & streets
    this.drawCityMap(p);

    // 2. Draw Road Path (Module 5-3 representation)
    this.drawRoadPath(p);

    // 3. Draw Obstacles (Buildings)
    this.drawObstacles(p);

    // 4. Draw Pickups
    for (const pk of this.pickups) {
      const pulse = Math.sin(pk.pulsar) * 2;
      p.noStroke();
      p.fill(241, 197, 109, 230);
      p.circle(pk.x, pk.y, (pk.r + pulse) * 2);
      p.fill(255, 255, 220);
      p.circle(pk.x, pk.y, pk.r);
    }

    // 5. Draw Boids Crowd (Module 7)
    this.flock.draw(p);

    // 6. Draw Civilians (Module 5)
    for (const civ of this.civilians) {
      p.push();
      p.translate(civ.pos.x, civ.pos.y);
      p.rotate(civ.vel.heading());
      p.fill(civ.color);
      p.stroke(0, 50);
      p.strokeWeight(1);
      p.ellipse(0, 0, 14, 8);
      p.pop();
    }

    // 7. Draw Seekers / Chasers (Module 1)
    for (const sk of this.seekers) {
      p.push();
      p.translate(sk.pos.x, sk.pos.y);
      p.rotate(sk.vel.heading());
      p.noStroke();
      if (sk.state === 'flee') {
        p.fill(255, 60, 60, 220); // Red if fleeing player
      } else {
        p.fill(255, 140, 20, 220); // Orange if seeking
      }
      p.triangle(12, 0, -8, -6, -8, 6);
      p.pop();
    }

    // 8. Draw Player Tire Trail
    p.noFill();
    p.stroke(0, 245, 255, 70);
    p.strokeWeight(2);
    p.beginShape();
    for (const pt of this.player.trail) {
      p.vertex(pt.x, pt.y);
    }
    p.endShape();

    // 9. Draw Player Car
    this.drawPlayer(p);

    // 10. Draw Particles
    for (const pt of this.particles) {
      p.noStroke();
      p.fill(pt.color[0], pt.color[1], pt.color[2], pt.life * 255);
      p.circle(pt.pos.x, pt.pos.y, pt.size * pt.life);
    }
  }

  drawCityMap(p) {
    p.background(13, 17, 23);

    // Subdued grid pattern
    p.stroke(255, 255, 255, 8);
    p.strokeWeight(1);
    const step = 60;
    for (let x = 0; x < this.w; x += step) p.line(x, 0, x, this.h);
    for (let y = 0; y < this.h; y += step) p.line(0, y, this.w, y);
  }

  drawRoadPath(p) {
    p.noFill();
    // Road surface
    p.stroke(255, 255, 255, 18);
    p.strokeWeight(44);
    p.beginShape();
    for (const pt of this.roadPath) p.vertex(pt.x, pt.y);
    p.endShape(p.CLOSE);

    // Road dashed lane
    p.stroke(0, 245, 255, 50);
    p.strokeWeight(2);
    p.beginShape();
    for (const pt of this.roadPath) p.vertex(pt.x, pt.y);
    p.endShape(p.CLOSE);
  }

  drawObstacles(p) {
    for (const obs of this.obstacles) {
      // Glow / Shadow
      p.noStroke();
      p.fill(0, 0, 0, 80);
      p.circle(obs.x + 4, obs.y + 4, obs.r * 2);

      // Building Structure
      p.fill(24, 32, 44);
      p.stroke(255, 255, 255, 30);
      p.strokeWeight(2);
      p.circle(obs.x, obs.y, obs.r * 2);

      // Inner architectural roof
      p.fill(32, 42, 58);
      p.circle(obs.x, obs.y, obs.r * 1.5);

      // Text label
      p.fill(255, 255, 255, 120);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.text(obs.label, obs.x, obs.y);
    }
  }

  drawPlayer(p) {
    const P = this.player;
    p.push();
    p.translate(P.pos.x, P.pos.y);
    p.rotate(P.angle);

    // Car shadow
    p.noStroke();
    p.fill(0, 0, 0, 90);
    p.rect(-11, -7, 24, 14, 3);

    // Body (Neon Cyan Sports Car)
    p.fill(0, 245, 255);
    p.stroke(255, 255, 255, 160);
    p.strokeWeight(1);
    p.rect(-10, -6, 22, 12, 3);

    // Windshield
    p.fill(13, 17, 23);
    p.rect(-2, -4, 6, 8, 1);

    // Headlights
    p.fill(255, 255, 200);
    p.noStroke();
    p.circle(11, -4, 2.5);
    p.circle(11, 4, 2.5);

    // Taillights
    p.fill(255, 50, 50);
    p.circle(-10, -4, 2);
    p.circle(-10, 4, 2);

    // Headlight cones
    if (Math.abs(P.speed) > 0.1) {
      p.fill(255, 255, 200, 20);
      p.triangle(12, -4, 45, -16, 45, 8);
      p.triangle(12, 4, 45, -8, 45, 16);
    }

    p.pop();
  }
}
