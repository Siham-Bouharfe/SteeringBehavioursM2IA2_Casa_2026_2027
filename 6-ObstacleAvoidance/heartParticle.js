class HeartParticle extends Vehicle {
  constructor(x, y, vx, vy, life = 1.1) {
    super(x, y);
    this.vel.set(vx, vy);
    this.life = life;
    this.maxLife = life;
    this.r_pourDessin = 7;
    this.r = 14;
  }

  update(dt) {
    this.pos.add(this.vel.copy().mult(dt));
    this.vel.mult(Math.pow(0.96, dt));
    this.life -= dt / 60;
  }
}
