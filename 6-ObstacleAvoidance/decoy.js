class Decoy extends Vehicle {
  constructor(x, y, expiresAt) {
    super(x, y);
    this.expiresAt = expiresAt;
    this.phase = 0;
    this.r_pourDessin = 18;
    this.r = 30;
  }

  update() {
    this.phase += 0.08;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, 22);
    noFill();
    stroke(113, 214, 192, 165);
    strokeWeight(2);
    torus(20 + Math.sin(this.phase) * 3, 1.3, 12, 6);
    noStroke();
    ambientMaterial(113, 214, 192);
    rotateY(this.phase);
    sphere(6, 12, 8);
    pop();
  }
}
