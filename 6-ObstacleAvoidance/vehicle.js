/*
  Calcule la projection orthogonale du point a sur le vecteur b
  a et b sont des vecteurs calculés comme ceci :
  let v1 = p5.Vector.sub(a, pos); soit v1 = pos -> a
  let v2 = p5.Vector.sub(b, pos); soit v2 = pos -> b
  */
function findProjection(pos, a, b) {
  let v1 = p5.Vector.sub(a, pos);
  let v2 = p5.Vector.sub(b, pos);
  v2.normalize();
  let sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return v2;
}

class Vehicle {
  static debug = false;

  constructor(x, y) {
    // position du véhicule
    this.pos = createVector(x, y);
    // vitesse du véhicule
    this.vel = createVector(0, 0);
    // accélération du véhicule
    this.acc = createVector(0, 0);
    // vitesse maximale du véhicule
    this.maxSpeed = 4;
    // force maximale appliquée au véhicule
    this.maxForce = 0.2;
    this.color = "#77879a";
    // à peu près en secondes
    this.dureeDeVie = 5;

    this.r_pourDessin = 16;
    // rayon du véhicule pour l'évitement
    this.r = this.r_pourDessin * 3;

    // Pour évitement d'obstacle
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;
    this.sensorAngles = [-70, -42, -14, 14, 42, 70];
    this.sensorLength = 95;
    this.avoidanceSide = 0;
    this.avoidanceSideLock = 0;

    // chemin derrière vaisseaux
    this.path = [];
    this.pathMaxLength = 30;

   
  }

  // on fait une méthode applyBehaviors qui applique les comportements
  // seek et avoid
  applyBehaviors(target, obstacles, cats = []) {
    let seekForce = this.arrive(target);
    this.targetDirection = p5.Vector.sub(target, this.pos).normalize();
    const heading = this.vel.magSq() > 0.05
      ? this.vel.copy().normalize()
      : this.targetDirection.copy();
    let avoidForce = this.avoid(obstacles, heading, target);
    let boundariesForce = this.boundariesOld();

    if (avoidForce.magSq() === 0) {
      let closestCat = null;
      let closestCatDistance = Infinity;
      for (const cat of cats) {
        if (cat === this) continue;
        const distance = p5.Vector.dist(this.pos, cat.pos);
        if (distance < closestCatDistance) {
          closestCat = cat;
          closestCatDistance = distance;
        }
      }
      if (closestCat && closestCatDistance < this.r_pourDessin * 3) {
        const separationForce = p5.Vector.sub(this.pos, closestCat.pos);
        if (separationForce.magSq() > 0) {
          separationForce.setMag(this.maxForce * 4);
          this.applyForce(separationForce);
        }
        this.applyForce(boundariesForce.mult(2));
        return;
      }
    }

    seekForce.mult(0.8);
    avoidForce.mult(2.2);
    boundariesForce.mult(2);

    this.applyForce(seekForce);
    this.applyForce(avoidForce);
    this.applyForce(boundariesForce);
  }

