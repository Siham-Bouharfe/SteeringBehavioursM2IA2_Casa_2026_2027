const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/gameHarness.cjs');
const { AudioFeedback } = require('../audioFeedback.js');

test('Every E call meows, even alone; only acceptance schedules one delayed answer', () => {
  const g = loadGame(), chat = new g.CatConversation();
  const zouin = new g.Cat(0, 0), near = new g.Cat(40, 0), far = new g.Cat(90, 0);
  const events = [], audio = { play: (kind, voice) => events.push({ kind, voice }) };
  assert.equal(chat.start(zouin, [far, near], audio), near);
  assert.equal(events.length, 1);
  assert.ok(zouin.meowRemaining > 0 && near.chatPause > 0);
  chat.update(2);
  assert.equal(events.length, 1, 'Proximity or feeding alone does not imply acceptance');
  assert.equal(chat.start(zouin, [near], audio), near);
  assert.equal(chat.accept(near), true);
  assert.equal(chat.accept(near), false);
  chat.update(.7);
  assert.equal(events.length, 2, 'Wait until the first meow ends');
  chat.update(.2);
  assert.equal(events.length, 3);
  assert.notEqual(events[0].voice, events[2].voice);
  assert.ok(near.meowRemaining > 0);
  chat.update(2);
  assert.equal(events.length, 3);
  assert.equal(near.chatPause, 0); assert.equal(near.socialHeading, null);
  chat.reset(); assert.equal(zouin.meowRemaining, 0);
  far.pos.set(300, 0);
  assert.equal(chat.start(zouin, [far], audio), null);
  assert.equal(events.length, 4, 'Zouin also meows with nobody nearby');
  chat.start(zouin, [], audio);
  assert.equal(events.length, 5, 'No cooldown swallows new presses');
  chat.update(5);
  assert.equal(events.length, 5);
});

test('New calls do not cancel accepted replies, while reset clears pending replies and bubbles', () => {
  const g = loadGame(), chat = new g.CatConversation();
  const zouin = new g.Cat(0, 0), near = new g.Cat(40, 0);
  const events = [], audio = { meowDuration: 1, play: (kind, voice) => events.push({ kind, voice }) };
  chat.start(zouin, [near], audio);
  chat.accept(near);
  chat.start(zouin, [], audio);
  assert.equal(events.length, 2);
  chat.update(1.2);
  assert.equal(events.length, 3);
  chat.start(zouin, [near], audio); chat.accept(near);
  chat.reset(); chat.update(10);
  assert.equal(events.length, 4);
  assert.equal(zouin.meowRemaining, 0); assert.equal(near.meowRemaining, 0);
  assert.equal(near.chatPause, 0);
});

test('Web Audio resumes before playing the cached real recording, without synthesizing an oscillator', async () => {
  let resumed = 0, played = 0;
  const audio = new AudioFeedback();
  audio.unlocked = true;
  audio.ctx = { state: 'suspended', async resume() { resumed++; this.state = 'running'; } };
  audio.animalSounds = {
    buffer: { duration: 1.2 },
    load: async () => ({ duration: 1.2 }),
    async play(voice) { assert.equal(audio.ctx.state, 'running'); played++; assert.equal(voice, 3); return true; },
  };
  assert.equal(await audio.play('meow', 3), true);
  assert.equal(resumed, 1); assert.equal(played, 1);
  assert.equal(audio.meowDuration, 1.2);
  audio.ctx = null;
  assert.equal(await audio.playMeow(1), false);
});

test('Actual E handler ignores key repeat/pause, feeds without reply and replies on recruitment', () => {
  const g = loadGame();
  g.run(`
    gameState = 'running'; globalThis.key = 'e'; globalThis.keyCode = 69; globalThis.ESCAPE = 27;
    conversations = new CatConversation(); playerCat = new Cat(0, 0);
    strayCats = [new Cat(25, 0)]; followers = []; carriedFood = 1;
    globalThis.calls = [];
    audioFeedback = { meowDuration: 1, play: kind => calls.push(kind) };
    showToast = () => {}; createHearts = () => {}; createSparks = () => {};
    saveProgress = () => {}; triggerCombo = () => {}; extraGardenCats = () => [];
    keyPressed({repeat: true});
  `);
  assert.equal(g.run('calls.length'), 0);
  g.run('keyPressed({}); conversations.update(3)');
  assert.equal(g.run("calls.filter(kind => kind === 'meow').length"), 1);
  assert.equal(g.run('followers.length'), 0);
  g.run('keyPressed({}); conversations.update(1.2)');
  assert.equal(g.run('followers.length'), 1);
  assert.equal(g.run("calls.filter(kind => kind === 'meow').length"), 3);
  g.run('keyPressed({}); conversations.update(3)');
  assert.equal(g.run("calls.filter(kind => kind === 'meow').length"), 4);
  g.run("followers = []; keyPressed({}); gameState = 'paused'; keyPressed({})");
  assert.equal(g.run("calls.filter(kind => kind === 'meow').length"), 5);
});
