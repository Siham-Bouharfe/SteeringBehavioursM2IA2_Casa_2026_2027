class Anneau extends Vehicle {
  constructor(x, y, index, isGolden = false) {
    super(x, y);
    this.r = Math.max(7, 13 - index * 0.12);
    this.maxSpeed = 5;
    this.maxForce = 0.34;
    this.rayonZoneDeFreinage = 60;
    this.index = index;
    this.phase = index * 0.7;
    this.isGolden = isGolden;
  }

  follow(target, leaderHeading = 0, now = millis(), motionSpeed = 1) {
    const followPoint = this.getFollowPoint(target, leaderHeading, now, motionSpeed);
    this.applyForce(this.arrive(followPoint, 0));
    this.update();
    this.phase += 0.08;
  }

  getFollowPoint(target, leaderHeading, now, motionSpeed = 1) {
    const motion = Math.max(0, Math.min(1, motionSpeed / 3));
    const amplitude = Math.min(3, 0.25 + this.index * 0.08) * motion;
    const wave = Math.sin(now * 0.004 - this.index * 0.65) * amplitude;
    const point = target.copy();
    point.x += -Math.sin(leaderHeading) * wave;
    point.y += Math.cos(leaderHeading) * wave;
    point.x = Math.max(this.r, Math.min(width - this.r, point.x));
    point.y = Math.max(this.r, Math.min(height - this.r, point.y));
    return point;
  }

  show() {
    const pulse = 1 + Math.sin(this.phase) * 0.06;
    push();
    translate(this.pos.x, this.pos.y);
    noFill();
    stroke(255, 255, 255, 65);
    strokeWeight(7);
    circle(0, 0, this.r * 2.35 * pulse);
    stroke(this.isGolden ? '#ffe66d' : this.index % 2 ? '#ff9fbd' : '#d59cff');
    strokeWeight(4);
    circle(0, 0, this.r * 2 * pulse);
    pop();
  }
}

if (typeof window !== 'undefined') window.Anneau = Anneau;
