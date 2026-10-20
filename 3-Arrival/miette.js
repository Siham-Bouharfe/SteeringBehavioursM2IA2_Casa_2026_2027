class Miette extends Vehicle {
  constructor(x, y, angle, speed, bornAt = millis()) {
    super(x, y);
    this.r = 3 + random(2);
    this.maxSpeed = 9;
    this.maxForce = 0.08;
    this.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.bornAt = bornAt;
    this.lifetime = 1450;
    this.rotation = random(TWO_PI);
  }

  isExpired(now = millis()) {
    return now - this.bornAt >= this.lifetime;
  }

  update() {
    this.applyForce(createVector(0, 0.09));
    super.update();
  }

  show() {
    const alpha = 255 * Math.max(0, 1 - (millis() - this.bornAt) / this.lifetime);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation + millis() * 0.005);
    noStroke();
    fill(255, 209, 133, alpha);
    ellipse(0, 0, this.r * 2.1, this.r * 1.3);
    fill(255, 242, 193, alpha);
    circle(-this.r * 0.45, -this.r * 0.08, this.r * 0.55);
    pop();
  }
}

if (typeof window !== 'undefined') window.Miette = Miette;
