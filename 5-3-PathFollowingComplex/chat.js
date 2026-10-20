class Chat extends Vehicle {
  constructor(x, y, heading, coatColor, ringCount = 12, ringSpacing = 26) {
    super(x, y, 2.8, 0.18);
    this.r = 22;
    this.couleur = coatColor;
    this.owner = this;
    this.segmentIndex = 0;
    this.followWeight = 1.4;
    this.separateWeight = 1.2;
    this.wanderWeight = WANDER_WEIGHT;
    this.ringSpacing = ringSpacing;
    this.vel.set(Math.cos(heading), Math.sin(heading)).mult(this.maxSpeed);
    this.rings = [];

    for (let index = 1; index <= ringCount; index++) {
      const xRing = x - Math.cos(heading) * this.ringSpacing * index;
      const yRing = y - Math.sin(heading) * this.ringSpacing * index;
      this.rings.push(new AnneauChat(xRing, yRing, this, index));
    }
  }

  parts() {
    return [this, ...this.rings];
  }

  setRingCount(count) {
    while (this.rings.length > count) this.rings.pop();

    while (this.rings.length < count) {
      const leader = this.rings[this.rings.length - 1] || this;
      const heading = leader.vel.mag() > 0.05 ? leader.vel.heading() : this.vel.heading();
      const x = leader.pos.x - Math.cos(heading) * this.ringSpacing;
      const y = leader.pos.y - Math.sin(heading) * this.ringSpacing;
      this.rings.push(new AnneauChat(x, y, this, this.rings.length + 1));
    }
  }

  setRingSpacing(spacing) {
    this.ringSpacing = spacing;
  }

  neighborsFor(part, allParts) {
    return allParts.filter(other => other !== part &&
      (other.owner !== this || Math.abs(other.segmentIndex - part.segmentIndex) > 1));
  }

  steer(path, allParts, followWeight, separateWeight) {
    this.followWeight = followWeight;
    this.separateWeight = separateWeight;

    const pathForce = this.follow(path);
    const separationForce = this.separate(this.neighborsFor(this, allParts));
    const wanderForce = this.wander();
    pathForce.mult(this.followWeight);
    separationForce.mult(this.separateWeight);
    wanderForce.mult(this.wanderWeight);
    this.applyForce(pathForce);
    this.applyForce(separationForce);
    this.applyForce(wanderForce);

    let leader = this;
    for (const ring of this.rings) {
      const heading = leader.vel.mag() > 0.05 ? leader.vel.heading() : this.vel.heading();
      const behind = createVector(Math.cos(heading), Math.sin(heading)).mult(this.ringSpacing);
      const followTarget = p5.Vector.sub(leader.pos, behind);
      const follow = ring.arrive(followTarget);
      const separate = ring.separate(this.neighborsFor(ring, allParts));
      follow.mult(this.followWeight);
      separate.mult(this.separateWeight);
      ring.applyForce(follow);
      ring.applyForce(separate);
      leader = ring;
    }
  }

  move() {
    this.update();
    this.edges();
    this.rings.forEach(ring => {
      ring.update();
      ring.edges();
    });
  }

  show() {
    this.rings.forEach(ring => ring.show());
    this.showSeparationDebug();
    const heading = this.vel.mag() > 0.1 ? this.vel.heading() : 0;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(heading);
    noStroke();
    fill(this.couleur);
    ellipse(0, 0, this.r * 1.8, this.r * 1.4);
    triangle(-this.r * 0.7, -this.r * 0.35, -this.r * 0.58, -this.r * 1.15,
      -this.r * 0.08, -this.r * 0.55);
    triangle(this.r * 0.12, -this.r * 0.55, this.r * 0.62, -this.r * 1.1,
      this.r * 0.76, -this.r * 0.25);
    fill('#d9909f');
    triangle(-this.r * 0.48, -this.r * 0.52, -this.r * 0.48, -this.r * 0.98,
      -this.r * 0.2, -this.r * 0.55);
    triangle(this.r * 0.32, -this.r * 0.55, this.r * 0.54, -this.r * 0.94,
      this.r * 0.62, -this.r * 0.4);
    fill('#f8ecd9');
    ellipse(this.r * 0.42, -this.r * 0.08, this.r * 0.52, this.r * 0.62);
    fill('#24313b');
    circle(this.r * 0.49, -this.r * 0.08, this.r * 0.17);
    fill('#e88491');
    circle(this.r * 0.8, this.r * 0.16, this.r * 0.18);
    stroke('#f8e7d7');
    strokeWeight(1);
    line(this.r * 0.73, this.r * 0.22, this.r * 1.08, this.r * 0.13);
    line(this.r * 0.73, this.r * 0.27, this.r * 1.05, this.r * 0.36);
    pop();
  }

  showSeparationDebug() {
    if (!Vehicle.debug) return;
    for (const part of this.parts()) {
      noFill();
      stroke(255, 150, 70, 110);
      strokeWeight(1);
      circle(part.pos.x, part.pos.y, part.r * 4);
    }
  }
}

if (typeof window !== 'undefined') window.Chat = Chat;
