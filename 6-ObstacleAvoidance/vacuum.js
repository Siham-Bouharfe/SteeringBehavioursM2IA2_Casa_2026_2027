const VACUUM_TYPES = {
  chaser: {
    label: 'CHASSEUR',
    color: '#ff416c',
    speed: 1.55,
    force: 0.12,
    radius: 24,
    targetMode: 'closest',
  },
  sprinter: {
    label: 'COUPEUR',
    color: '#c84dff',
    speed: 2.25,
    force: 0.16,
    radius: 22,
    targetMode: 'isolated',
  },
  blocker: {
    label: 'INTERCEPTEUR',
    color: '#ffb52e',
    speed: 1.25,
    force: 0.1,
    radius: 30,
    targetMode: 'leader',
  },
};

class Vacuum extends Vehicle {
  constructor(x, y, id, type = 'chaser', genome = null) {
    super(x, y);
    const behavior = VACUUM_TYPES[type];
    if (!behavior) throw new Error(`Unknown vacuum type: ${type}`);
    this.vel = p5.Vector.random2D().mult(1.2);
    this.id = id;
    this.type = type;
    this.label = behavior.label;
    this.color = behavior.color;
    this.targetMode = behavior.targetMode;
    this.baseSpeed = behavior.speed;
    this.genome = genome || GameRules.createGenome(random);
    this.r = behavior.radius;
    this.maxSpeed = behavior.speed * this.genome.speedFactor;
    this.maxForce = behavior.force;
    this.sensorLength = this.genome.sensorLength;
    this.avoidanceSide = id % 2 === 0 ? 1 : -1;
    this.avoidanceLock = 0;
    this.spin = random(TWO_PI);
    this.stunUntil = 0;
    this.captures = 0;
    this.wanderAngle = random(TWO_PI);
    this.patrolIndex = 0;
    this.patrolPoints = null;
  }

