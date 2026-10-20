// Détecte les contacts cercle-cercle et retire les cibles impliquées.
const TargetCollisions = (() => {
  function resolve(targets) {
    const collisions = [];
    const removed = new Set();
    for (let first = 0; first < targets.length; first++) {
      for (let second = first + 1; second < targets.length; second++) {
        const a = targets[first];
        const b = targets[second];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const contactDistance = a.r + b.r;
        if (dx * dx + dy * dy <= contactDistance * contactDistance) {
          collisions.push({
            x: (a.pos.x + b.pos.x) / 2,
            y: (a.pos.y + b.pos.y) / 2,
            first: a,
            second: b,
          });
          removed.add(a);
          removed.add(b);
        }
      }
    }
    if (removed.size) {
      for (let index = targets.length - 1; index >= 0; index--) {
        if (removed.has(targets[index])) targets.splice(index, 1);
      }
    }
    return collisions;
  }

  function resolveVehicleContact(vehicle, targets) {
    const index = targets.findIndex(target => {
      const dx = target.pos.x - vehicle.pos.x;
      const dy = target.pos.y - vehicle.pos.y;
      const contactDistance = vehicle.r + target.r;
      return dx * dx + dy * dy <= contactDistance * contactDistance;
    });
    if (index < 0) return null;
    const [target] = targets.splice(index, 1);
    return { x: target.pos.x, y: target.pos.y, target };
  }

  return { resolve, resolveVehicleContact };
})();

if (typeof module !== 'undefined') module.exports = { TargetCollisions };
