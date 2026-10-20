const RACE_GRID_ROW_SPACING = 34;
const RACE_GRID_LANE_SPACING = 13;
const RACE_LOOKAHEAD_POINTS = 4.2;
const RACE_OFF_TRACK_GRACE = 150;
const RACE_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: 'Détente', playerSpeed: 2.65, opponentSpeed: 2.65, timeLimit: 85, offTrackGrace: 180 }),
  normal: Object.freeze({ label: 'Classique', playerSpeed: 3.0, opponentSpeed: 3.0, timeLimit: 62, offTrackGrace: 150 }),
  hard: Object.freeze({ label: 'Champion', playerSpeed: 3.28, opponentSpeed: 3.28, timeLimit: 48, offTrackGrace: 125 }),
});

function getRaceDifficulty(id) {
  return RACE_DIFFICULTIES[id] || RACE_DIFFICULTIES.normal;
}

function getRaceOutcome(progress, totalProgress, crashed, elapsed, timeLimit) {
  if (![progress, totalProgress, elapsed, timeLimit].every(Number.isFinite) || totalProgress <= 0 || timeLimit <= 0) {
    throw new TypeError('Données invalides pour déterminer le résultat de la course.');
  }
  if (crashed) return 'off-track';
  if (progress >= totalProgress) return 'finished';
  if (elapsed >= timeLimit) return 'timeout';
  return 'in-progress';
}

function wrapRaceIndex(index, pointCount) {
  return ((index % pointCount) + pointCount) % pointCount;
}

function sampleRacePath(points, progress) {
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(progress)) return null;
  const segment = Math.floor(progress);
  const amount = progress - segment;
  const start = points[wrapRaceIndex(segment, points.length)];
  const end = points[wrapRaceIndex(segment + 1, points.length)];
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function getRaceGrid(count, points, rowSpacing = RACE_GRID_ROW_SPACING, laneSpacing = RACE_GRID_LANE_SPACING) {
  if (!Number.isInteger(count) || count < 0 || !Array.isArray(points) || points.length < 2 ||
      !Number.isFinite(rowSpacing) || rowSpacing <= 0 || !Number.isFinite(laneSpacing) || laneSpacing < 0) {
    throw new TypeError('Paramètres invalides pour la grille de course.');
  }

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    const progress = row === 0 ? 0 : -row * rowSpacing / averageRaceSegmentLength(points);
    const center = sampleRacePath(points, progress);
    const before = sampleRacePath(points, progress - 0.05);
    const after = sampleRacePath(points, progress + 0.05);
    let tangentX = after.x - before.x;
    let tangentY = after.y - before.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    tangentX /= tangentLength;
    tangentY /= tangentLength;
    const lane = index % 2 === 0 ? -1 : 1;

    return {
      x: center.x - tangentY * laneSpacing * lane,
      y: center.y + tangentX * laneSpacing * lane,
      progress,
      heading: Math.atan2(tangentY, tangentX),
    };
  });
}

function averageRaceSegmentLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next.x - points[index].x, next.y - points[index].y);
  }
  return length / points.length;
}

function getRaceLookahead(points, progress, lookahead = RACE_LOOKAHEAD_POINTS) {
  return sampleRacePath(points, progress + lookahead);
}

function buildRaceInputs(sensorReadings, speed, maxSpeed, position, heading, target, pathCenter, tangent, trackHalfWidth) {
  if (!Array.isArray(sensorReadings) || sensorReadings.length !== 5 ||
      sensorReadings.some(sensor => !Number.isFinite(sensor?.normalizedDistance) ||
        sensor.normalizedDistance < 0 || sensor.normalizedDistance > 1) ||
      !Number.isFinite(speed) || !Number.isFinite(maxSpeed) || maxSpeed <= 0 ||
      ![position, target, pathCenter, tangent].every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y)) ||
      !Number.isFinite(heading) || !Number.isFinite(trackHalfWidth) || trackHalfWidth <= 0) {
    throw new TypeError('Perceptions invalides pour le réseau de course.');
  }

  const targetHeading = Math.atan2(target.y - position.y, target.x - position.x);
  const angleError = Math.atan2(Math.sin(targetHeading - heading), Math.cos(targetHeading - heading)) / Math.PI;
  const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
  const normalX = -tangent.y / tangentLength;
  const normalY = tangent.x / tangentLength;
  const lateralOffset = ((position.x - pathCenter.x) * normalX + (position.y - pathCenter.y) * normalY) /
    trackHalfWidth;

  return [
    ...sensorReadings.map(sensor => sensor.normalizedDistance),
    Math.max(0, Math.min(1, speed / maxSpeed)),
    Math.max(-1, Math.min(1, angleError)),
    Math.max(-1, Math.min(1, lateralOffset)),
  ];
}

function projectRaceProgress(position, points, currentProgress, behind = 2, ahead = 7) {
  if (!position || !Array.isArray(points) || points.length < 2 || !Number.isFinite(currentProgress)) {
    return { progress: currentProgress || 0, distance: Infinity };
  }

  const minSegment = Math.floor(currentProgress - behind);
  const maxSegment = Math.ceil(currentProgress + ahead);
  let nearestDistance = Infinity;
  let nearestProgress = currentProgress;
  for (let segment = minSegment; segment <= maxSegment; segment++) {
    const start = points[wrapRaceIndex(segment, points.length)];
    const end = points[wrapRaceIndex(segment + 1, points.length)];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 1e-9) continue;
    const amount = Math.max(0, Math.min(1,
      ((position.x - start.x) * dx + (position.y - start.y) * dy) / lengthSquared));
    const x = start.x + dx * amount;
    const y = start.y + dy * amount;
    const distance = Math.hypot(position.x - x, position.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestProgress = segment + amount;
    }
  }
  return { progress: nearestProgress, distance: nearestDistance };
}

function shouldCrashRacer(offTrackFrames, grace = RACE_OFF_TRACK_GRACE) {
  return Number.isFinite(offTrackFrames) && offTrackFrames > grace;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RACE_GRID_LANE_SPACING,
    RACE_GRID_ROW_SPACING,
    RACE_LOOKAHEAD_POINTS,
    RACE_OFF_TRACK_GRACE,
    buildRaceInputs,
    getRaceDifficulty,
    getRaceOutcome,
    getRaceGrid,
    getRaceLookahead,
    projectRaceProgress,
    sampleRacePath,
    shouldCrashRacer,
  };
}
