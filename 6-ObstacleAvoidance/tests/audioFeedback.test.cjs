const test = require('node:test');
const assert = require('node:assert/strict');
const { AudioFeedback, CityAudioRules } = require('../audioFeedback.js');

test('pickup feedback rises with the rescued group and stays in a pleasant range', () => {
  assert.ok(CityAudioRules.pickupFrequency(3) > CityAudioRules.pickupFrequency(1));
  assert.equal(CityAudioRules.pickupFrequency(0), 520);
  assert.equal(CityAudioRules.pickupFrequency(100), 880);
});

test('evacuation feedback has a brighter, bounded pitch', () => {
  assert.ok(CityAudioRules.deliveryFrequency(2) > CityAudioRules.pickupFrequency(2));
  assert.equal(CityAudioRules.deliveryFrequency(100), 1040);
});

test('promenade ambience starts and releases its Web Audio nodes', async () => {
  const nodes = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
  });
  const node = () => {
    const audioNode = {
      frequency: parameter(),
      gain: parameter(),
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
    nodes.push(audioNode);
    return audioNode;
  };
  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 8;
      this.destination = {};
    }
    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() { return node(); }
    createBiquadFilter() {
      const filter = node();
      filter.frequency = parameter();
      return filter;
    }
    createGain() { return node(); }
    createOscillator() { return node(); }
    resume() { return Promise.resolve(); }
  }

  const previousWindow = global.window;
  global.window = { AudioContext: MockAudioContext };
  try {
    const audio = new AudioFeedback();
    // This test isolates the existing ambience; recording loading has its own tests.
    audio.prepareMeows = async () => null;
    audio.unlock();
    audio.setAmbienceEnabled(true);
    assert.equal(audio.ambience, true);
    assert.ok(nodes.length >= 3, 'wind source and gain chain should start');
    audio.setAmbienceEnabled(false);
    assert.equal(audio.ambience, false);
    assert.equal(audio.ambienceTimers.size, 0);
  } finally {
    global.window = previousWindow;
  }
});
