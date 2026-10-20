class SnackSound {
  constructor() {
    this.synth = new p5.MonoSynth();
    this.enabled = true;
  }

  play(score, { golden = false, celebration = false } = {}) {
    if (!this.enabled) return;
    userStartAudio().then(() => {
      if (celebration) {
        ['C6', 'E6', 'G6', 'C7'].forEach((note, index) => {
          this.synth.play(note, 0.24, index * 0.12, 0.14);
        });
        return;
      }
      const notes = golden ? ['A6', 'C7', 'E7'] : ['E6', 'G6', 'B6', 'D7'];
      this.synth.play(notes[Math.min(score - 1, notes.length - 1)], golden ? 0.28 : 0.22, 0, 0.12);
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined') window.SnackSound = SnackSound;