  applyFlockBehaviors(leader, cats, obstacles, cohesionWeight) {
    const target = leader.pos.copy();
    if (leader.vel.magSq() > 0.05) {
      target.add(leader.vel.copy().setMag(48));
    }

    this.targetDirection = p5.Vector.sub(target, this.pos).normalize();
    const detourTarget = this.getDetourTarget(target, obstacles);
    const boundariesForce = this.boundariesOld();
    if (detourTarget) {
      const detourForce = this.arrive(detourTarget);
      const separationForce = this.separation(cats, 58);
      detourForce.mult(4);
      separationForce.mult(1.5);
      boundariesForce.mult(2);
      this.applyForce(detourForce);
      this.applyForce(separationForce);
      this.applyForce(boundariesForce);
      return;
    }

    const heading = this.vel.magSq() > 0.05
      ? this.vel.copy().normalize()
      : this.targetDirection.copy();
    const followForce = this.arrive(target);
    const alignmentForce = this.alignment(cats, 145);
    const cohesionForce = this.cohesion(cats, 180);
    const separationForce = this.separation(cats, 58);
    const avoidForce = this.avoid(obstacles, heading, target, true);

    if (avoidForce.magSq() > 0) {
      avoidForce.mult(2.2);
      boundariesForce.mult(2);
      this.applyForce(avoidForce);
      this.applyForce(boundariesForce);
      return;
    }

    let closestCat = null;
    let closestCatDistance = Infinity;
    for (const cat of cats) {
      if (cat === this) continue;
      const distance = p5.Vector.dist(this.pos, cat.pos);
      if (distance < closestCatDistance) {
        closestCat = cat;
        closestCatDistance = distance;
      }
    }
    if (closestCat && closestCatDistance < this.r_pourDessin * 3) {
      const hardSeparation = p5.Vector.sub(this.pos, closestCat.pos);
      if (hardSeparation.magSq() > 0) {
        hardSeparation.setMag(this.maxForce * 4);
        this.applyForce(hardSeparation);
      }
      this.applyForce(boundariesForce.mult(2));
      return;
    }

    followForce.mult(0.45);
    alignmentForce.mult(0.55);
    cohesionForce.mult(cohesionWeight * 0.55);
    separationForce.mult(1.7);
    boundariesForce.mult(2);

    this.applyForce(followForce);
    this.applyForce(alignmentForce);
    this.applyForce(cohesionForce);
    this.applyForce(separationForce);
    this.applyForce(avoidForce);
    this.applyForce(boundariesForce);
  }

  getDetourTarget(target, obstacles) {
    const targetOffset = p5.Vector.sub(target, this.pos);
    const targetDistance = targetOffset.mag();
    if (targetDistance === 0) return null;

    const direction = targetOffset.div(targetDistance);
    let blockingObstacle = null;
    let blockingPosition = null;
    let nearestProjection = Infinity;
    let blockingDistance = 0;

    for (const obstacle of obstacles) {
      const offset = p5.Vector.sub(obstacle.pos, this.pos);
      const projection = offset.dot(direction);
      if (projection < 0 || projection > targetDistance || projection >= nearestProjection) continue;

      const perpendicularSquared = Math.max(0, offset.magSq() - projection * projection);
      const clearance = obstacle.r + this.r_pourDessin + 14;
      if (perpendicularSquared >= clearance * clearance) continue;

      blockingObstacle = obstacle;
      blockingPosition = obstacle.pos.copy();
      nearestProjection = projection;
      blockingDistance = clearance;
    }

    if (!blockingObstacle) return null;

    const lateral = createVector(-direction.y, direction.x);
    const currentSide = p5.Vector.sub(this.pos, blockingPosition).dot(lateral);
    if (this.avoidanceSideLock === 0) {
      this.avoidanceSide = Math.abs(currentSide) > 12
        ? Math.sign(currentSide)
        : this.flockSide || -1;
    }
    this.avoidanceSideLock = 30;

    return blockingPosition.copy()
      .add(direction.copy().mult(blockingDistance))
      .add(lateral.mult(this.avoidanceSide * blockingDistance));
  }

  alignment(cats, perceptionRadius) {
    const averageVelocity = createVector(0, 0);
    let neighbors = 0;

    for (const cat of cats) {
      if (cat === this || p5.Vector.dist(this.pos, cat.pos) >= perceptionRadius) continue;
      averageVelocity.add(cat.vel);
      neighbors++;
    }

    if (neighbors === 0) return createVector(0, 0);
    averageVelocity.div(neighbors);
    if (averageVelocity.magSq() === 0) return createVector(0, 0);
    averageVelocity.setMag(this.maxSpeed);
    return averageVelocity.sub(this.vel).limit(this.maxForce);
  }

  cohesion(cats, perceptionRadius) {
    const center = createVector(0, 0);
    let neighbors = 0;

    for (const cat of cats) {
      if (cat === this || p5.Vector.dist(this.pos, cat.pos) >= perceptionRadius) continue;
      center.add(cat.pos);
      neighbors++;
    }

    if (neighbors === 0) return createVector(0, 0);
    center.div(neighbors);
    return this.seek(center);
  }

