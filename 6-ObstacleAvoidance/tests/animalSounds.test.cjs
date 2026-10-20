const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AnimalSounds } = require('../animalSounds.js');

function buffer(length = 500, channels = 1) {
  const data = Array.from({length: channels}, () => new Float32Array(length));
  return { length, numberOfChannels: channels, sampleRate: 1000, duration: length / 1000,
    getChannelData: channel => data[channel] };
}

function fixture() {
  let fetched = 0, decoded = 0;
  const recording = buffer(500, 2), sources = [];
  for (let channel = 0; channel < 2; channel++) recording.getChannelData(channel).fill(.5, 100, 300);
  const context = {
    destination: {},
    createGain() { return { gain: {}, connect(destination) { this.destination = destination; } }; },
    createBuffer: (channels, length) => buffer(length, channels),
    async decodeAudioData(bytes) { assert.equal(bytes.byteLength, 3); decoded++; return recording; },
    createBufferSource() {
      const source = { playbackRate: {}, connect(output) { this.output = output; },
        start() { this.started = true; }, disconnect() { this.disconnected = true; } };
      sources.push(source); return source;
    },
  };
  const bank = new AnimalSounds(context, async url => {
    assert.equal(url, 'assets/audio/cat-meow.mp3'); fetched++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(3) };
  });
  return { bank, context, recording, sources, counts: () => ({fetched, decoded}) };
}

test('Local recording is fetched/decoded once, trims silence and preserves both channels', async () => {
  const { bank, counts, recording } = fixture();
  const [a, b] = await Promise.all([bank.load(), bank.load()]);
  assert.equal(a, b); assert.equal(await bank.load(), a);
  assert.deepEqual(counts(), { fetched: 1, decoded: 1 });
  assert.equal(a.duration, .31);
  assert.equal(a.numberOfChannels, 2); assert.equal(a.getChannelData(1)[30], .5);
  assert.equal(recording.duration, .5, 'Original is not modified');
});

test('Each tap plays a finite recording, with a distinct bounded reply pitch and node cleanup', async () => {
  const { bank, sources, context } = fixture();
  await bank.play(1); await bank.play(3); await bank.play(6);
  assert.equal(sources.length, 3); assert.equal(sources[0].playbackRate.value, 1);
  assert.ok(sources.slice(1).every(source => source.playbackRate.value > 1 && source.playbackRate.value < 1.2));
  assert.ok(sources.every(source => source.buffer === bank.buffer && source.started && !source.loop));
  assert.ok(sources.every(source => source.output === bank.output));
  assert.equal(bank.output.destination, context.destination); assert.equal(bank.output.gain.value, .85);
  for (const source of sources) source.onended();
  assert.equal(bank.active.size, 0); assert.ok(sources.every(source => source.disconnected));
});

test('Failed loads are recoverable and do not cache invalid data', async () => {
  const { bank } = fixture();
  const originalFetch = bank.fetchSound;
  bank.fetchSound = async () => ({ ok: false, status: 404 });
  await assert.rejects(bank.load(), /404/); assert.equal(bank.buffer, null);
  bank.fetchSound = originalFetch; assert.ok(await bank.load());
});

test('Silent files are rejected; sounds at either boundary are not cut off', () => {
  const { context } = fixture();
  assert.throws(() => AnimalSounds.trimSilence(context, buffer()), /silencieux/);
  const full = buffer(); full.getChannelData(0).fill(.2);
  const trimmed = AnimalSounds.trimSilence(context, full);
  assert.equal(trimmed.length, full.length);
  assert.deepEqual(trimmed.getChannelData(0), full.getChannelData(0));
});

test('Licensed MP3 is bundled locally with credits, not an HTML error or remote dependency', () => {
  const folder = path.join(__dirname, '..', 'assets', 'audio');
  const bytes = fs.readFileSync(path.join(folder, 'cat-meow.mp3'));
  assert.ok(bytes.length > 10000 && bytes.length < 200000);
  assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff);
  const credits = fs.readFileSync(path.join(folder, 'CREDITS.md'), 'utf8');
  assert.match(credits, /CC0/); assert.match(credits, /Joseph SARDIN/);
});
