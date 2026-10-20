const GameRules = (() => {
  function movementAxes(keys) {
    const has = value => keys instanceof Set ? keys.has(value) : Boolean(keys && keys[value]);
    return {
      x: Number(has('d') || has('>') || has('arrowright')) - Number(has('a') || has('q') || has('arrowleft')),
      y: Number(has('s') || has('arrowdown')) - Number(has('w') || has('z') || has('arrowup')),
    };
  }

  function playerDriveIntent(heading, axes, dt, maxSpeed) {
    if (!Number.isFinite(heading) || !Number.isFinite(dt) || dt < 0 ||
        !Number.isFinite(maxSpeed) || maxSpeed < 0 ||
        !axes || !Number.isFinite(axes.x) || !Number.isFinite(axes.y)) {
      throw new TypeError('Commandes de déplacement invalides.');
    }
    const turn = Math.max(-1, Math.min(1, axes.x));
    const direction = Math.max(-1, Math.min(1, -axes.y));
    const facingHeading = heading + turn * 0.065 * dt;
    const signedSpeed = direction * maxSpeed * (direction < 0 ? 0.65 : 1);
    return {
      heading: facingHeading,
      direction,
      desiredVelocity: {
        x: signedSpeed === 0 ? 0 : Math.cos(facingHeading) * signedSpeed,
        y: signedSpeed === 0 ? 0 : Math.sin(facingHeading) * signedSpeed,
      },
    };
  }

  function normalizeMovementKey(key, code) {
    const keyByCode = {
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift',
    };
    if (keyByCode[code]) return keyByCode[code];
    return String(key || '').toLowerCase();
  }

  function worldToMinimap(position, worldWidth, worldHeight, mapWidth, mapHeight) {
    if (!position || ![position.x, position.y, worldWidth, worldHeight, mapWidth, mapHeight].every(Number.isFinite) ||
        worldWidth <= 0 || worldHeight <= 0 || mapWidth <= 0 || mapHeight <= 0) return null;
    const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight);
    return {
      x: (mapWidth - worldWidth * scale) / 2 + position.x * scale,
      y: (mapHeight - worldHeight * scale) / 2 + position.y * scale,
      scale,
    };
  }

  function remainingCooldown(seconds, elapsedSeconds) {
    if (!Number.isFinite(seconds) || !Number.isFinite(elapsedSeconds)) return 0;
    return Math.max(0, seconds - Math.max(0, elapsedSeconds));
  }

  function keepUnexpiredEffects(effects, now) {
    if (!Array.isArray(effects) || !Number.isFinite(now)) return [];
    return effects.filter(effect => effect && Number.isFinite(effect.expiresAt) && effect.expiresAt > now);
  }

  function threatWeight(distance, radius) {
    if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0 || distance >= radius) return 0;
    return Math.max(0, Math.min(1, 1 - distance / radius));
  }

  function composeSteering(components, maxForce) {
    const result = { x: 0, y: 0 };
    for (const { force, weight } of components) {
      if (!force || !Number.isFinite(weight)) continue;
      const magnitude = Math.hypot(force.x, force.y);
      const scale = magnitude > maxForce && magnitude > 0 ? maxForce / magnitude : 1;
      result.x += force.x * scale * weight;
      result.y += force.y * scale * weight;
    }
    const magnitude = Math.hypot(result.x, result.y);
    if (magnitude > maxForce && magnitude > 0) {
      result.x = result.x / magnitude * maxForce;
      result.y = result.y / magnitude * maxForce;
    }
    return result;
  }

  function predictiveFleeForce(position, velocity, threatPosition, threatVelocity, maxSpeed, maxForce, predictionFrames) {
    const dx = position.x - (threatPosition.x + threatVelocity.x * predictionFrames);
    const dy = position.y - (threatPosition.y + threatVelocity.y * predictionFrames);
    const distance = Math.hypot(dx, dy);
    const directionX = distance === 0 ? 1 : dx / distance;
    const directionY = distance === 0 ? 0 : dy / distance;
    let forceX = directionX * maxSpeed - velocity.x;
    let forceY = directionY * maxSpeed - velocity.y;
    const magnitude = Math.hypot(forceX, forceY);
    if (magnitude > maxForce && magnitude > 0) {
      forceX = forceX / magnitude * maxForce;
      forceY = forceY / magnitude * maxForce;
    }
    return { x: forceX, y: forceY };
  }

  function nearestThreat(agent, threats, radius) {
    let nearest = null;
    let minDistance = radius;
    for (const threat of threats) {
      const distance = Math.hypot(agent.x - threat.x, agent.y - threat.y);
      if (distance < minDistance) {
        nearest = threat;
        minDistance = distance;
      }
    }
    return nearest;
  }

  function segmentProjectionAmount(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return 0;
    return Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  }

  function screenPointToGround(screenX, screenY, width, height, elevation, distance, fieldOfView) {
    const tangent = Math.tan(fieldOfView / 2);
    const aspect = width / Math.max(1, height);
    const nx = (screenX - width / 2) / (height / 2);
    const ny = (height / 2 - screenY) / (height / 2);
    // Avec l'axe z vertical et la caméra au bord sud du quartier, la base droite de la caméra pointe vers -X.
    const rayX = -nx * aspect * tangent;
    const rayY = -Math.cos(elevation) - Math.sin(elevation) * ny * tangent;
    const rayZ = -Math.sin(elevation) + Math.cos(elevation) * ny * tangent;
    if (rayZ >= -0.01) return { x: width / 2, y: height / 2 };
    const eyeY = distance * Math.cos(elevation);
    const eyeZ = distance * Math.sin(elevation);
    const alongRay = -eyeZ / rayZ;
    return {
      x: width / 2 + rayX * alongRay,
      y: height / 2 + eyeY + rayY * alongRay,
    };
  }

  function waveOutcome(nextWave, finalWave, remainingCats) {
    if (remainingCats <= 0) return 'defeat';
    if (nextWave > finalWave) return 'victory';
    return null;
  }

  const campaignMissions = Object.freeze([
    { type: 'rescue', target: 2, title: '01 · Repérage — évacue 2 habitants' },
    { type: 'survive', target: 38, title: '02 · Planque — échappe aux drones' },
    { type: 'rescue', target: 4, title: '03 · Recherche — évacue 4 habitants' },
    { type: 'survive', target: 38, title: '04 · Course-poursuite — tiens bon' },
    { type: 'rescue', target: 8, title: '05 · Extraction — sauve 8 habitants' },
  ]);

  const rescueContractQuotas = Object.freeze([3, 4, 5]);

  function rescueQuota(contractLevel) {
    if (!Number.isInteger(contractLevel) || contractLevel < 1) return rescueContractQuotas[0];
    return rescueContractQuotas[Math.min(contractLevel, rescueContractQuotas.length) - 1];
  }

  function canDeliverRescueGroup(distance, zoneRadius, playerRadius, followerCount, quota) {
    return [distance, zoneRadius, playerRadius, followerCount, quota].every(Number.isFinite) &&
      distance <= zoneRadius + playerRadius && followerCount >= quota && quota > 0;
  }

  function rescueContractReward(contractLevel, rescuedCount) {
    if (!Number.isInteger(contractLevel) || contractLevel < 1 ||
        !Number.isInteger(rescuedCount) || rescuedCount < 0) return 0;
    return 100 + Math.min(contractLevel, rescueContractQuotas.length) * 40 + rescuedCount * 15;
  }

  function missionForContract(contractNumber) {
    if (!Number.isInteger(contractNumber) || contractNumber < 1 || contractNumber > campaignMissions.length) return null;
    return { ...campaignMissions[contractNumber - 1] };
  }

  function canCollectRescueGroup(distance, playerRadius, groupRadius) {
    return Number.isFinite(distance) && Number.isFinite(playerRadius) && Number.isFinite(groupRadius) &&
      distance <= playerRadius + groupRadius;
  }

  function canCompleteEvacuation(delivered, target) {
    return Number.isFinite(delivered) && Number.isFinite(target) && target > 0 && delivered >= target;
  }

  function createGenome(random = Math.random) {
    return {
      speedFactor: 0.9 + random() * 0.18,
      predictionFrames: 8 + random() * 4,
      sensorLength: 82 + random() * 40,
      brainWeights: Array.from({ length: 16 }, () => (random() * 2 - 1) * 0.6),
    };
  }

  function mutateGenome(parent, random = Math.random) {
    const vary = (value, amount, min, max) =>
      Math.max(min, Math.min(max, value + (random() * 2 - 1) * amount));
    return {
      speedFactor: vary(parent.speedFactor, 0.12, 0.82, 1.28),
      predictionFrames: vary(parent.predictionFrames, 2, 5, 16),
      sensorLength: vary(parent.sensorLength, 18, 65, 155),
      brainWeights: parent.brainWeights.map(weight => vary(weight, 0.22, -1.5, 1.5)),
    };
  }

  function evaluateBrain(genome, inputs) {
    const weights = genome.brainWeights;
    const hidden = [0, 1, 2].map(node => Math.tanh(
      weights[9 + node] + inputs.reduce((sum, input, index) => sum + input * weights[index * 3 + node], 0)
    ));
    const activation = weights[15] + hidden.reduce((sum, value, index) => sum + value * weights[12 + index], 0);
    return 1 / (1 + Math.exp(-activation));
  }

  return Object.freeze({
    movementAxes,
    playerDriveIntent,
    normalizeMovementKey,
    worldToMinimap,
    remainingCooldown,
    keepUnexpiredEffects,
    threatWeight,
    composeSteering,
    predictiveFleeForce,
    nearestThreat,
    segmentProjectionAmount,
    screenPointToGround,
    waveOutcome,
    missionForContract,
    rescueQuota,
    canDeliverRescueGroup,
    rescueContractReward,
    canCollectRescueGroup,
    canCompleteEvacuation,
    createGenome,
    mutateGenome,
    evaluateBrain,
  });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GameRules;
