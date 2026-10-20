class EscortCat extends Cat {
  constructor(points) {
    super(points[0].x, points[0].y);
    this.name = 'Pompon';
    this.color = '#fff2d6';
    this.route = points;
    this.maxSpeed = 1.65;
    this.maxForce = 0.16;
    this.r_pourDessin = 12;
  }

  escort(player, obstacles, neighbors) {
    const nearby = p5.Vector.dist(this.pos, player.pos) < 240;
    const follow = nearby ? GardenBehaviors.follow(this, this.route) : this.arrive(this.pos);
    const target = this.pos.copy().add(follow.copy().setMag(70));
    const heading = follow.magSq() ? follow.copy().normalize() : createVector(1, 0);
    this.targetDirection = heading;
    const force = GameRules.composeSteering([
      { force: follow, weight: 1 },
      { force: this.avoid(obstacles, heading, target, true), weight: nearby ? 3 : 0 },
      { force: this.separation(neighbors, 30), weight: nearby ? 1 : 0 },
    ], this.maxForce);
    this.applyForce(createVector(force.x, force.y));
  }
}
