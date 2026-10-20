// Real animal recordings are bundled locally: see assets/audio/CREDITS.md.
class AnimalSounds {
  constructor(context, fetchSound = (...args) => fetch(...args)) {
    this.context = context;
    this.fetchSound = fetchSound;
    this.buffer = null;
    this.loading = null;
    this.active = new Set();
    this.output = context.createGain();
    this.output.gain.value = 0.85;
    this.output.connect(context.destination);
  }

  load() {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (!this.loading) {
      this.loading = this.fetchSound('assets/audio/cat-meow.mp3')
        .then(response => {
          if (!response.ok) throw new Error(`Miaulement introuvable (HTTP ${response.status}).`);
          return response.arrayBuffer();
        })
        .then(bytes => this.context.decodeAudioData(bytes))
        .then(decoded => {
          this.buffer = AnimalSounds.trimSilence(this.context, decoded);
          return this.buffer;
        })
        .catch(error => { this.loading = null; throw error; });
    }
    return this.loading;
  }

  // Remove room silence, keeping a little lead-in/tail so the meow stays natural.
  static trimSilence(context, buffer) {
    const samples = buffer.getChannelData(0);
    const block = Math.max(1, Math.floor(buffer.sampleRate * 0.01));
    const levels = [];
    let loudest = 0;
    for (let start = 0; start < samples.length; start += block) {
      let energy = 0;
      const end = Math.min(samples.length, start + block);
      for (let index = start; index < end; index++) energy += samples[index] ** 2;
      const rms = Math.sqrt(energy / (end - start));
      levels.push(rms);
      loudest = Math.max(loudest, rms);
    }
    if (loudest < 0.00001) throw new Error('L’enregistrement du miaulement est silencieux.');
    const threshold = loudest * 0.08;
    const first = levels.findIndex(level => level >= threshold);
    let last = levels.length - 1;
    while (levels[last] < threshold) last--;
    const from = Math.max(0, first * block - Math.floor(buffer.sampleRate * 0.03));
    const to = Math.min(samples.length, (last + 1) * block + Math.floor(buffer.sampleRate * 0.08));
    const trimmed = context.createBuffer(buffer.numberOfChannels, to - from, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      trimmed.getChannelData(channel).set(buffer.getChannelData(channel).subarray(from, to));
    }
    return trimmed;
  }

  async play(voice = 1) {
    const buffer = await this.load();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    // Zouin keeps the original voice; replies have a slightly different timbre.
    source.playbackRate.value = voice === 1 ? 1 : 1.08 + Math.abs(voice % 5) * 0.025;
    source.connect(this.output);
    source.onended = () => { source.disconnect(); this.active.delete(source); };
    this.active.add(source);
    source.start();
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { AnimalSounds };
