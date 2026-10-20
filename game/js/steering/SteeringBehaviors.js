/**
 * SteeringBehaviors.js
 * All core steering algorithms implemented as static methods.
 * All inputs/outputs use Vector2 instances.
 */
class SteeringBehaviors {

  /* ── SEEK ──────────────────────────────────────────────────
   * Steer toward target at max speed.
   */
  static seek(pos, vel, target, maxSpeed, maxForce) {
    const desired = Vector2.sub(target, pos).setMag(maxSpeed);
    return Vector2.sub(desired, vel).limit(maxForce);
  }

  /* ── FLEE ──────────────────────────────────────────────────
   * Steer away from threat at max speed.
   */
  static flee(pos, vel, threat, maxSpeed, maxForce) {
    const desired = Vector2.sub(pos, threat).setMag(maxSpeed);
    return Vector2.sub(desired, vel).limit(maxForce);
  }

  /* ── ARRIVE ────────────────────────────────────────────────
   * Seek with deceleration inside slowRadius.
   */
  static arrive(pos, vel, target, maxSpeed, maxForce, slowRadius = 100) {
    const toTarget = Vector2.sub(target, pos);
    const d = toTarget.mag();
    if (d < 1) return Vector2.zero();
    const speed = d < slowRadius ? maxSpeed * (d / slowRadius) : maxSpeed;
    const desired = toTarget.setMag(speed);
    return Vector2.sub(desired, vel).limit(maxForce);
  }

  /* ── PATH FOLLOW ────────────────────────────────────────────
   * Project future pos onto path; seek if off-path.
   */
  static pathFollow(pos, vel, pathPoints, pathRadius, maxSpeed, maxForce) {
    if (pathPoints.length < 2) return Vector2.zero();

    // Predict future position
    const speed = vel.mag();
    const lookAhead = speed > 0 ? 25 : 0;
    const future = Vector2.add(pos, vel.copy().setMag(lookAhead));

    let bestTarget = null;
    let bestDist   = Infinity;

    for (let i = 0; i < pathPoints.length; i++) {
      const a = pathPoints[i];
      const b = pathPoints[(i + 1) % pathPoints.length];

      const ab   = Vector2.sub(b, a);
      const af   = Vector2.sub(future, a);
      const abLen = ab.mag();
      if (abLen === 0) continue;

      let t = af.dot(ab) / (abLen * abLen);
      t = Math.max(0, Math.min(1, t));

      const proj = Vector2.add(a, ab.copy().mul(t));
      const d    = Vector2.dist(future, proj);

      if (d < bestDist) {
        bestDist   = d;
        // Target slightly ahead on the segment
        const ahead = Math.min(t + 30 / abLen, 1);
        bestTarget = Vector2.add(a, ab.copy().mul(ahead));
      }
    }

    if (bestTarget && bestDist > pathRadius) {
      return SteeringBehaviors.seek(pos, vel, bestTarget, maxSpeed, maxForce);
    }
    return Vector2.zero();
  }

  /* ── OBSTACLE AVOID ────────────────────────────────────────
   * Cast 6 rays at [-70,-42,-14,14,42,70] degrees.
   * obstacles: array of {x,y,r}
   */
  static obstacleAvoid(pos, vel, obstacles, sensorLength, maxSpeed, maxForce) {
    const heading  = vel.heading();
    const angles   = [-70, -42, -14, 14, 42, 70].map(d => d * Math.PI / 180);
    let   bestForce = Vector2.zero();
    let   minDist   = Infinity;
    let   hit       = false;

    for (const angle of angles) {
      const rayDir = Vector2.fromAngle(heading + angle);
      const rayEnd = Vector2.add(pos, rayDir.copy().mul(sensorLength));

      for (const obs of obstacles) {
        // Closest point on ray to obstacle center
        const toObs = Vector2.sub(obs, pos);
        const proj  = toObs.dot(rayDir);
        if (proj < 0 || proj > sensorLength) continue;

        const closest = Vector2.add(pos, rayDir.copy().mul(proj));
        const dist    = Vector2.dist(closest, obs);

        if (dist < obs.r + 6) {
          const weight = 1 - proj / sensorLength; // closer → stronger
          if (proj < minDist) {
            minDist = proj;
            hit     = true;
            // Steer away from obstacle
            const away = Vector2.sub(pos, obs).normalize().mul(maxSpeed);
            bestForce  = Vector2.sub(away, vel).limit(maxForce * weight * 2);
          }
        }
      }
    }

    return hit ? bestForce : Vector2.zero();
  }