  separation(cats, desiredDistance) {
    const steer = createVector(0, 0);
    let neighbors = 0;
    let closestOffset = null;
    let closestDistance = Infinity;

    for (const cat of cats) {
      if (cat === this) continue;
      const offset = p5.Vector.sub(this.pos, cat.pos);
      const distance = offset.mag();
      if (distance > 0 && distance < closestDistance) {
        closestDistance = distance;
        closestOffset = offset.copy();
      }
      if (distance === 0 || distance >= desiredDistance) continue;
      offset.normalize().div(distance);
      steer.add(offset);
      neighbors++;
    }

    if (neighbors === 0) return createVector(0, 0);
    if (steer.magSq() === 0 && closestOffset) steer.set(closestOffset);
    if (steer.magSq() === 0) return createVector(0, 0);
    steer.div(neighbors).setMag(this.maxSpeed).sub(this.vel);
    return steer.limit(this.maxForce);
  }

  avoid(obstacles, heading = this.vel.copy().normalize(), target = null, avoidSensorThreats = false) {
    const rayLength = this.sensorLength + this.vel.mag() * 4;
    const targetDirection = this.targetDirection || heading;
    const targetDistance = target ? p5.Vector.dist(this.pos, target) : rayLength;
    const targetPathBlocked = obstacles.some(obstacle => {
      const toObstacle = p5.Vector.sub(obstacle.pos, this.pos);
      const projection = toObstacle.dot(targetDirection);
      if (projection < 0 || projection > targetDistance) return false;
      const perpendicularDistance = Math.sqrt(Math.max(0, toObstacle.magSq() - projection * projection));
      return perpendicularDistance < obstacle.r + this.r_pourDessin + 12;
    });
    const sensors = this.sensorAngles.map(angle => {
      const radians = angle * Math.PI / 180;
      const direction = createVector(
        heading.x * Math.cos(radians) - heading.y * Math.sin(radians),
        heading.x * Math.sin(radians) + heading.y * Math.cos(radians)
      );
      let hitDistance = rayLength;
      let hitObstacle = null;

      for (const obstacle of obstacles) {
        const toObstacle = p5.Vector.sub(obstacle.pos, this.pos);
        const projection = toObstacle.dot(direction);
        if (projection < 0 || projection > rayLength) continue;

        const perpendicularSquared = toObstacle.magSq() - projection * projection;
        const combinedRadius = obstacle.r + this.r_pourDessin + 34;
        if (perpendicularSquared > combinedRadius * combinedRadius) continue;

        const intersection = Math.max(0, projection - Math.sqrt(
          combinedRadius * combinedRadius - perpendicularSquared
        ));
        if (intersection < hitDistance) {
          hitDistance = intersection;
          hitObstacle = obstacle;
        }
      }

      return { angle, direction, hitDistance, hitObstacle };
    });
    this.sensorReadings = sensors;

    if (this.isLeader) {
      noFill();
      stroke('#f1c56d');
      strokeWeight(2.5);
      arc(2, 5, 13, 12, 0.1, PI - 0.1);
    }

    if (Vehicle.debug) {
      for (const sensor of sensors) {
        const ray = sensor.direction.copy().mult(sensor.hitDistance);
        stroke(sensor.hitObstacle ? '#e65c5c' : '#65a889');
        strokeWeight(sensor.hitObstacle ? 2.5 : 1.5);
        line(this.pos.x, this.pos.y, this.pos.x + ray.x, this.pos.y + ray.y);
        if (sensor.hitObstacle) {
          noStroke();
          fill('#e65c5c');
          circle(this.pos.x + ray.x, this.pos.y + ray.y, 7);
        }
      }
    }

    const threats = sensors.filter(sensor =>
      sensor.hitObstacle && sensor.hitDistance < rayLength * 0.9);
    const hasThreat = threats.length > 0 && (avoidSensorThreats || targetPathBlocked);
    if (!hasThreat) {
      this.avoidanceSideLock = Math.max(0, this.avoidanceSideLock - 1);
      if (this.avoidanceSideLock === 0) this.avoidanceSide = 0;
      return createVector(0, 0);
    }
    this.avoidanceSideLock = 30;

    const candidate = sensors.reduce((best, sensor) => {
      const alignment = sensor.direction.dot(targetDirection);
      const clearance = sensor.hitDistance / rayLength;
      const side = Math.sign(Math.sin(sensor.angle * Math.PI / 180));
      const sidePreference = side === this.avoidanceSide ? 0.3 : 0;
      const blockedPenalty = sensor.hitObstacle && sensor.hitDistance < rayLength * 0.75 ? 1.2 : 0;
      const utility = alignment * 0.65 + clearance * 0.9 + sidePreference - blockedPenalty;
      return utility > best.utility ? { sensor, utility } : best;
    }, { sensor: sensors[0], utility: -Infinity }).sensor;
    const chosenSide = Math.sign(Math.sin(candidate.angle * Math.PI / 180));
    const nearestThreatSensor = threats.reduce((nearest, sensor) =>
      sensor.hitDistance < nearest.hitDistance ? sensor : nearest);
    const threatObstacle = nearestThreatSensor.hitObstacle;
    const obstacleOffset = p5.Vector.sub(threatObstacle.pos, this.pos);
    const obstacleSide = heading.x * obstacleOffset.y - heading.y * obstacleOffset.x;
    if (!this.avoidanceSide) {
      const currentSide = targetDirection.x * (this.pos.y - threatObstacle.pos.y) -
        targetDirection.y * (this.pos.x - threatObstacle.pos.x);
      this.avoidanceSide = Math.abs(obstacleSide) > 12
        ? -Math.sign(obstacleSide)
        : Math.abs(currentSide) > 1 ? Math.sign(currentSide) : chosenSide || -1;
    }

    const nearestThreat = nearestThreatSensor.hitDistance;
    const intensity = Math.max(0.15, 1 - nearestThreat / (rayLength * 1.2));
    const lateral = createVector(-targetDirection.y, targetDirection.x)
      .mult(this.avoidanceSide * this.maxSpeed * intensity * 1.4);
    const desired = avoidSensorThreats
      ? lateral.copy().setMag(this.maxSpeed)
      : targetDirection.copy().mult(this.maxSpeed).add(lateral).setMag(this.maxSpeed);
    const steeringLimit = this.maxForce * (avoidSensorThreats ? 2 : 1);
    return desired.sub(this.vel).limit(steeringLimit);
  }

