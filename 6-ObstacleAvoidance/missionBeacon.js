class MissionBeacon extends Vehicle {
  constructor(x, y, label = 'Objectif') {
    super(x, y);
    this.label = label;
    this.color = '#f7d778';
    this.r = 30;
  }
}
