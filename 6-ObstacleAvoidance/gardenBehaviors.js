const GardenBehaviors = Object.freeze({
  // 2 : prédiction de la position future, puis seek / flee correct.
  pursue(agent, target, frames = 10) {
    return agent.seek(target.pos.copy().add(target.vel.copy().mult(frames)));
  },
  evade(agent, threat, frames = 10) {
    const force = GameRules.predictiveFleeForce(agent.pos, agent.vel, threat.pos, threat.vel,
      agent.maxSpeed, agent.maxForce, frames);
    return createVector(force.x, force.y);
  },
  // 5 : projection de la position future sur les segments du chemin.
  follow(agent, points) {
    if (!Array.isArray(points) || points.length === 0) return createVector(0, 0);
    const future = agent.pos.copy().add(agent.vel.copy().mult(12));
    let nearest = null;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index], b = points[index + 1];
      const t = GameRules.segmentProjectionAmount(future, a, b);
      const projection = a.copy().add(p5.Vector.sub(b, a).mult(t));
      const distance = p5.Vector.dist(future, projection);
      if (!nearest || distance < nearest.distance) nearest = { a, b, projection, distance, index };
    }
    const goal = points[points.length - 1];
    if (!nearest || (nearest.index === points.length - 2 && p5.Vector.dist(agent.pos, goal) < 90)) {
      return agent.arrive(goal);
    }
    // Reporter l'avance sur le segment suivant à un angle du chemin : prolonger
    // simplement l'ancien segment ferait osciller le véhicule après le virage.
    let target = nearest.projection.copy();
    let remaining = 35;
    for (let index = nearest.index; index < points.length - 1 && remaining > 0; index++) {
      const offset = p5.Vector.sub(points[index + 1], target);
      const distance = offset.mag();
      if (distance >= remaining) { target.add(offset.setMag(remaining)); break; }
      target = points[index + 1].copy();
      remaining -= distance;
    }
    return agent.seek(target);
  },
});
if (typeof module !== 'undefined' && module.exports) module.exports = GardenBehaviors;
