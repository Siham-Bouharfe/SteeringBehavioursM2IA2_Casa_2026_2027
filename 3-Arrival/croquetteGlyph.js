class CroquetteGlyph extends Vehicle {
  static GATHER_DURATION = 2600;
  static HOLD_DURATION = 700;
  static BURST_DURATION = 1250;
  static WORD_COLUMNS = 33;

  static wordLayout(centerX, centerY, pixelSize) {
    const patterns = {
      O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
      U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
      I: ['111', '010', '010', '010', '010', '010', '111'],
      '!': ['1', '1', '1', '1', '1', '0', '1'],
    };
    const word = ['O', 'U', 'I', 'I', 'I', 'I', 'I', '!'];
    const totalWidth = CroquetteGlyph.WORD_COLUMNS * pixelSize;
    const startX = centerX - totalWidth / 2;
    const startY = centerY - 3.5 * pixelSize;
    const points = [];
    let column = 0;

    for (const letter of word) {
      const rows = patterns[letter];
      for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].length; col++) {
          if (rows[row][col] === '1') {
            points.push({
              x: startX + (column + col + 0.5) * pixelSize,
              y: startY + (row + 0.5) * pixelSize,
            });
          }
        }
      }
      column += rows[0].length + 1;
    }
    return points;
  }

  static phaseAt(now, bornAt) {
    const elapsed = now - bornAt;
    if (elapsed < CroquetteGlyph.GATHER_DURATION) return 'gather';
    if (elapsed < CroquetteGlyph.GATHER_DURATION + CroquetteGlyph.HOLD_DURATION) return 'hold';
    if (elapsed < CroquetteGlyph.GATHER_DURATION + CroquetteGlyph.HOLD_DURATION + CroquetteGlyph.BURST_DURATION) return 'burst';
    return 'done';
  }

  constructor(x, y, targetX, targetY, centerX, centerY, index, pixelSize, bornAt = millis()) {
    super(x, y);
    this.r = Math.max(2.2, pixelSize * 0.34);
    this.maxSpeed = 15;
    this.maxForce = 0.8;
    this.rayonZoneDeFreinage = 180;
    this.formationPoint = createVector(targetX, targetY);
    this.burstCenter = createVector(centerX, centerY);
    this.index = index;
    this.pixelSize = pixelSize;
    this.bornAt = bornAt;
    this.lifetime = CroquetteGlyph.GATHER_DURATION + CroquetteGlyph.HOLD_DURATION + CroquetteGlyph.BURST_DURATION;
    this.explosionDirection = null;
  }

  isExpired(now = millis()) {
    return CroquetteGlyph.phaseAt(now, this.bornAt) === 'done';
  }

  update(now = millis()) {
    const phase = CroquetteGlyph.phaseAt(now, this.bornAt);
    if (phase === 'gather' || phase === 'hold') {
      this.applyForce(this.arrive(this.formationPoint, 0));
    } else if (phase === 'burst') {
      if (!this.explosionDirection) {
        this.explosionDirection = p5.Vector.sub(this.pos, this.burstCenter);
        if (this.explosionDirection.mag() < 0.001) {
          const angle = this.index * 2.399963;
          this.explosionDirection = createVector(Math.cos(angle), Math.sin(angle));
        }
        this.explosionDirection.rotate(Math.sin(this.index * 12.9898) * 0.13);
        this.explosionDirection.normalize();
      }
      const desiredVelocity = this.explosionDirection.copy().mult(this.maxSpeed);
      const steering = p5.Vector.sub(desiredVelocity, this.vel);
      steering.limit(this.maxForce);
      this.applyForce(steering);
    }
    super.update();
  }

  show(now = millis()) {
    const phase = CroquetteGlyph.phaseAt(now, this.bornAt);
    const elapsed = now - this.bornAt;
    const alpha = phase === 'burst'
      ? 255 * Math.max(0, 1 - (elapsed - CroquetteGlyph.GATHER_DURATION - CroquetteGlyph.HOLD_DURATION) / CroquetteGlyph.BURST_DURATION)
      : 255;
    const angle = this.vel.mag() > 0.1 ? this.vel.heading() : 0;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(angle);
    noStroke();
    drawingContext.shadowColor = 'rgba(255, 207, 104, 0.8)';
    drawingContext.shadowBlur = phase === 'hold' ? 12 : 5;
    fill(255, 204, 102, alpha);
    ellipse(0, 0, this.pixelSize * 0.8, this.pixelSize * 0.5);
    drawingContext.shadowBlur = 0;
    fill(255, 244, 194, alpha);
    circle(-this.pixelSize * 0.16, -this.pixelSize * 0.04, this.pixelSize * 0.19);
    pop();
  }
}

if (typeof window !== 'undefined') window.CroquetteGlyph = CroquetteGlyph;
