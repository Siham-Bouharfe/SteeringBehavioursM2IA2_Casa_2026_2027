// Gestion de scène : aucun calcul de steering ou de locomotion ici.
const SeekPopulation = (() => {
  const MIN_COUNT = 1;
  const MAX_COUNT = 200;
  const INITIAL_COUNT = 20;
  const ARRIVAL_RADIUS = 16;
  function distanceSquared(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  }

  function targetList(targets) {
    return Array.isArray(targets) ? targets : [targets];
  }

  function targetPosition(target) {
    return target.pos ?? target;
  }

  function targetRadius(target) {
    return Number.isFinite(target.r) ? target.r : 0;
  }

  function hasArrived(vehicle, targets) {
    return targetList(targets).some(target => {
      const contactDistance = targetRadius(target) + vehicle.r;
      return distanceSquared(vehicle.pos, targetPosition(target)) <= contactDistance ** 2;
    });
  }

  function nearestTarget(vehicle, targets) {
    return targetList(targets).reduce((nearest, candidate) =>
      distanceSquared(vehicle.pos, targetPosition(candidate)) <
        distanceSquared(vehicle.pos, targetPosition(nearest)) ? candidate : nearest);
  }

  function isOutsideTargetZones(point, targets, vehicleRadius) {
    return targets.every(target => {
      const minimumDistance = targetRadius(target) + vehicleRadius + 4;
      return distanceSquared(point, targetPosition(target)) > minimumDistance ** 2;
    });
  }

  // null signifie qu'aucune position ne respecte la zone d'exclusion.
  function spawnPosition(target, w, h, vehicleRadius, rng = Math.random) {
    const marginX = w >= vehicleRadius * 2 ? vehicleRadius : 0;
    const marginY = h >= vehicleRadius * 2 ? vehicleRadius : 0;
    const bounds = { left: marginX, right: w - marginX, top: marginY, bottom: h - marginY };
    const targetEntries = targetList(target);
    for (let attempt = 0; attempt < 32; attempt++) {
      const point = {
        x: bounds.left + rng() * (bounds.right - bounds.left),
        y: bounds.top + rng() * (bounds.bottom - bounds.top),
      };
      if (isOutsideTargetZones(point, targetEntries, vehicleRadius)) return point;
    }
    const corner = farthestCorner(targetEntries, bounds);
    if (isOutsideTargetZones(corner, targetEntries, vehicleRadius)) return corner;
    const fallback = farthestCorner(targetEntries, { left: 0, right: w, top: 0, bottom: h });
    return isOutsideTargetZones(fallback, targetEntries, vehicleRadius) ? fallback : null;
  }

  function farthestCorner(targets, bounds) {
    const targetEntries = targetList(targets);
    const corners = [
      { x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.top },
      { x: bounds.left, y: bounds.bottom }, { x: bounds.right, y: bounds.bottom },
    ];
    const clearance = point => Math.min(...targetEntries.map(target =>
      distanceSquared(point, targetPosition(target))));
    return corners.reduce((best, point) => clearance(point) > clearance(best) ? point : best);
  }

  function resize(vehicles, count, target, w, h, createVehicle, rng = Math.random) {
    if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
      throw new RangeError('Le nombre de véhicules doit être un entier entre 1 et 200.');
    }
    if (count < vehicles.length) vehicles.length = count;
    while (vehicles.length < count) {
      const vehicle = createVehicle(0, 0);
      const point = spawnPosition(target, w, h, vehicle.r, rng)
        ?? farthestCorner(target, { left: 0, right: w, top: 0, bottom: h });
      vehicle.pos.set(point.x, point.y);
      vehicles.push(vehicle);
    }
  }

  function respawn(vehicle, target, w, h, rng = Math.random) {
    const point = spawnPosition(target, w, h, vehicle.r, rng);
    if (!point) return false;
    vehicle.pos.set(point.x, point.y);
    vehicle.vel.set(0, 0);
    vehicle.acc.set(0, 0);
    return true;
  }

  function ensureTargetCount(targets, count, createTarget) {
    while (targets.length < count) targets.push(createTarget(targets.length));
  }

  function step(vehicle, target, w, h, rng = Math.random, onArrival = null) {
    if (hasArrived(vehicle, target)) {
      if (onArrival?.(vehicle)) return;
      respawn(vehicle, target, w, h, rng);
      return;
    }
    const objective = nearestTarget(vehicle, target);
    vehicle.applyBehaviors(targetPosition(objective));
    vehicle.update();
    vehicle.edges();
    if (hasArrived(vehicle, target)) {
      if (onArrival?.(vehicle)) return;
      respawn(vehicle, target, w, h, rng);
    }
  }

  function bindSlider(slider, output, vehicles, target, dimensions, createVehicle, rng = Math.random) {
    const synchronize = () => {
      const { width: w, height: h } = dimensions();
      resize(vehicles, Number(slider.value), target, w, h, createVehicle, rng);
      output.value = `${vehicles.length} / ${MAX_COUNT}`;
    };
    slider.addEventListener('input', synchronize);
    synchronize();
  }

  return { MIN_COUNT, MAX_COUNT, INITIAL_COUNT, ARRIVAL_RADIUS,
    hasArrived, spawnPosition, resize, respawn, ensureTargetCount, step, bindSlider };
})();
