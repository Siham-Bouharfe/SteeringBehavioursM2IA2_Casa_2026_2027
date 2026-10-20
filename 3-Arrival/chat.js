class Chat extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 20;
    this.maxSpeed = 4.4;
    this.maxForce = 0.22;
    this.rayonZoneDeFreinage = 110;
    this.bobPhase = 0;
    this.coat = '#858d9a';
  }

  followPointer(x, y) {
    this.applyForce(this.arrive(createVector(x, y), 0));
    this.update();
    this.edges();
    this.bobPhase += 0.09;
  }

  hasCaught(food) {
    return p5.Vector.dist(this.pos, food.pos) <= this.r + food.r;
  }

  show() {
    const bob = Math.sin(this.bobPhase) * 1.5;
    const heading = this.vel.mag() > 0.15 ? this.vel.heading() : 0;
    push();
    translate(this.pos.x, this.pos.y + bob);
    rotate(heading);
    noStroke();
    fill(32, 34, 52, 45);
    ellipse(0, this.r * 1.02, this.r * 2.35, this.r * 0.58);
    fill(this.coat);
    ellipse(0, 0, this.r * 2.05, this.r * 1.62);
    fill(this.coat);
    triangle(-this.r * 0.72, -this.r * 0.34, -this.r * 0.66, -this.r * 1.25,
      -this.r * 0.08, -this.r * 0.58);
    triangle(this.r * 0.12, -this.r * 0.56, this.r * 0.7, -this.r * 1.25,
      this.r * 0.78, -this.r * 0.32);
    fill('#d49aa6');
    triangle(-this.r * 0.56, -this.r * 0.52, -this.r * 0.55, -this.r * 1.02,
      -this.r * 0.25, -this.r * 0.57);
    triangle(this.r * 0.36, -this.r * 0.56, this.r * 0.61, -this.r * 1.02,
      this.r * 0.62, -this.r * 0.4);
    fill('#e7e0d7');
    ellipse(this.r * 0.16, this.r * 0.3, this.r * 0.82, this.r * 0.76);
    ellipse(this.r * 0.43, -this.r * 0.08, this.r * 0.56, this.r * 0.7);
    fill('#b7d6aa');
    circle(this.r * 0.51, -this.r * 0.08, this.r * 0.24);
    fill('#293149');
    circle(this.r * 0.51, -this.r * 0.08, this.r * 0.11);
    fill('#d49aa6');
    circle(this.r * 0.83, this.r * 0.16, this.r * 0.2);
    noFill();
    stroke('#e2c9c1');
    strokeWeight(1.2);
    line(this.r * 0.74, this.r * 0.24, this.r * 1.12, this.r * 0.12);
    line(this.r * 0.74, this.r * 0.3, this.r * 1.1, this.r * 0.38);
    stroke('#5a6474');
    strokeWeight(2.2);
    line(-this.r * 0.6, -this.r * 0.35, -this.r * 0.48, this.r * 0.12);
    line(-this.r * 0.25, -this.r * 0.64, -this.r * 0.14, -this.r * 0.34);
    line(-this.r * 0.1, this.r * 0.53, this.r * 0.05, this.r * 0.72);
    pop();
  }
}

if (typeof window !== 'undefined') window.Chat = Chat;
