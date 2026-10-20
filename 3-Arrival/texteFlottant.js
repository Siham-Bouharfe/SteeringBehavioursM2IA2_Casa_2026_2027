class TexteFlottant extends Vehicle {
  constructor(x, y, message, bornAt = millis(), options = {}) {
    super(x, y);
    this.r = 1;
    this.maxSpeed = 3;
    this.maxForce = 0;
    this.vel.set(0, -1.2);
    this.message = message;
    this.bornAt = bornAt;
    this.lifetime = options.lifetime ?? 950;
    this.fontSize = options.fontSize ?? 17;
    this.riseSpeed = options.riseSpeed ?? 1.2;
    this.vel.set(0, -this.riseSpeed);
  }

  isExpired(now = millis()) {
    return now - this.bornAt >= this.lifetime;
  }

  update() {
    super.update();
  }

  show() {
    const age = millis() - this.bornAt;
    const alpha = 255 * Math.max(0, 1 - age / this.lifetime);
    push();
    textAlign(CENTER, CENTER);
    const celebrationScale = this.fontSize > 20
      ? 0.88 + 0.12 * Math.sin(age * 0.018) : 1;
    textSize(this.fontSize * celebrationScale);
    textStyle(BOLD);
    stroke(47, 38, 62, alpha * 0.45);
    strokeWeight(3);
    fill(255, 244, 220, alpha);
    text(this.message, this.pos.x, this.pos.y);
    pop();
  }
}

if (typeof window !== 'undefined') window.TexteFlottant = TexteFlottant;