  avoidCorrige(obstacles) {
    // calcul d'un vecteur ahead devant le véhicule
    // il regarde par exemple 50 frames devant lui
    let ahead = this.vel.copy();
    ahead.mult(30);
    //on calcue ahead2 deux fois plus petit
    let ahead2 = ahead.copy();
    ahead2.mult(0.5);

    // on le dessine avec ma méthode this.drawVector(pos vecteur, color)
    this.drawVector(this.pos, ahead, "yellow");

    // Calcul des coordonnées du point au bout de ahead
    let pointAuBoutDeAhead = this.pos.copy().add(ahead);
    let pointAuBoutDeAhead2 = this.pos.copy().add(ahead2);

    // Detection de l'obstacle le plus proche
    let obstacleLePlusProche = this.getObstacleLePlusProche(obstacles);

    // Si pas d'obstacle, on renvoie un vecteur nul
    if (obstacleLePlusProche == undefined) {
      return createVector(0, 0);
    }

    // On calcule la distance entre le cercle et le bout du vecteur ahead
    let distance1 = pointAuBoutDeAhead.dist(obstacleLePlusProche.pos);
    let distance2 = pointAuBoutDeAhead2.dist(obstacleLePlusProche.pos);
    let distance = min(distance1, distance2);


    // On dessine le point au bout du vecteur ahead pour debugger
    fill("red");
    circle(pointAuBoutDeAhead.x, pointAuBoutDeAhead.y, 10);
    fill("blue");
    circle(pointAuBoutDeAhead2.x, pointAuBoutDeAhead2.y, 10);

    // On dessine la zone d'évitement
    // Pour cela on trace une ligne large qui va de la position du vaisseau
    // jusqu'au point au bout de ahead
    stroke(100, 100);
    strokeWeight(this.largeurZoneEvitementDevantVaisseau);
    line(this.pos.x, this.pos.y, pointAuBoutDeAhead.x, pointAuBoutDeAhead.y);

    // si la distance est < rayon de l'obstacle
    // il y a collision possible et on dessine l'obstacle en rouge

    if (distance < obstacleLePlusProche.r + this.largeurZoneEvitementDevantVaisseau + this.r) {
      // collision possible 

      // calcul de la force d'évitement. C'est un vecteur qui va
      // du centre de l'obstacle vers le point au bout du vecteur ahead
      let force;
      if (distance1 < distance2) {
        force = p5.Vector.sub(pointAuBoutDeAhead, obstacleLePlusProche.pos);
      }
      else {
        force = p5.Vector.sub(pointAuBoutDeAhead2, obstacleLePlusProche.pos);
      }
      // on le dessine en jaune pour vérifier qu'il est ok (dans le bon sens etc)
      this.drawVector(obstacleLePlusProche.pos, force, "yellow");

      // Dessous c'est l'ETAPE 2 : le pilotage (comment on se dirige vers la cible)
      // on limite ce vecteur à la longueur maxSpeed
      // force est la vitesse désirée
      force.setMag(this.maxSpeed);
      // on calcule la force à appliquer pour atteindre la cible avec la formule
      // que vous commencez à connaitre : force = vitesse désirée - vitesse courante
      force.sub(this.vel);
      // on limite cette force à la longueur maxForce
      force.limit(this.maxForce);
      return force;
    } else {
      // pas de collision possible
      return createVector(0, 0);
    }
  }

