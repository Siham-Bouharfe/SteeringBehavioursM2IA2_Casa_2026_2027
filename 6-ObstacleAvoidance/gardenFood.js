class GardenFood extends Vehicle {
  constructor(x, y, index) {
    super(x, y);
    this.kind = index % 3 === 0 ? 'pate' : 'kibble';
    this.collected = false;
    this.phase = index * 0.8;
    this.r = 12;
  }
}
