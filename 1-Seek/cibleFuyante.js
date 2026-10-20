// Variante de Target : fuite bornée dans le temps et dans la distance.
class CibleFuyante extends Target {
  constructor(x, y, detectionRadius = 200) {
    super(x, y);
    this.detectionRadius = detectionRadius;
    this.maximumEscapeDistance = 300;
    this.maximumEscapeDuration = 5000;
    this.escapeSpeedMultiplier = 1.7;
    this.escapeForceMultiplier = 2;
    this.escapeStartedAt = null;
    this.escapeThreat = null;
    this.ignoredThreat = null;
    this.lureBurstPending = false;
  }

  nearestVehicle(vehicles) {
    let nearest = null;
    let nearestDistance = this.detectionRadius ** 2;
    for (const vehicle of vehicles) {
      const dx = vehicle.pos.x - this.pos.x;
      const dy = vehicle.pos.y - this.pos.y;
      const distance = dx * dx + dy * dy;
      if (vehicle === this.ignoredThreat) {
        if (distance <= this.detectionRadius ** 2) continue;
        this.ignoredThreat = null;
      }
      if (distance <= nearestDistance) {
        nearest = vehicle;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  distanceTo(vehicle) {
    return p5.Vector.sub(vehicle.pos, this.pos).mag();
  }

  update(vehicles = [], now = millis()) {
    if (this.escapeStartedAt === null) {
      const threat = this.nearestVehicle(vehicles);
      if (threat) {
        this.escapeThreat = threat;
        this.escapeStartedAt = now;
        this.lureBurstPending = true;
      }
    }

    if (this.escapeStartedAt !== null) {
      const elapsed = now - this.escapeStartedAt;
      const distance = this.distanceTo(this.escapeThreat);
      if (elapsed >= this.maximumEscapeDuration || distance >= this.maximumEscapeDistance) {
        this.ignoredThreat = this.escapeThreat;
        this.escapeStartedAt = null;
        this.escapeThreat = null;
      } else {
        const baseSpeed = this.maxSpeed;
        const baseForce = this.maxForce;
        this.maxSpeed = Math.min(20, baseSpeed * this.escapeSpeedMultiplier);
        this.maxForce = Math.min(10, baseForce * this.escapeForceMultiplier);
        this.applyForce(this.flee(this.escapeThreat.pos));
        Vehicle.prototype.update.call(this);
        this.maxSpeed = baseSpeed;
        this.maxForce = baseForce;
        return;
      }
    }

    super.update();
  }

  consumeLureBurst() {
    const pending = this.lureBurstPending;
    this.lureBurstPending = false;
    return pending;
  }

  showDetection(debug = false, vehicles = []) {
    if (!debug) return;
    const radiusSquared = this.detectionRadius ** 2;
    const threatened = vehicles.some(vehicle => {
      const dx = vehicle.pos.x - this.pos.x;
      const dy = vehicle.pos.y - this.pos.y;
      return dx * dx + dy * dy <= radiusSquared;
    });
    push();
    noFill();
    stroke(threatened ? '#ff4545' : '#ffd84d');
    strokeWeight(2);
    circle(this.pos.x, this.pos.y, this.detectionRadius * 2);
    pop();
  }
}

if (typeof window !== 'undefined') window.CibleFuyante = CibleFuyante;
