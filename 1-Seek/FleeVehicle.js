// Variante de Vehicle qui ajoute une fuite conforme à la règle de Reynolds.
// Le Vehicle fourni reste intact ; seek() et la locomotion sont hérités.
class FleeVehicle extends Vehicle {
  flee(target) {
    const desiredVelocity = p5.Vector.sub(this.pos, target);
    if (desiredVelocity.mag() === 0) desiredVelocity.add(p5.Vector.random2D());
    desiredVelocity.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(desiredVelocity, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  // Rendu sobre sans la flèche rouge de Vehicle.show().
  show() {
    const speed = this.vel.mag();
    push();
    translate(this.pos.x, this.pos.y);
    rotate(speed > 0.01 ? this.vel.heading() : 0);
    drawingContext.shadowColor = 'rgba(119, 190, 255, 0.58)';
    drawingContext.shadowBlur = 10;
    noStroke();
    fill('#dcecff');
    beginShape();
    vertex(this.r, 0);
    vertex(-this.r * 0.72, -this.r * 0.58);
    vertex(-this.r * 0.38, 0);
    vertex(-this.r * 0.72, this.r * 0.58);
    endShape(CLOSE);
    drawingContext.shadowBlur = 0;
    fill('#ffac91');
    circle(-this.r * 0.36, 0, Math.max(2, this.r * 0.22));
    pop();
  }
}

if (typeof window !== 'undefined') window.FleeVehicle = FleeVehicle;
