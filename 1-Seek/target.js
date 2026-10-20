// Cible mobile autonome : son cap varie doucement, avec des variations aléatoires
// périodiques de vitesse souhaitée, de force de pilotage et de taille.
class Target extends FleeVehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 34;
    this.wanderSpeed = 2.5;
    this.wanderForce = 0.08;
    this.wanderDirection = p5.Vector.random2D();
    this.nextVariationAt = 0;
    this.sampledColor = [255, 0, 180, 255];
  }

  update() {
    if (millis() >= this.nextVariationAt) {
      this.wanderSpeed = random(1.2, 4.2);
      this.wanderForce = random(0.04, 0.14);
      this.r = random(18, 46);
      this.wanderDirection = p5.Vector.random2D();
      this.nextVariationAt = millis() + random(900, 2200);
    }

    this.moveWithSteering(this.wanderSteering());
  }

  moveWithSteering(force) {
    this.applyForce(force);
    Vehicle.prototype.update.call(this);
  }

  wanderSteering() {
    const desiredVelocity = this.wanderDirection.copy()
      .setMag(Math.min(this.wanderSpeed, this.maxSpeed));
    const steering = p5.Vector.sub(desiredVelocity, this.vel);
    steering.limit(Math.min(this.wanderForce, this.maxForce));
    return steering;
  }

  sampleBackground(rgba) {
    this.sampledColor = rgba;
  }

  show() {
    const pulse = 1 + Math.sin(millis() * 0.002) * 0.045;
    push();
    noStroke();
    drawingContext.shadowColor = 'rgba(255, 177, 158, 0.68)';
    drawingContext.shadowBlur = 24;
    fill(255, 193, 174, 34);
    circle(this.pos.x, this.pos.y, this.r * 2.8 * pulse);
    drawingContext.shadowBlur = 0;
    stroke('rgba(255, 248, 239, 0.96)');
    strokeWeight(2.5);
    fill(this.sampledColor);
    circle(this.pos.x, this.pos.y, this.r * 2 * pulse);
    noStroke();
    fill(255, 245, 230, 190);
    circle(this.pos.x - this.r * 0.25, this.pos.y - this.r * 0.28, this.r * 0.28);
    pop();
  }
}
