// Confetti autonome : elles réutilisent l'état et la locomotion de Vehicle.
class Confetti extends Vehicle {
  constructor(x, y, angle, colorIndex = 0) {
    super(x, y);
    this.palette = ['#ff5b72', '#ff9d67', '#ffd166', '#70d6ff', '#c792ea', '#fff1d6'];
    this.confettiColor = this.palette[colorIndex % this.palette.length];
    const speed = random(3, 8);
    this.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed - random(1, 4));
    this.maxSpeed = 12;
    this.maxForce = 1;
    this.r = random(2, 4);
    this.rotation = random(0, Math.PI * 2);
    this.spin = random(-0.2, 0.2);
    this.bornAt = millis();
    this.lifetime = random(900, 1500);
  }

  isExpired(now = millis()) {
    return now - this.bornAt >= this.lifetime;
  }

  update() {
    const gravity = createVector(0, 0.18);
    const drag = this.vel.copy().mult(-0.012);
    gravity.add(drag);
    this.applyForce(gravity);
    super.update();
    this.rotation += this.spin;
  }

  show() {
    const life = constrain((millis() - this.bornAt) / this.lifetime, 0, 1);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    drawingContext.globalAlpha = 1 - life;
    noStroke();
    fill(this.confettiColor);
    if (Math.floor(this.r) % 2 === 0) {
      rect(-this.r, -this.r * 1.6, this.r * 2, this.r * 3.2, 1);
    } else {
      circle(0, 0, this.r * 2);
    }
    pop();
  }
}

if (typeof window !== 'undefined') window.Confetti = Confetti;
