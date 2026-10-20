class RescueGroup extends Vehicle {
  constructor(x, y, count = 2) {
    super(x, y);
    this.count = count;
    this.r = 27;
    this.phase = random(TWO_PI);
  }

  updateGroup(dt) {
    this.phase += dt * 0.025;
  }

  show() {
    const pulse = 1 + Math.sin(this.phase + frameCount * 0.02) * 0.08;
    push();
    translate(this.pos.x, this.pos.y, 8 + Math.sin(frameCount * 0.05 + this.phase) * 2);
    noStroke();
    emissiveMaterial('#51f7c7');
    torus(19 * pulse, 2, 18, 6);
    ambientMaterial('#172b39');
    cylinder(18, 4, 18, 1);
    for (let i = 0; i < Math.min(this.count, 4); i++) {
      const x = (i - (Math.min(this.count, 4) - 1) / 2) * 8;
      push();
      translate(x, 0, 8);
      ambientMaterial(i % 2 ? '#ffe4c3' : '#d6f7ff');
      sphere(3.2, 8, 6);
      push(); translate(-1.8, -2, 2); cone(1.2, 4, 4, 1); translate(3.6, 0, 0); cone(1.2, 4, 4, 1); pop();
      pop();
    }
    emissiveMaterial('#b8fff0');
    textAlign(CENTER, CENTER);
    textSize(10);
    text(`+${this.count}`, 0, -27, 18);
    pop();
  }
}
