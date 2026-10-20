class Maison extends Vehicle {
  constructor(x, baseY, index, scale = 1) {
    super(x, baseY);
    this.r = 1;
    this.index = index;
    this.scale = scale;
    this.houseWidth = 112 * scale;
    this.houseHeight = (74 + (index % 3) * 11) * scale;
    this.wallColors = ['#d89b78', '#8ba6b0', '#c5a0bd', '#d4b579', '#91a98d'];
    this.lightPhase = index * 1.7;
    this.reactionPoint = createVector(x, baseY - this.houseHeight * 0.55);
    this.reaction = 0;
    this.catAtWindow = false;
  }

  update(cat) {
    this.catAtWindow = p5.Vector.dist(cat.pos, this.reactionPoint) < 155;
    const destination = this.catAtWindow ? 1 : 0;
    this.reaction += (destination - this.reaction) * (this.catAtWindow ? 0.14 : 0.045);
  }

  show() {
    const s = this.scale;
    const w = this.houseWidth;
    const h = this.houseHeight;
    const light = 0.5 + 0.5 * Math.sin(frameCount * 0.025 + this.lightPhase);
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();
    fill(26, 25, 43, 50);
    ellipse(0, 2 * s, w * 1.35, 17 * s);
    fill('#51475a');
    triangle(-w * 0.62, -h + 8 * s, 0, -h - 42 * s, w * 0.62, -h + 8 * s);
    fill(this.wallColors[this.index % this.wallColors.length]);
    rect(-w / 2, -h, w, h, 5 * s);
    fill('#f3c89a');
    rect(-10 * s, -31 * s, 20 * s, 31 * s, 8 * s, 8 * s, 0, 0);
    fill(255, 222, 145, 135 + light * 75 + this.reaction * 45);
    rect(-w * 0.34, -h * 0.72, 22 * s, 22 * s, 3 * s);
    rect(w * 0.15, -h * 0.72, 22 * s, 22 * s, 3 * s);
    stroke('#fff0c2');
    strokeWeight(1.5 * s);
    line(-w * 0.34 + 11 * s, -h * 0.72, -w * 0.34 + 11 * s, -h * 0.72 + 22 * s);
    line(w * 0.15 + 11 * s, -h * 0.72, w * 0.15 + 11 * s, -h * 0.72 + 22 * s);
    if (this.reaction > 0.08) {
      const catX = this.index % 2 ? w * 0.26 : -w * 0.26;
      const catY = -h * 0.68;
      const catSize = 7 * s;
      fill('#454052');
      ellipse(catX, catY + catSize * 0.2, catSize * 1.35, catSize);
      triangle(catX - catSize * 0.55, catY, catX - catSize * 0.45, catY - catSize * 0.8,
        catX - catSize * 0.05, catY - catSize * 0.28);
      triangle(catX + catSize * 0.05, catY - catSize * 0.28, catX + catSize * 0.5, catY - catSize * 0.8,
        catX + catSize * 0.58, catY);
      fill('#ffe8ad');
      circle(catX - catSize * 0.2, catY + catSize * 0.15, catSize * 0.1);
      circle(catX + catSize * 0.2, catY + catSize * 0.15, catSize * 0.1);
    }
    fill('#6c8263');
    noStroke();
    rect(-w * 0.55, -7 * s, 18 * s, 7 * s, 2 * s);
    rect(w * 0.38, -7 * s, 18 * s, 7 * s, 2 * s);
    fill(this.index % 2 ? '#e7a5a3' : '#f0cb82');
    circle(-w * 0.45, -12 * s, 10 * s);
    circle(w * 0.48, -12 * s, 10 * s);
    pop();
  }
}

if (typeof window !== 'undefined') window.Maison = Maison;
