class Spark extends Vehicle {
  constructor(x, y, vx, vy, color, life, size) {
    super(x, y);
    this.vel.set(vx, vy);
    this.color = color;
    this.life = life;
    this.size = size;
    this.maxLife = life;
  }

  updateSpark(dt) {
    this.pos.add(this.vel.copy().mult(dt));
    this.vel.mult(Math.pow(0.96, dt));
    this.life -= dt;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, 15 + this.life * 0.2);
    noStroke();
    ambientMaterial(this.color);
    sphere(this.size * Math.min(1, this.life / 9), 6, 4);
    pop();
  }
}
