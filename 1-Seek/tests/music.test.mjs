import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { AmbientMusic, pointerMotionSemitones } = require('../music.js');

test('monter aiguise le son et un mouvement horizontal le rend plus grave', () => {
  const upward = pointerMotionSemitones(0, -120, 600, 600, 100);
  const horizontal = pointerMotionSemitones(120, 0, 600, 600, 100);

  assert.ok(upward > 0);
  assert.ok(horizontal < 0);
  assert.equal(pointerMotionSemitones(0, 0, 600, 600, 100), 0);
});

test('la position horizontale règle la fréquence FM et le fond peut suivre sa phase', () => {
  const music = new AmbientMusic();
  const leftFrequency = music.setPointerPosition(0, 1000);
  const leftState = music.advanceModulation(0.05);
  const rightFrequency = music.setPointerPosition(1000, 1000);
  const rightState = music.advanceModulation(0.05);

  assert.equal(leftFrequency, 0.25);
  assert.equal(rightFrequency, 12);
  assert.ok(rightState.phase > leftState.phase);
  assert.ok(rightState.frequency > leftState.frequency);
  assert.ok(rightState.wave >= -1 && rightState.wave <= 1);
});

test('le synthé Web Audio relie le modulateur aux fréquences des porteuses', () => {
  const music = new AmbientMusic();
  const makeParam = value => ({ value, setTargetAtTime(target) { this.target = target; } });
  const oscillators = [];
  music.context = {
    currentTime: 0,
    destination: {},
    createAnalyser() {
      return { fftSize: 0, connect() {}, getByteTimeDomainData() {} };
    },
    createGain() {
      return { gain: makeParam(0), connect() {} };
    },
    createDynamicsCompressor() {
      return {
        threshold: makeParam(0), knee: makeParam(0), ratio: makeParam(0),
        attack: makeParam(0), release: makeParam(0), connect() {},
      };
    },
    createOscillator() {
      const oscillator = {
        frequency: makeParam(0),
        detune: makeParam(0),
        connections: [],
        connect(destination) { this.connections.push(destination); },
        start() {},
      };
      oscillators.push(oscillator);
      return oscillator;
    },
  };

  music.startSynth();
  assert.equal(music.modulator, oscillators[0]);
  assert.equal(music.modulationGains.length, 3);
  for (const modulationGain of music.modulationGains) {
    assert.ok(music.modulator.connections.includes(modulationGain));
  }

  music.setPointerPosition(500, 1000);
  assert.equal(music.modulator.frequency.target, 6.125);
  assert.ok(music.modulationGains.every(node => node.gain.value > 0));
});

test('le niveau sonore suit le signal et retombe progressivement à la coupure', () => {
  const music = new AmbientMusic();
  music.enabled = true;
  music.samples = new Uint8Array(4);
  music.analyser = {
    getByteTimeDomainData(samples) { samples.set([128, 255, 128, 1]); },
  };

  const activeLevel = music.getLevel();
  assert.ok(activeLevel > 0);

  music.enabled = false;
  const fadingLevel = music.getLevel();
  assert.ok(fadingLevel > 0);
  assert.ok(fadingLevel < activeLevel);
});

test('le son d’explosion est synthétisé en Web Audio et limité contre les répétitions', () => {
  const music = new AmbientMusic();
  const makeParam = value => ({
    value,
    setValueAtTime(target) { this.value = target; },
    linearRampToValueAtTime(target) { this.value = target; },
    exponentialRampToValueAtTime(target) { this.value = target; },
  });
  const voices = [];
  music.context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    createOscillator() {
      const voice = {
        frequency: makeParam(0),
        connect() {},
        start(time) { this.startedAt = time; },
        stop(time) { this.stoppedAt = time; },
      };
      voices.push(voice);
      return voice;
    },
    createGain() { return { gain: makeParam(0), connect() {} }; },
  };

  assert.equal(music.playExplosion(), true);
  assert.equal(voices.length, 2);
  assert.equal(voices[0].startedAt, 1);
  assert.equal(voices[0].stoppedAt, 1.43);
  assert.equal(music.playExplosion(), false);
  assert.equal(voices.length, 2);
});
