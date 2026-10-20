class RoomProp extends Vehicle {
  constructor(x, y, type, width, height, color) {
    super(x, y);
    this.type = type;
    this.w = width;
    this.h = height;
    this.color = color;
    this.r = Math.max(width, height) * 0.55;
    this.r_pourDessin = this.r;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, -4);
    noStroke();
    if (this.type === 'building') {
      const height = this.h;
      ambientMaterial('#080b17');
      push(); translate(5, 7, height * 0.34); box(this.w + 12, this.h * 0.58 + 12, height * 0.68); pop();
      ambientMaterial(this.color);
      push(); translate(0, 0, height * 0.34); box(this.w, this.h * 0.58, height * 0.68); pop();
      emissiveMaterial(this.color);
      push(); translate(-this.w * 0.18, -this.h * 0.29, height * 0.36); box(this.w * 0.22, 3, height * 0.32); pop();
      push(); translate(this.w * 0.18, -this.h * 0.29, height * 0.36); box(this.w * 0.22, 3, height * 0.32); pop();
      push(); translate(-this.w * 0.18, this.h * 0.29, height * 0.36); box(this.w * 0.22, 3, height * 0.32); pop();
      push(); translate(this.w * 0.18, this.h * 0.29, height * 0.36); box(this.w * 0.22, 3, height * 0.32); pop();
      emissiveMaterial('#20dff2');
      push(); translate(0, -this.h * 0.3, height * 0.68); box(this.w * 0.56, 4, 4); pop();
    } else if (this.type === 'rug') {
      ambientMaterial(this.color);
      push();
      translate(0, 0, -7);
      scale(this.w * 0.5, this.h * 0.5, 0.06);
      sphere(1, 24, 12);
      pop();
      noFill();
      stroke('#78887e');
      strokeWeight(2);
      ellipse(0, 0, this.w * 0.9, this.h * 0.9);
    } else if (this.type === 'sofa') {
      ambientMaterial('#27363a');
      push(); translate(0, 8, -9); box(this.w + 12, this.h + 10, 18); pop();
      ambientMaterial(this.color);
      box(this.w, this.h, 25);
      ambientMaterial('#d9b48b');
      for (const side of [-1, 1]) {
        push(); translate(side * (this.w * 0.34), 0, 8); box(this.w * 0.28, this.h * 0.79, 8); pop();
      }
    } else if (this.type === 'plant') {
      ambientMaterial('#ad795f');
      cylinder(this.w * 0.25, this.h * 0.35, 12, 1);
      ambientMaterial(this.color);
      translate(0, 0, this.h * 0.35);
      for (let i = 0; i < 5; i++) {
        push();
        rotateZ(i * TWO_PI / 5);
        translate(this.w * 0.2, 0, 4);
        scale(0.65, 1.2, 0.6);
        sphere(this.w * 0.28, 10, 7);
        pop();
      }
      translate(0, 0, 5);
      sphere(this.w * 0.23, 10, 7);
    } else {
      ambientMaterial('#29393b');
      push(); translate(0, 5, -7); box(this.w + 8, this.h + 8, 15); pop();
      ambientMaterial(this.color);
      box(this.w, this.h, 22);
      ambientMaterial('#e9c08f');
      translate(-this.w * 0.2, -this.h * 0.1, 12);
      box(this.w * 0.42, this.h * 0.38, 3);
      translate(this.w * 0.48, this.h * 0.2, -1);
      sphere(2, 8, 6);
    }
    pop();
  }
}
