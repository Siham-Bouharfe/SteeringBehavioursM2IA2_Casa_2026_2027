class SeekSettings {
  constructor(maxSpeed = 4, maxForce = 0.2) {
    this.maxSpeed = maxSpeed;
    this.maxForce = maxForce;
  }

  setMaxSpeed(value) {
    this.maxSpeed = Math.max(0, Math.min(20, Number(value)));
  }

  setMaxForce(value) {
    this.maxForce = Math.max(0, Math.min(10, Number(value)));
  }

  applyTo(vehicles) {
    const list = Array.isArray(vehicles) ? vehicles : [vehicles];
    list.forEach(vehicle => {
      vehicle.maxSpeed = this.maxSpeed;
      vehicle.maxForce = this.maxForce;
    });
  }
}

if (typeof window !== 'undefined') window.SeekSettings = SeekSettings;
if (typeof module !== 'undefined') module.exports = { SeekSettings };
