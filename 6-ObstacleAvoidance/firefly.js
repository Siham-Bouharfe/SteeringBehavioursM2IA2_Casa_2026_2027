function nearestFireflyTarget(position, fireflies, maxDistance = 520) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) ||
      !Array.isArray(fireflies) || !Number.isFinite(maxDistance) || maxDistance < 0) {
    throw new TypeError('Perception invalide pour la cible luciole.');
  }

  let nearest = null;
  let nearestDistance = maxDistance;
  for (const firefly of fireflies) {
    const distance = Math.hypot(position.x - firefly.pos.x, position.y - firefly.pos.y);
    if (distance < nearestDistance) {
      nearest = firefly;
      nearestDistance = distance;
    }
  }
  return nearest;
}

class Firefly extends Vehicle {
  constructor(x, y, index = 0) {
    super(x, y);
    this.id = `firefly-${index}`;
    this.anchor = createVector(x, y);
    this.phase = index * 1.7;
    this.driftRadius = 26 + index % 4 * 7;
    this.maxSpeed = 0.72;
    this.maxForce = 0.035;
    this.r_pourDessin = 3;
    this.r = 8;
    this.color = index % 3 === 0 ? '#8df4de' : index % 3 === 1 ? '#f7e77c' : '#d7a8ff';
  }

  update(swarm, obstacles, dt = 1, player = null) {
    this.phase += 0.025 * dt;
    const heading = this.vel.magSq() > 0.01 ? this.vel.heading() : this.phase;
    const desired = createVector(Math.cos(heading + Math.sin(this.phase) * 0.35),
      Math.sin(heading + Math.sin(this.phase) * 0.35)).mult(this.maxSpeed);
    const wander = desired.sub(this.vel).limit(this.maxForce);
    const anchorDistance = p5.Vector.dist(this.pos, this.anchor);
    const detour = this.getDetourTarget(this.anchor, obstacles);
    const startled = player?.meowRemaining > 0 && p5.Vector.dist(this.pos, player.pos) < 110;
    const flee = startled ? GameRules.predictiveFleeForce(this.pos, this.vel, player.pos,
      player.vel, this.maxSpeed, this.maxForce, 8) : { x: 0, y: 0 };
    const steering = GameRules.composeSteering([
      { force: wander, weight: 0.45 },
      { force: this.arrive(detour || this.anchor), weight: Math.max(0, (anchorDistance - 60) / 80) },
      { force: this.separation(swarm, 24), weight: 1.2 },
      { force: this.alignment(swarm, 115), weight: 0.7 },
      { force: this.cohesion(swarm, 130), weight: 0.45 },
      { force: flee, weight: startled ? 3 : 0 },
    ], this.maxForce);
    this.applyForce(createVector(steering.x, steering.y));
    super.update();
  }
}

function createGardenFireflies(width, height, racePark) {
  const anchors = [
    [0.09, 0.12], [0.37, 0.10], [0.66, 0.11], [0.91, 0.16],
    [0.10, 0.36], [0.89, 0.39], [0.10, 0.64], [0.37, 0.63],
    [0.5, 0.5], [0.66, 0.65], [0.91, 0.63], [0.11, 0.88],
    [0.38, 0.88], [0.66, 0.88], [0.91, 0.86],
  ];
  return anchors
    .map(([x, y], index) => ({ x: x * width, y: y * height, index }))
    .filter(point => !racePark || point.x < racePark.x - 100 ||
      point.x > racePark.x + racePark.w + 100 ||
      point.y < racePark.y - 100 || point.y > racePark.y + racePark.h + 100)
    .flatMap(point => [-1, 0, 1].map((side, index) =>
      new Firefly(point.x + side * 20, point.y + (index % 2) * 18, point.index * 3 + index)));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Firefly, createGardenFireflies, nearestFireflyTarget };
}