  update(target, obstacles, dt) {
    if (millis() < this.stunUntil) return;

    const targetDistance = p5.Vector.dist(this.pos, target.pos);
    this.targetDirection = p5.Vector.sub(target.pos, this.pos).normalize();
    const heading = this.vel.magSq() > 0.05 ? this.vel.copy().normalize() : this.targetDirection.copy();
    const sensorAvoidance = this.avoid(obstacles, heading, target.pos, true);
    const nearestSensorHit = (this.sensorReadings || []).reduce((nearest, sensor) =>
      Math.min(nearest, sensor.hitDistance), this.sensorLength);
    const neuralMood = GameRules.evaluateBrain(this.genome, [
      constrain(1 - targetDistance / (Math.max(width, height) * 0.65), 0, 1),
      constrain(1 - nearestSensorHit / Math.max(1, this.sensorLength), 0, 1),
      constrain(this.captures / 3, 0, 1),
    ]);
    const leadFrames = targetDistance < 240
      ? this.genome.predictionFrames
      : this.genome.predictionFrames * 0.55;
    const predictedTarget = target.pos.copy().add(target.vel.copy().mult(leadFrames));
    const patrol = this.type === 'blocker' && targetDistance > 290 && neuralMood < 0.68
      ? this.followPatrolPath()
      : null;
    const destination = this.getDetourPoint(patrol || predictedTarget, obstacles);
    const desired = p5.Vector.sub(destination, this.pos);
    if (desired.magSq() > 0) desired.setMag(this.maxSpeed);
    const steering = desired.sub(this.vel);
    if (targetDistance > 240) {
      this.wanderAngle += random(-0.045, 0.045);
      const wander = createVector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle))
        .mult(this.maxSpeed * 0.3 * (1 - neuralMood));
      steering.add(wander);
    }
    // Les capteurs alimentent le réseau et leur force reste active pendant la poursuite.
    steering.add(sensorAvoidance.mult(1.8));
    steering.limit(this.maxForce);

    this.applyForce(steering.mult(dt));
    super.update();
    this.pos.x = constrain(this.pos.x, this.r + 14, width - this.r - 14);
    this.pos.y = constrain(this.pos.y, this.r + 14, height - this.r - 14);
    this.spin += 0.08 * dt;
    this.avoidanceLock = Math.max(0, this.avoidanceLock - dt);
  }

  followPatrolPath() {
    if (!this.patrolPoints) {
      this.patrolPoints = [
        createVector(width * 0.25, height * 0.34),
        createVector(width * 0.74, height * 0.34),
        createVector(width * 0.77, height * 0.73),
        createVector(width * 0.27, height * 0.74),
      ];
    }
    const start = this.patrolPoints[this.patrolIndex];
    const end = this.patrolPoints[(this.patrolIndex + 1) % this.patrolPoints.length];
    const segment = p5.Vector.sub(end, start);
    const amount = GameRules.segmentProjectionAmount(this.pos, start, end);
    const onPath = start.copy().add(segment.mult(amount));
    if (p5.Vector.dist(onPath, end) < 38 && p5.Vector.dist(this.pos, end) < 95) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
      return this.patrolPoints[(this.patrolIndex + 1) % this.patrolPoints.length].copy();
    }
    const direction = p5.Vector.sub(end, start).normalize();
    return onPath.add(direction.mult(72));
  }

  getDetourPoint(target, obstacles) {
    const targetOffset = p5.Vector.sub(target, this.pos);
    const distance = targetOffset.mag();
    if (distance === 0) return target;
    const direction = targetOffset.div(distance);
    let blockingObstacle = null;
    let nearestProjection = Infinity;
    let clearance = 0;

    for (const obstacle of obstacles) {
      const offset = p5.Vector.sub(obstacle.pos, this.pos);
      const projection = offset.dot(direction);
      if (projection < 0 || projection > distance || projection >= nearestProjection) continue;
      const perpendicularSq = Math.max(0, offset.magSq() - projection * projection);
      const safeRadius = obstacle.r + this.r + 18;
      if (perpendicularSq >= safeRadius * safeRadius) continue;
      blockingObstacle = obstacle;
      nearestProjection = projection;
      clearance = safeRadius;
    }

    if (!blockingObstacle) return target;

    const lateral = createVector(-direction.y, direction.x);
    const currentSide = p5.Vector.sub(this.pos, blockingObstacle.pos).dot(lateral);
    if (this.avoidanceLock === 0) {
      if (Math.abs(currentSide) > 10) this.avoidanceSide = Math.sign(currentSide);
      else this.avoidanceSide *= -1;
      this.avoidanceLock = 28;
    }
    return blockingObstacle.pos.copy()
      .add(direction.copy().mult(clearance))
      .add(lateral.mult(this.avoidanceSide * clearance));
  }

  stun(duration) {
    this.stunUntil = millis() + duration;
    this.vel.mult(0.2);
  }

  show() {
    const stunned = millis() < this.stunUntil;
    const heading = this.vel.magSq() > 0.01 ? this.vel.heading() : 0;
    push();
    translate(this.pos.x, this.pos.y, 18);
    rotateZ(heading);
    noStroke();
    ambientMaterial(5, 12, 16, 80);
    push();
    translate(0, 5, -12);
    scale(1.25, 1, 0.18);
    sphere(22, 12, 8);
    pop();

    ambientMaterial(stunned ? '#4a7881' : this.color);
    const size = this.type === 'blocker' ? 1.16 : this.type === 'sprinter' ? 0.92 : 1;
    scale(size, size, size);
    push();
    translate(0, 0, -2);
    ambientMaterial(20, 28, 34);
    cylinder(24, 8, 20, 1);
    pop();
    ambientMaterial(stunned ? '#4a7881' : this.color);
    cylinder(22, 13, 24, 1);
    ambientMaterial(stunned ? '#77caba' : '#f6c36e');
    translate(0, 0, 8);
    sphere(11, 14, 10);
    ambientMaterial(stunned ? '#8ce2d3' : '#ffe5ad');
    torus(15, 1.4, 14, 6);
    ambientMaterial(stunned ? '#71d6c0' : '#f47e67');
    push();
    translate(14, -5, 5);
    sphere(3.5, 8, 6);
    translate(-28, 10, -1);
    ambientMaterial('#f4eadb');
    sphere(2.2, 8, 6);
    pop();
    pop();

    push();
    translate(this.pos.x, this.pos.y - this.r - 17, 32);
    noStroke();
    ambientMaterial(20, 31, 36);
    box(76, 16, 5);
    ambientMaterial(stunned ? '#8ce2d3' : this.color);
    textAlign(CENTER, CENTER);
    textSize(8);
    text(this.label, 0, 1, 4);
    pop();

    if (stunned) {
      push();
      translate(this.pos.x, this.pos.y, 25);
      noFill();
      stroke('#71d6c0');
      strokeWeight(2);
      torus(this.r * 1.35 + Math.sin(frameCount * 0.4) * 2.5, 1.5, 20, 6);
      pop();
    }
  }
}