  /* ── WANDER ────────────────────────────────────────────────
   * Random steering using circle-in-front trick.
   * state: {wanderAngle}
   */
  static wander(pos, vel, state, maxSpeed, maxForce) {
    const WANDER_DIST   = 60;
    const WANDER_RADIUS = 30;
    const WANDER_DELTA  = 0.3;

    state.wanderAngle = (state.wanderAngle || 0) + (Math.random() - 0.5) * WANDER_DELTA;

    const heading    = vel.mag() > 0 ? vel.heading() : 0;
    const circlePos  = Vector2.add(pos, Vector2.fromAngle(heading).mul(WANDER_DIST));
    const wanderForce = Vector2.fromAngle(state.wanderAngle + heading).mul(WANDER_RADIUS);
    const target     = Vector2.add(circlePos, wanderForce);

    return SteeringBehaviors.seek(pos, vel, target, maxSpeed, maxForce);
  }

  /* ── SEPARATE ──────────────────────────────────────────────
   * Steer away from nearby boids within desiredDist.
   */
  static separate(pos, vel, others, desiredDist, maxSpeed, maxForce) {
    const sum = Vector2.zero();
    let count = 0;

    for (const other of others) {
      const d = Vector2.dist(pos, other.pos || other);
      if (d > 0 && d < desiredDist) {
        const diff = Vector2.sub(pos, other.pos || other).normalize().div(d);
        sum.add(diff);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count).setMag(maxSpeed);
      return Vector2.sub(sum, vel).limit(maxForce);
    }
    return Vector2.zero();
  }

  /* ── ALIGN ──────────────────────────────────────────────────
   * Match velocity of neighbors.
   */
  static align(pos, vel, others, perceptionRadius, maxSpeed, maxForce) {
    const sum = Vector2.zero();
    let count = 0;

    for (const other of others) {
      const d = Vector2.dist(pos, other.pos || other);
      if (d > 0 && d < perceptionRadius) {
        sum.add(other.vel || Vector2.zero());
        count++;
      }
    }

    if (count > 0) {
      sum.div(count).setMag(maxSpeed);
      return Vector2.sub(sum, vel).limit(maxForce);
    }
    return Vector2.zero();
  }

  /* ── COHESION ───────────────────────────────────────────────
   * Steer toward center of neighbors.
   */
  static cohesion(pos, vel, others, perceptionRadius, maxSpeed, maxForce) {
    const sum = Vector2.zero();
    let count = 0;

    for (const other of others) {
      const d = Vector2.dist(pos, other.pos || other);
      if (d > 0 && d < perceptionRadius) {
        sum.add(other.pos || other);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return SteeringBehaviors.seek(pos, vel, sum, maxSpeed, maxForce);
    }
    return Vector2.zero();
  }

  /* ── BOUNDARIES ─────────────────────────────────────────────
   * Reflect at canvas edges (wrap-around alternative: steer toward center).
   */
  static boundaries(pos, vel, w, h, margin, maxSpeed, maxForce) {
    let desired = null;

    if      (pos.x < margin)     desired = new Vector2(maxSpeed, vel.y);
    else if (pos.x > w - margin) desired = new Vector2(-maxSpeed, vel.y);

    if      (pos.y < margin)     desired = desired ? desired.add(new Vector2(vel.x, maxSpeed)) : new Vector2(vel.x, maxSpeed);
    else if (pos.y > h - margin) desired = desired ? desired.add(new Vector2(vel.x, -maxSpeed)) : new Vector2(vel.x, -maxSpeed);

    if (desired) return Vector2.sub(desired, vel).limit(maxForce);
    return Vector2.zero();
  }

  /* ── Utility: weighted force accumulator ───────────────────── */
  static accumulate(forces) {
    const acc = Vector2.zero();
    for (const [force, weight] of forces) {
      acc.add(force.copy().mul(weight));
    }
    return acc;
  }
}