  // Exerce une force renvoyant vers le centre du canvas si le véhicule s'approche
  // des bords du canvas
  boundariesOld() {
    const d = 25;

    let desired = null;

    // si le véhicule est trop à gauche ou trop à droite
    if (this.pos.x < d) {
      desired = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > width - d) {
      desired = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < d) {
      desired = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > height - d) {
      desired = createVector(this.vel.x, -this.maxSpeed);
    }

    if (desired !== null) {
      desired.normalize();
      desired.mult(this.maxSpeed);
      const steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce);
      return steer;
    }
    return createVector(0, 0);
  }

  // Permet de rester dans les limites d'une zone rectangulaire.
  // Lorsque le véhicule s'approche d'un bord vertical ou horizontal
  // on calcule la vitesse désirée dans la direction "réfléchie" par
  // rapport au bord (comme au billard).
  // Par exemple, si le véhicule s'approche du bord gauche à moins de 
  // 25 pixels (valeur par défaut de la variable d),
  // on calcule la vitesse désirée en gardant le x du vecteur vitesse
  // et en mettant son y positif. x vaut maxSpeed et y vaut avant une valeur
  // négative (puisque le véhicule va vers la gauche), on lui donne un y positif
  // ça c'est pour la direction à prendre (vitesse désirée). Une fois la direction
  // calculée on lui donne une norme égale à maxSpeed, puis on calcule la force
  // normalement : force = vitesseDesiree - vitesseActuelle
  // paramètres = un rectangle (bx, by, bw, bh) et une distance d
  boundaries(bx, by, bw, bh, d) {
    let vitesseDesiree = null;

    const xBordGauche = bx + d;
    const xBordDroite = bx + bw - d;
    const yBordHaut = by + d;
    const yBordBas = by + bh - d;

    // si le véhicule est trop à gauche ou trop à droite
    if (this.pos.x < xBordGauche) {
      // 
      vitesseDesiree = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > xBordDroite) {
      vitesseDesiree = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < yBordHaut) {
      vitesseDesiree = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > yBordBas) {
      vitesseDesiree = createVector(this.vel.x, -this.maxSpeed);
    }

    if (vitesseDesiree !== null) {
      vitesseDesiree.setMag(this.maxSpeed);
      const force = p5.Vector.sub(vitesseDesiree, this.vel);
      vitesseDesiree.limit(this.maxForce);
      return vitesseDesiree;
    }

    if (Vehicle.debug) {
      // dessin du cadre de la zone
      push();

      noFill();
      stroke("white");
      rect(bx, by, bw, bh);

      // et du rectangle intérieur avec une bordure rouge de d pixels
      stroke("red");
      rect(bx + d, by + d, bw - 2 * d, bh - 2 * d);

      pop();
    }

    // si on est pas près du bord (vitesse désirée nulle), on renvoie un vecteur nul
    return createVector(0, 0);
  }


  getObstacleLePlusProche(obstacles) {
    let plusPetiteDistance = 100000000;
    let obstacleLePlusProche = undefined;

    obstacles.forEach(o => {
      // Je calcule la distance entre le vaisseau et l'obstacle
      const distance = this.pos.dist(o.pos);

      if (distance < plusPetiteDistance) {
        plusPetiteDistance = distance;
        obstacleLePlusProche = o;
      }
    });

    return obstacleLePlusProche;
  }

  getVehiculeLePlusProche(vehicules) {
    let plusPetiteDistance = Infinity;
    let vehiculeLePlusProche = undefined;

    vehicules.forEach(v => {
      if (v != this) {
        // Je calcule la distance entre le vaisseau et le vehicule
        const distance = this.pos.dist(v.pos);
        if (distance < plusPetiteDistance) {
          plusPetiteDistance = distance;
          vehiculeLePlusProche = v;
        }
      }
    });

    return vehiculeLePlusProche;
  }


  getClosestObstacle(pos, obstacles) {
    // on parcourt les obstacles et on renvoie celui qui est le plus près du véhicule
    let closestObstacle = null;
    let closestDistance = 1000000000;
    for (let obstacle of obstacles) {
      let distance = pos.dist(obstacle.pos);
      if (closestObstacle == null || distance < closestDistance) {
        closestObstacle = obstacle;
        closestDistance = distance;
      }
    }
    return closestObstacle;
  }

  arrive(target) {
    // 2nd argument true enables the arrival behavior
    return this.seek(target, true);
  }

  seek(target, arrival = false) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      let slowRadius = 100;
      let distance = force.mag();
      if (distance < slowRadius) {
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }
    force.setMag(desiredSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  // inverse de seek !
  flee(target) {
    return this.seek(target).mult(-1);
  }

  /* Poursuite d'un point devant la target !
     cette methode renvoie la force à appliquer au véhicule
  */
  pursue(vehicle) {
    let target = vehicle.pos.copy();
    let prediction = vehicle.vel.copy();
    prediction.mult(10);
    target.add(prediction);
    fill(0, 255, 0);
    circle(target.x, target.y, 16);
    return this.seek(target);
  }

  evade(vehicle) {
    let pursuit = this.pursue(vehicle);
    pursuit.mult(-1);
    return pursuit;
  }

  // Comportement Separation : on garde ses distances par rapport aux voisins
  // ON ETUDIERA CE COMPORTEMENT PLUS TARD !
  separate(boids) {
    let desiredseparation = this.r;
    let steer = createVector(0, 0, 0);
    let count = 0;
    // On examine les autres boids pour voir s'ils sont trop près
    for (let i = 0; i < boids.length; i++) {
      let other = boids[i];
      let d = p5.Vector.dist(this.pos, other.pos);
      // Si la distance est supérieure à 0 et inférieure à une valeur arbitraire (0 quand on est soi-même)
      if (d > 0 && d < desiredseparation) {
        // Calculate vector pointing away from neighbor
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d); // poids en fonction de la distance. Plus le voisin est proche, plus le poids est grand
        steer.add(diff);
        count++; // On compte le nombre de voisins
      }
    }
    // On moyenne le vecteur steer en fonction du nombre de voisins
    if (count > 0) {
      steer.div(count);
    }

    // si la force de répulsion est supérieure à 0
    if (steer.mag() > 0) {
      // On implemente : Steering = Desired - Velocity
      steer.normalize();
      steer.mult(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce);
    }
    return steer;
  }

  // applyForce est une méthode qui permet d'appliquer une force au véhicule
  // en fait on additionne le vecteurr force au vecteur accélération
  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    // on ajoute l'accélération à la vitesse. L'accélération est un incrément de vitesse
    // (accélératiion = dérivée de la vitesse)
    this.vel.add(this.acc);
    // on contraint la vitesse à la valeur maxSpeed
    this.vel.limit(this.maxSpeed);
    // on ajoute la vitesse à la position. La vitesse est un incrément de position, 
    // (la vitesse est la dérivée de la position)
    this.pos.add(this.vel);

    // on remet l'accélération à zéro
    this.acc.set(0, 0);

    // mise à jour du path (la trainée derrière)
    this.ajoutePosAuPath();

    // durée de vie
    this.dureeDeVie -= 0.01;
  }

  ajoutePosAuPath() {
    // on rajoute la position courante dans le tableau
    this.path.push(this.pos.copy());

    // si le tableau a plus de 50 éléments, on vire le plus ancien
    if (this.path.length > this.pathMaxLength) {
      this.path.shift();
    }
  }

  // On dessine le véhicule, le chemin etc.
  show() {
    // dessin du chemin
    this.drawPath();
    // dessin du vehicule
    this.drawVehicle();
  }

  drawVehicle() {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.vel.magSq() > 0.05) rotate(this.vel.heading());

    noStroke();
    fill(this.color);
    ellipse(-2, 2, 31, 21);
    ellipse(10, -2, 20, 19);
    triangle(3, -8, 5, -20, 13, -9);
    triangle(13, -9, 21, -18, 21, -5);
    fill("#d98b91");
    triangle(6, -10, 7, -16, 11, -10);
    triangle(15, -10, 19, -15, 18, -8);
    fill("#fff4e6");
    circle(15, -3, 5);
    fill("#28313a");
    circle(16, -3, 2.4);
    fill("#f1c56d");
    triangle(21, 1, 25, 3, 21, 5);
    stroke("#f7e9d5");
    strokeWeight(1);
    line(20, 4, 27, 2);
    line(20, 5, 27, 7);
    noFill();
    stroke(this.color);
    strokeWeight(4);
    arc(-15, 1, 18, 18, PI * 0.8, PI * 1.8);

    if (Vehicle.debug) {
      stroke(255);
      noFill();
      circle(0, 0, this.r);
    }
    pop();
  }

  drawPath() {
    push();
    stroke(255);
    noFill();
    strokeWeight(1);

    fill(this.color);
    // dessin du chemin
    this.path.forEach((p, index) => {
      if (!(index % 5)) {

        circle(p.x, p.y, 1);
      }
    });
    pop();
  }
  drawVector(pos, v, color) {
    push();
    // Dessin du vecteur vitesse
    // Il part du centre du véhicule et va dans la direction du vecteur vitesse
    strokeWeight(3);
    stroke(color);
    line(pos.x, pos.y, pos.x + v.x, pos.y + v.y);
    // dessine une petite fleche au bout du vecteur vitesse
    let arrowSize = 5;
    translate(pos.x + v.x, pos.y + v.y);
    rotate(v.heading());
    translate(-arrowSize / 2, 0);
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    pop();
  }

  // que fait cette méthode ?
  edges() {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
}

class Target extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.vel = p5.Vector.random2D();
    this.vel.mult(5);
  }

  show() {
    push();
    stroke(255);
    strokeWeight(2);
    fill("#F063A4");
    push();
    translate(this.pos.x, this.pos.y);
    circle(0, 0, this.r * 2);
    pop();
    pop();
  }
}