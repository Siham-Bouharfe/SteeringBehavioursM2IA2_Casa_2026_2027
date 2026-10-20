function pointerMotionSemitones(deltaX, deltaY, width, height, elapsedMs) {
  const seconds = Math.max(8, elapsedMs) / 1000;
  const verticalRate = -deltaY / Math.max(height, 1) / seconds;
  const horizontalRate = Math.abs(deltaX) / Math.max(width, 1) / seconds;
  const semitones = verticalRate * 3 - horizontalRate * 2;
  if (semitones === 0) return 0;
  return Math.max(-12, Math.min(12, semitones));
}

class AmbientMusic {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.gain = null;
    this.oscillators = [];
    this.samples = null;
    this.level = 0;
    this.enabled = false;
    this.pitchSemitones = 0;
    this.baseFrequencies = [220, 277.18, 329.63];
    this.modulator = null;
    this.modulationGains = [];
    this.modulationFrequency = 0.25;
    this.modulationPhase = 0;
    this.compressor = null;
    this.errorMessage = '';
    this.lastExplosionAt = -Infinity;
  }

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.errorMessage = 'Web Audio non pris en charge par ce navigateur';
      return false;
    }
    this.context ??= new AudioContextClass();
    await this.context.resume();
    return !this.context.state || this.context.state === 'running';
  }

  playExplosion() {
    if (!this.context || (this.context.state && this.context.state !== 'running')) return false;
    const now = this.context.currentTime;
    if (now - this.lastExplosionAt < 0.09) return false;
    this.lastExplosionAt = now;

    const boom = this.context.createOscillator();
    const boomGain = this.context.createGain();
    boom.type = 'triangle';
    boom.frequency.setValueAtTime(105, now);
    boom.frequency.exponentialRampToValueAtTime(38, now + 0.38);
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    boom.connect(boomGain);
    boomGain.connect(this.context.destination);
    boom.start(now);
    boom.stop(now + 0.43);

    const pop = this.context.createOscillator();
    const popGain = this.context.createGain();
    pop.type = 'square';
    pop.frequency.setValueAtTime(480, now);
    pop.frequency.exponentialRampToValueAtTime(115, now + 0.1);
    popGain.gain.setValueAtTime(0.0001, now);
    popGain.gain.linearRampToValueAtTime(0.045, now + 0.004);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    pop.connect(popGain);
    popGain.connect(this.context.destination);
    pop.start(now);
    pop.stop(now + 0.14);
    return true;
  }

  setPointerPosition(x, width) {
    const normalizedX = Math.max(0, Math.min(1, x / Math.max(width, 1)));
    this.modulationFrequency = 0.25 + normalizedX * 11.75;
    if (this.modulator && this.context) {
      this.modulator.frequency.setTargetAtTime(
        this.modulationFrequency,
        this.context.currentTime,
        0.08
      );
    }
    return this.modulationFrequency;
  }

  advanceModulation(deltaSeconds) {
    const safeDelta = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.modulationPhase = (this.modulationPhase +
      Math.PI * 2 * this.modulationFrequency * safeDelta) % (Math.PI * 2);
    return {
      frequency: this.modulationFrequency,
      phase: this.modulationPhase,
      wave: Math.sin(this.modulationPhase),
    };
  }

  setPointerMotion(deltaX, deltaY, width, height, elapsedMs) {
    this.pitchSemitones = pointerMotionSemitones(
      deltaX, deltaY, width, height, elapsedMs
    );
    this.updatePitch();
  }

  updatePitch() {
    if (!this.context || this.oscillators.length === 0) return;
    const ratio = 2 ** (this.pitchSemitones / 12);
    this.oscillators.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(
        this.baseFrequencies[index] * ratio,
        this.context.currentTime,
        0.12
      );
    });
  }

  async toggle() {
    if (!this.enabled) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.errorMessage = 'Web Audio non pris en charge par ce navigateur';
        return null;
      }
      this.context ??= new AudioContextClass();
      await this.context.resume();
      if (this.context.state && this.context.state !== 'running') {
        this.errorMessage = `Contexte audio ${this.context.state}`;
        return null;
      }
      if (this.oscillators.length === 0) this.startSynth();
      this.gain.gain.setTargetAtTime(0.2, this.context.currentTime, 0.2);
      this.enabled = true;
      this.errorMessage = '';
      return true;
    }

    this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.18);
    this.enabled = false;
    return false;
  }

  startSynth() {
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.samples = new Uint8Array(this.analyser.fftSize);
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    if (typeof this.context.createDynamicsCompressor === 'function') {
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.2;
      this.gain.connect(this.compressor);
      this.compressor.connect(this.analyser);
    } else {
      this.gain.connect(this.analyser);
    }
    this.analyser.connect(this.context.destination);

    this.modulator = this.context.createOscillator();
    this.modulator.type = 'sine';
    this.modulator.frequency.value = this.modulationFrequency;
    this.modulator.start();

    // L'oscillateur modulateur fait varier directement la fréquence des porteuses.
    for (const [index, frequency] of this.baseFrequencies.entries()) {
      const detune = [-5, 4, 0][index];
      const oscillator = this.context.createOscillator();
      const voiceGain = this.context.createGain();
      const modulationGain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      voiceGain.gain.value = 0.2;
      modulationGain.gain.value = [18, 24, 30][index];
      this.modulator.connect(modulationGain);
      modulationGain.connect(oscillator.frequency);
      oscillator.connect(voiceGain);
      voiceGain.connect(this.gain);
      oscillator.start();
      this.oscillators.push(oscillator);
      this.modulationGains.push(modulationGain);
    }
    this.updatePitch();
  }

  getLevel() {
    if (!this.enabled || !this.analyser) {
      this.level *= 0.94;
      return this.level;
    }
    this.analyser.getByteTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const measured = Math.sqrt(sum / this.samples.length);
    this.level += (measured - this.level) * 0.12;
    return this.level;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { AmbientMusic, pointerMotionSemitones };
}
