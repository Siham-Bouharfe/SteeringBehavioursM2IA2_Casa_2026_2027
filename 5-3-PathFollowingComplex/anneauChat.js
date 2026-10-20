class AnneauChat extends Vehicle {
  constructor(x, y, owner, segmentIndex) {
    super(x, y, 3.2, 0.2);
    this.owner = owner;
    this.segmentIndex = segmentIndex;
    this.r = 17;
    this.couleur = owner.couleur;
  }

  // Arrivée douce vers le segment précédent, calculée comme une force de steering.
  arrive(target, slowingRadius = 48) {
    const desired = p5.Vector.sub(target, this.pos);
    const distance = desired.mag();
    if (distance === 0) return createVector(0, 0);
    const desiredSpeed = this.maxSpeed * Math.min(1, distance / slowingRadius);
    desired.setMag(desiredSpeed);
    return desired.sub(this.vel).limit(this.maxForce);
  }

  show() {
    const shade = Math.min(0.58, this.segmentIndex * 0.035);
    const ringColor = lerpColor(color(this.couleur), color(35, 38, 55), shade);
    noStroke();
    fill(ringColor);
    circle(this.pos.x, this.pos.y, this.r);
  }
}

if (typeof window !== 'undefined') window.AnneauChat = AnneauChat;
