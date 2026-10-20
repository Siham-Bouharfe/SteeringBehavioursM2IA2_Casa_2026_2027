class Hud extends Vehicle {
  constructor() {
    super(0, 0);
    this.r = 1;
  }

  show(score, snacksEaten, mission) {
    push();
    noStroke();
    fill(29, 25, 44, 200);
    rect(18, 18, 348, 112, 18);
    fill('#fff1e7');
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(18);
    text(`SCORE  ${score}   ·   MIAM  ${snacksEaten}`, 34, 31);
    textStyle(NORMAL);
    textSize(12);
    fill('#d8c9df');
    text(`MISSION  ${mission.label}`, 34, 61);
    fill(255, 255, 255, 55);
    rect(34, 86, 300, 7, 4);
    fill('#ffd27c');
    rect(34, 86, 300 * mission.progress / mission.target, 7, 4);
    textAlign(RIGHT, TOP);
    text(`${mission.progress}/${mission.target}`, 334, 99);
    pop();
  }
}

if (typeof window !== 'undefined') window.Hud = Hud;
