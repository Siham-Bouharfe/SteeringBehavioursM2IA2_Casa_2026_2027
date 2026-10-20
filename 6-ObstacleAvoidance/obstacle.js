class Obstacle extends Vehicle {
  constructor(x, y, r, couleur, velocity = createVector(0, 0)) {
    super(x, y);
    this.r = r;
    this.color = couleur;
    this.velocity = velocity.copy();
    this.isMoving = this.velocity.magSq() > 0;
  }

  update(bounds = 24) {
    if (!this.isMoving) return;

    this.pos.add(this.velocity);
    if (this.pos.x < bounds + this.r || this.pos.x > width - bounds - this.r) {
      this.velocity.x *= -1;
      this.pos.x = constrain(this.pos.x, bounds + this.r, width - bounds - this.r);
    }
    if (this.pos.y < bounds + this.r || this.pos.y > height - bounds - this.r) {
      this.velocity.y *= -1;
      this.pos.y = constrain(this.pos.y, bounds + this.r, height - bounds - this.r);
    }
    if (isHudBlocked(this.pos.x, this.pos.y)) {
      this.pos.sub(this.velocity.copy().mult(2));
      this.velocity.mult(-1);
    }
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, 2);
    noStroke();
    ambientMaterial('#090c19');
    push(); translate(4, 6, -5); box(this.r * 1.55, this.r * 0.95, 12); pop();
    ambientMaterial('#25283c');
    box(this.r * 1.4, this.r * 0.85, 17);
    emissiveMaterial(this.color);
    push(); translate(0, -this.r * 0.43, 4); box(this.r * 1.25, 3, 5); pop();
    push(); translate(0, this.r * 0.43, 4); box(this.r * 1.25, 3, 5); pop();
    if (this.isMoving) {
      emissiveMaterial('#ffe66d');
      push();
      translate(0, 0, 12);
      torus(this.r * 0.62, 1.5, 16, 5);
      pop();
    }
    pop();
  }
}
