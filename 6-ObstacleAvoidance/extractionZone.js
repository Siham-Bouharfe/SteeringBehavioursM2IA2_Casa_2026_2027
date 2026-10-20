class ExtractionZone extends Vehicle {
  constructor(x, y, radius = 56) {
    super(x, y);
    this.r = radius;
    this.r_pourDessin = radius;
    this.phase = 0;
  }

  updateZone(dt) {
    this.phase += dt * 0.035;
  }

  show() {
    const pulse = 1 + Math.sin(this.phase) * 0.045;
    push();
    translate(this.pos.x, this.pos.y, 1);
    noStroke();
    ambientMaterial('#101d32');
    cylinder(this.r * 1.12, 3, 36, 1);
    emissiveMaterial('#35e5ef');
    noFill();
    stroke('#35e5ef');
    strokeWeight(3);
    torus(this.r * pulse, 2.2, 32, 8);
    stroke('#ff4fc8');
    strokeWeight(1.5);
    torus(this.r * 0.72, 1.2, 28, 6);
    noStroke();
    push();
    translate(0, 0, 28);
    emissiveMaterial('#9afaff');
    cylinder(2.5, 40 + Math.sin(this.phase * 1.7) * 5, 8, 1);
    sphere(5, 10, 7);
    pop();
    pop();
  }

  show2D() {
    const pulse = 1 + Math.sin(this.phase) * 0.045;
    push();
    translate(this.pos.x, this.pos.y);
    noFill();
    stroke(34, 86, 78, 55);
    strokeWeight(8);
    circle(0, 0, this.r * 2.15);
    stroke('#56d7c0');
    strokeWeight(4);
    circle(0, 0, this.r * 2 * pulse);
    stroke('#ecf7da');
    strokeWeight(2);
    circle(0, 0, this.r * 1.35);
    noStroke();
    fill('#315b55');
    circle(0, 0, 31);
    fill('#eff8e4');
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(10);
    text('REFUGE', 0, 0);
    pop();
  }
}
