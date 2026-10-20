// Circuits stylisés inspirés de tracés de F1. Coordonnées normalisées [0..1].
const TRACK_PRESETS = {
  monaco: {
    label: 'Monaco · virages serrés',
    points: [
      [.14,.30],[.20,.19],[.34,.16],[.48,.20],[.57,.29],[.73,.23],[.86,.27],
      [.88,.39],[.77,.44],[.72,.54],[.84,.62],[.78,.75],[.62,.72],[.53,.64],
      [.41,.77],[.25,.70],[.20,.58],[.29,.49],[.17,.43],[.12,.36]
    ],
  },
  singapore: {
    label: 'Singapour · urbain et sinueux',
    points: [
      [.13,.34],[.20,.22],[.34,.20],[.40,.32],[.52,.21],[.70,.19],[.85,.30],
      [.80,.42],[.68,.40],[.61,.51],[.77,.60],[.82,.74],[.65,.77],[.54,.67],
      [.39,.78],[.27,.67],[.34,.54],[.21,.50],[.13,.62],[.10,.47]
    ],
  },
  abuDhabi: {
    label: 'Abu Dhabi · longues courbes',
    points: [
      [.13,.38],[.21,.25],[.39,.19],[.58,.21],[.76,.19],[.88,.31],[.83,.43],
      [.70,.40],[.59,.43],[.51,.55],[.62,.68],[.80,.69],[.85,.80],[.68,.83],
      [.49,.77],[.34,.82],[.20,.71],[.13,.56]
    ],
  },
};

function createPresetCenterline(trackId, canvasWidth, canvasHeight, samplesPerSegment = 5) {
  const preset = TRACK_PRESETS[trackId];
  if (!preset) throw new Error(`Circuit inconnu : ${trackId}`);
  const points = preset.points;
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    for (let step = 0; step < samplesPerSegment; step++) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const interpolate = axis => 0.5 * (
        2 * p1[axis] + (-p0[axis] + p2[axis]) * t +
        (2*p0[axis] - 5*p1[axis] + 4*p2[axis] - p3[axis]) * t2 +
        (-p0[axis] + 3*p1[axis] - 3*p2[axis] + p3[axis]) * t3
      );
      result.push({ x: interpolate(0) * canvasWidth, y: interpolate(1) * canvasHeight });
    }
  }
  return result;
}

if (typeof window !== 'undefined') window.TRACK_PRESETS = TRACK_PRESETS;
