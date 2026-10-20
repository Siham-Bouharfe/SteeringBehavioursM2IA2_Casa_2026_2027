// Véhicule de simulation : les mêmes capteurs, commandes neuronales et locomotion
// que la course, sans créer de modèle Babylon ni déplacer le chat du jardin.
class RaceTrainee extends Vehicle {
  constructor(brain, track, difficulty) {
    const slot = getRaceGrid(1, track.points)[0];
    super(slot.x, slot.y);
    this.raceBrain = brain;
    this.raceHeading = slot.heading;
    this.raceProgress = slot.progress;
    this.raceCourseLength = track.points.length;
    this.vel.set(Math.cos(slot.heading) * 1.35, Math.sin(slot.heading) * 1.35);
    this.maxSpeed = this.raceMaxSpeed = getRaceDifficulty(difficulty).playerSpeed;
    this.maxForce = 0.13;
    this.raceFinishedAt = null;
    this.raceCrashed = false;
    this.frames = 0;
    this.offTrack = 0;
    this.done = false;
  }

  step(track, difficulty) {
    if (this.done) return;
    this.frames++;
    const { inputs } = raceInputsFor(this, track);
    const command = raceSteeringCommand(this.vel, this.raceBrain.predict(inputs), this.maxSpeed, this.maxForce);
    this.applyForce(createVector(command.force.x, command.force.y));
    super.update();
    this.raceHeading = this.vel.heading();
    const position = projectRaceProgress(this.pos, track.points, this.raceProgress);
    if (position.distance <= track.width / 2 + 35) {
      this.raceProgress = Math.max(this.raceProgress, position.progress);
      this.offTrack = 0;
    } else this.offTrack++;
    if (this.raceProgress >= track.points.length) {
      this.raceFinishedAt = this.frames / 60;
      this.done = true;
    } else if (this.offTrack > getRaceDifficulty(difficulty).offTrackGrace ||
      this.frames >= getRaceDifficulty(difficulty).timeLimit * 60) {
      this.raceCrashed = true;
      this.done = true;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { RaceTrainee };
