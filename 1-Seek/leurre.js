// Leurre mobile en forme de tomate : c'est une vraie cible pour la population.
class Leurre extends Target {
  static launchPosition(target, angle, clearance = 12) {
    const distance = target.r + 13 + clearance;
    return createVector(
      target.pos.x + Math.cos(angle) * distance,
      target.pos.y + Math.sin(angle) * distance
    );
  }

  constructor(x, y, launchAngle) {
    super(x, y);
    this.r = 13;
    this.maxSpeed = 5;
    this.wanderSpeed = 5;
    this.wanderForce = 0.16;
    this.wanderDirection = createVector(Math.cos(launchAngle), Math.sin(launchAngle));
    this.nextVariationAt = millis() + 1400;
    this.bornAt = millis();
    this.lifetime = 4200;
  }

  isExpired(now = millis()) {
    return now - this.bornAt >= this.lifetime;
  }

  update() {
    super.update();
    this.r = 13;
  }

  show() {
    const wobble = Math.sin(millis() * 0.012 + this.bornAt) * 0.12;
    push();
    translate(this.pos.x, this.pos.y);
    rotate((this.vel.mag() > 0.05 ? this.vel.heading() : 0) + wobble);
    drawingContext.shadowColor = 'rgba(255, 79, 92, 0.58)';
    drawingContext.shadowBlur = 12;
    noStroke();
    fill('#ed4557');
    ellipse(0, 1, this.r * 2, this.r * 1.72);
    drawingContext.shadowBlur = 0;
    fill('#c72f48');
    ellipse(0, this.r * 0.38, this.r * 1.35, this.r * 0.45);
    fill('#65b768');
    triangle(-this.r * 0.58, -this.r * 0.43, this.r * 0.58, -this.r * 0.43, 0, -this.r * 1.02);
    triangle(-this.r * 0.48, -this.r * 0.48, 0, -this.r * 0.35, -this.r * 0.94, -this.r * 0.86);
    triangle(this.r * 0.48, -this.r * 0.48, 0, -this.r * 0.35, this.r * 0.94, -this.r * 0.86);
    stroke('#397b4c');
    strokeWeight(2);
    line(0, -this.r * 0.4, 0, -this.r * 1.1);
    noStroke();
    fill(255, 239, 219, 205);
    circle(-this.r * 0.3, -this.r * 0.08, this.r * 0.32);
    pop();
  }
}

if (typeof window !== 'undefined') window.Leurre = Leurre;
