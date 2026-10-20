class Croquette extends Vehicle {
  constructor(x, y, isGolden = false) {
    super(x, y);
    this.r = 11;
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.sparklePhase = random(TWO_PI);
    this.isGolden = isGolden;
  }

  show() {
    const pulse = 1 + Math.sin(frameCount * 0.08 + this.sparklePhase) * 0.08;
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();
    drawingContext.shadowColor = this.isGolden ? 'rgba(255, 234, 128, 0.95)' : 'rgba(255, 188, 91, 0.7)';
    drawingContext.shadowBlur = this.isGolden ? 24 : 15;
    fill(this.isGolden ? '#ffe66d' : '#ffc36f');
    ellipse(0, 0, this.r * 2.2 * pulse, this.r * 1.55 * pulse);
    drawingContext.shadowBlur = 0;
    fill(this.isGolden ? '#fff9c4' : '#ffe7a8');
    ellipse(-this.r * 0.2, -this.r * 0.18, this.r * 0.72, this.r * 0.34);
    fill(this.isGolden ? '#d69b36' : '#bd7047');
    circle(this.r * 0.48, this.r * 0.2, this.r * 0.25);
    pop();
  }
}

if (typeof window !== 'undefined') window.Croquette = Croquette;
