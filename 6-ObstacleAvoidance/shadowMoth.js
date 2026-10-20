class ShadowMoth extends Vehicle {
  constructor(route, id) {
    super(route[0].x, route[0].y);
    this.route = route;
    this.id = id;
    this.waypoint = 1;
    this.radius = this.r_pourDessin = 22;
    this.hitCooldown = 0;
    this.chasing = false;
    this.spin = id * 1.7;
    this.maxForce = 0.16;
    this.maxSpeed = 1.15;
  }

  pilot(target, pursuing, speed = 1.15, obstacles = []) {
    this.maxSpeed = speed;
    const force = pursuing ? GardenBehaviors.pursue(this, target, 10) : this.arrive(target.pos);
    const direction = p5.Vector.sub(target.pos, this.pos).normalize();
    this.targetDirection = direction;
    const combined = GameRules.composeSteering([
      { force, weight: 1 },
      { force: this.avoid(obstacles, direction, target.pos, true), weight: 3 },
    ], this.maxForce);
    this.applyForce(createVector(combined.x, combined.y));
    super.update();
    this.spin += 0.08;
  }
}
