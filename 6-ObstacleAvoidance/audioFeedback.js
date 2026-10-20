const CityAudioRules = Object.freeze({
  pickupFrequency(count) {
    return Math.max(420, Math.min(880, 520 + Math.max(0, count - 1) * 65));
  },
  deliveryFrequency(count) {
    return Math.max(620, Math.min(1040, 700 + Math.max(0, count - 1) * 34));
  },
});

class AudioFeedback {
  constructor() {
    this.unlocked = false;
    this.ctx = null;
    this.animalSounds = null;
    this.ambienceRequested = false;
    this.ambienceStarting = false;
    this.ambience = false;
    this.ambienceFailed = false;
    this.ambienceNodes = [];
    this.ambienceTimers = new Set();
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(error => console.warn('Impossible d’activer l’audio :', error));
        }
      }
    } catch (e) {
      this.ctx = null;
    }

    this.unlocked = true;
    if (this.ctx) this.prepareMeows();
  }

  get meowDuration() { return this.animalSounds?.buffer?.duration || 3.2; }

  prepareMeows() {
    if (!this.ctx) return Promise.resolve(null);
    if (!this.animalSounds) {
      const SoundBank = typeof AnimalSounds === 'function' ? AnimalSounds : require('./animalSounds.js').AnimalSounds;
      this.animalSounds = new SoundBank(this.ctx);
    }
    return this.animalSounds.load().catch(error => {
      console.warn('Le miaulement local ne peut pas être chargé :', error);
      return null;
    });
  }

  setAmbienceEnabled(enabled) {
    if (!enabled) {
      this.stopAmbience();
      return;
    }
    this.startAmbience();
  }

  startAmbience() {
    this.ambienceRequested = true;
    if (this.ambience || this.ambienceStarting || this.ambienceFailed) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;

    const begin = () => {
      this.ambienceStarting = false;
      if (!this.ambienceRequested || this.ctx.state !== 'running' || this.ambience) return;
      this.ambience = true;
      this.createNightBed();
      this.scheduleAmbienceSound('cricket', 700);
      this.scheduleAmbienceSound('firefly', 1700);
    };

    if (this.ctx.state === 'running') {
      begin();
      return;
    }

    this.ambienceStarting = true;
    this.ctx.resume().then(begin).catch(error => {
      this.ambienceStarting = false;
      this.ambienceFailed = true;
      console.warn('L’ambiance sonore est indisponible :', error);
    });
  }

  stopAmbience() {
    this.ambienceRequested = false;
    this.ambienceStarting = false;
    this.ambience = false;
    for (const timer of this.ambienceTimers) clearTimeout(timer);
    this.ambienceTimers.clear();
    for (const node of this.ambienceNodes) {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (error) {
        console.warn('Impossible d’arrêter un son d’ambiance :', error);
      }
    }
    this.ambienceNodes = [];
  }

  createNightBed() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let brownNoise = 0;
    for (let index = 0; index < samples.length; index++) {
      brownNoise = (brownNoise + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      samples[index] = brownNoise * 3.5;
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    gain.gain.value = 0.035;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
    this.ambienceNodes.push(source, filter, gain);
  }

  scheduleAmbienceSound(kind, delay) {
    const timer = setTimeout(() => {
      this.ambienceTimers.delete(timer);
      if (!this.ambience) return;
      this.playAmbientSound(kind);
      const nextDelay = kind === 'cricket'
        ? 2400 + Math.random() * 2600
        : 2100 + Math.random() * 3400;
      this.scheduleAmbienceSound(kind, nextDelay);
    }, delay);
    this.ambienceTimers.add(timer);
  }

  playAmbientSound(kind) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = 'sine';
    if (kind === 'cricket') {
      oscillator.frequency.setValueAtTime(3900 + Math.random() * 450, now);
      gain.gain.setValueAtTime(0.001, now);
      for (let chirp = 0; chirp < 3; chirp++) {
        const start = now + chirp * 0.085;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.012, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
      }
      oscillator.connect(gain);
      gain.connect(this.ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.23);
      return;
    }

    const duration = 0.38;
    oscillator.frequency.setValueAtTime(720 + Math.random() * 440, now);
    oscillator.frequency.exponentialRampToValueAtTime(oscillator.frequency.value * 1.45, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  async playMeow(voice = 1) {
    if (!this.unlocked) this.unlock();
    if (!this.ctx) return false;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (this.ctx.state !== 'running') return false;
      const buffer = await this.prepareMeows();
      return buffer ? await this.animalSounds.play(voice) : false;
    } catch (error) {
      console.warn('Le miaou ne peut pas être joué :', error);
      return false;
    }
  }

  play(kind, count = 1) {
    if (kind === 'meow') return this.playMeow(count);
    if (!this.unlocked) this.unlock();

    // 1. Web Audio API direct synth (low latency, rich sounds)
    if (this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;

      if (kind === 'purr') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.15);
        osc.frequency.linearRampToValueAtTime(75, now + 0.35);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);
        return;
      }

      if (kind === 'decoy') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
        return;
      }

      if (kind === 'combo') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const freq = Math.min(1400, 520 + count * 140);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.15);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
        return;
      }

      if (kind === 'beep') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        return;
      }

      if (kind === 'go') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.48);
        return;
      }

      if (kind === 'victory') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteStart = now + idx * 0.11;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteStart);
          gain.gain.setValueAtTime(0.15, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(noteStart);
          osc.stop(noteStart + 0.26);
        });
        return;
      }

      // Default pickup / delivery / danger via Web Audio
      const baseFreq = kind === 'delivery'
        ? CityAudioRules.deliveryFrequency(count)
        : kind === 'danger'
          ? 180
          : CityAudioRules.pickupFrequency(count);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = kind === 'danger' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      if (kind === 'danger') {
        osc.frequency.linearRampToValueAtTime(120, now + 0.18);
      }
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'danger' ? 0.25 : 0.15));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      return;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioFeedback, CityAudioRules };
}
