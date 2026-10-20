class Cat extends Vehicle {
  // Même cercle projeté que dans 4-Wander, avec une variation continue de l'angle.
  // Ce comportement retourne une force ; la locomotion reste celle de Vehicle.
  wander(dt = 1, randomSource = Math.random) {
    this.wanderTheta ??= (this.idlePhase || 0) % (Math.PI * 2);
    this.wanderHeading ??= this.idlePhase || -Math.PI / 2;
    const elapsed = Math.max(0, Math.min(2, dt));
    this.wanderTheta += (randomSource() * 2 - 1) * 0.28 * Math.sqrt(elapsed);
    if (this.vel.magSq() > 0.01) this.wanderHeading = this.vel.heading();
    const circleCenter = createVector(Math.cos(this.wanderHeading), Math.sin(this.wanderHeading)).mult(28);
    const theta = this.wanderHeading + this.wanderTheta;
    const desired = circleCenter.add(createVector(Math.cos(theta), Math.sin(theta)).mult(24));
    desired.setMag(this.maxSpeed * 0.62);
    return desired.sub(this.vel).limit(this.maxForce);
  }

  isWanderingNear(leader) {
    const distance = p5.Vector.dist(this.pos, leader.pos);
    // Deux seuils évitent de changer de comportement à chaque image sur la limite.
    const radius = this.nearMinetteWander ? 155 : 110;
    this.nearMinetteWander = leader.vel.magSq() < 0.81 && distance < radius;
    return this.nearMinetteWander;
  }

  applyNearbyWander(leader, neighbors, obstacles, dt = 1, randomSource = Math.random) {
    const wander = this.wander(dt, randomSource);
    const distance = p5.Vector.dist(this.pos, leader.pos);
    const returnWeight = Math.max(0, Math.min(1, (distance - 75) / 55)) * 2.6;
    const lookAhead = this.vel.magSq() > 0.01 ? this.vel.copy() : wander.copy();
    lookAhead.setMag(60);
    const target = this.pos.copy().add(lookAhead);
    this.targetDirection = lookAhead.copy().normalize();
    const avoid = this.avoid(obstacles, this.targetDirection, target, true);
    const steering = GameRules.composeSteering([
      { force: wander, weight: avoid.magSq() > 0 ? 0.15 : 0.85 },
      { force: this.seek(leader.pos), weight: returnWeight },
      { force: this.separation(neighbors, 38), weight: 1.7 },
      { force: avoid, weight: 3.2 },
    ], this.maxForce);
    const force = createVector(steering.x, steering.y);
    this.applyForce(force);
    return force;
  }

  applyBehaviors(target, obstacles, cats = []) {
    const heading = this.vel.magSq() > 0.05
      ? this.vel.copy().normalize()
      : p5.Vector.sub(target, this.pos).normalize();
    this.targetDirection = p5.Vector.sub(target, this.pos).normalize();
    const detour = this.getDetourTarget(target, obstacles);
    const steering = GameRules.composeSteering([
      { force: this.arrive(detour || target), weight: detour ? 0.7 : 0.9 },
      { force: this.avoid(obstacles, heading, target, true), weight: 3.2 },
      { force: this.separation(cats, 54), weight: 1.5 },
      { force: this.boundariesOld(), weight: 2.2 },
    ], this.maxForce);
    this.applyForce(createVector(steering.x, steering.y));
  }

  applyFlockBehaviors(leader, cats, obstacles, cohesionWeight = 0.78) {
    const target = leader.pos.copy();
    if (leader.vel.magSq() > 0.05) target.sub(leader.vel.copy().setMag(34));
    this.targetDirection = p5.Vector.sub(target, this.pos).normalize();
    const heading = this.vel.magSq() > 0.05 ? this.vel.copy().normalize() : this.targetDirection.copy();
    const detour = this.getDetourTarget(target, obstacles);
    const steering = GameRules.composeSteering([
      { force: this.arrive(detour || target), weight: detour ? 0.85 : 0.6 },
      { force: this.avoid(obstacles, heading, target, true), weight: 3.4 },
      { force: this.separation(cats, 58), weight: 1.8 },
      { force: this.alignment(cats, 145), weight: 0.55 },
      { force: this.cohesion(cats, 180), weight: cohesionWeight * 0.55 },
      { force: this.boundariesOld(), weight: 2.2 },
    ], this.maxForce);
    this.applyForce(createVector(steering.x, steering.y));
  }

  show() {
    const heading = this.vel.magSq() > 0.05 ? this.vel.heading() : 0;
    push();
    translate(this.pos.x, this.pos.y, 16);
    rotateZ(heading);
    noStroke();
    ambientMaterial(12, 19, 22, 75);
    push();
    translate(-3, 7, -9);
    scale(1.2, 0.85, 0.14);
    sphere(15, 12, 8);
    pop();

    ambientMaterial(this.color);
    push();
    translate(-3, 0, 0);
    scale(1.25, 0.9, 0.78);
    sphere(14, 16, 12);
    pop();
    push();
    translate(10, -3, 2);
    scale(0.86, 0.78, 0.72);
    sphere(12, 16, 12);
    pop();

    // Oreilles en volume, avec intérieur contrasté.
    ambientMaterial(this.color);
    push();
    translate(4, -13, 2);
    rotateZ(-0.28);
    cone(4.5, 12, 4, 1);
    pop();
    push();
    translate(16, -12, 2);
    rotateZ(0.22);
    cone(4.5, 12, 4, 1);
    pop();
    ambientMaterial(234, 139, 145);
    push();
    translate(4, -12, 5);
    cone(2, 7, 4, 1);
    translate(12, 0, 0);
    cone(2, 7, 4, 1);
    pop();

    ambientMaterial(250, 242, 223);
    push();
    translate(14, -4, 9);
    sphere(2.5, 8, 6);
    translate(0, 0, 2);
    ambientMaterial(39, 47, 52);
    sphere(1.1, 6, 5);
    pop();

    if (this.isLeader) {
      ambientMaterial(241, 197, 109);
      push();
      translate(-3, 0, 15);
      rotateX(HALF_PI);
      torus(7, 1.3, 8, 5);
      pop();
    }
    if (Vehicle.debug) {
      noFill();
      stroke(255, 230, 150);
      strokeWeight(1.5);
      push();
      translate(0, 0, 8);
      circle(0, 0, this.r);
      pop();
    }
    pop();
  }
}
