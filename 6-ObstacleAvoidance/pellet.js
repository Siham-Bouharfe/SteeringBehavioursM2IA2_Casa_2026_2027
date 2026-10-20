class Pellet extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r_pourDessin = 12;
    this.r = 18;
    this.phase = random(TWO_PI);
  }

  get x() { return this.pos.x; }
  get y() { return this.pos.y; }

  show() {
    const pulse = 1 + Math.sin(frameCount * 0.09 + this.phase) * 0.1;
    push();
    translate(this.pos.x, this.pos.y, 20 + Math.sin(frameCount * 0.06 + this.phase) * 2);
    noStroke();
    ambientMaterial(246, 191, 95);
    rotateZ(frameCount * 0.012);
    scale(pulse, pulse, 1);
    torus(9, 4, 12, 7);
    ambientMaterial(255, 242, 215);
    sphere(2.2, 8, 6);
    pop();
  }
}
