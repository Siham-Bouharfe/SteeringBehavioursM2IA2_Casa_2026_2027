class GardenBed extends Vehicle {
  constructor(x, y, w, h, color, roofStyle) {
    super(x + w / 2, y + h / 2);
    Object.assign(this, { x, y, w, h, color, roofStyle, sortY: y + h * 0.52 });
    this.r = Math.hypot(w, h) / 2 + 13;
  }
}
