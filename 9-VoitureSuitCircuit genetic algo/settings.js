// Paramètres partagés par l'interface, le circuit et les véhicules.
const DEFAULT_CONFIG = Object.freeze({
  sensorRange: 50,
  sensorCount: 7,
  sensorAngle: 90,
  maxSpeed: 5,
  trackWidth: 60,
  hiddenNeurons: 12,
});

let ACTIVE_CONFIG = { ...DEFAULT_CONFIG };

function sensorAngles(count, fieldOfView) {
  const safeCount = Math.max(1, Math.floor(Number(count)));
  const angle = Math.max(0, Number(fieldOfView));
  if (safeCount === 1) return [0];
  return Array.from({ length: safeCount }, (_, index) =>
    -angle / 2 + (angle * index) / (safeCount - 1));
}

if (typeof window !== 'undefined') window.sensorAngles = sensorAngles;
