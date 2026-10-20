const test = require('node:test');
const assert = require('node:assert/strict');
const { BabylonCityRenderer } = require('../babylonCityRenderer.js');
const { loadGame } = require('./helpers/gameHarness.cjs');

test('3D cats keep their pose without creating speech meshes when meowing', () => {
  const renderer = Object.create(BabylonCityRenderer.prototype);
  const node = { position: {}, rotation: {}, metadata: {} };
  let created = 0;
  renderer.createCatMesh = () => { created++; return node; };
  const cat = { pos: {x: 10, y: 20}, meowRemaining: 1, vel: {magSq: () => 0}, idlePhase: 0 };
  const meshes = new Map();
  renderer.syncMap([cat], meshes, 'cat', 1);
  renderer.syncMap([cat], meshes, 'cat', 2);
  assert.equal(created, 1);
  assert.equal(node.position.x, 10); assert.equal(node.position.z, 20);
  assert.equal(node.metadata.speech, undefined);
  assert.equal(renderer.syncSpeech, undefined);
  assert.equal(cat.meowRemaining, 1, 'Sound/behavior state is preserved');
});

test('2D fallback draws exactly the same cat whether or not it is meowing', () => {
  const g = loadGame();
  g.run(`
    globalThis.drawingContext = {};
    globalThis.CENTER = 'center'; globalThis.BOLD = 'bold';
    globalThis.drawCalls = [];
    for (const name of ['push', 'pop', 'translate', 'rotate', 'fill', 'noFill', 'stroke',
      'noStroke', 'strokeWeight', 'ellipse', 'circle', 'triangle', 'bezier', 'arc',
      'rect', 'text', 'textSize', 'textStyle', 'textAlign']) {
      globalThis[name] = (...args) => drawCalls.push([name, ...args]);
    }
    globalThis.catToDraw = new Cat(10, 20); Vehicle.debug = false;
    drawTownCat(catToDraw);
  `);
  const silent = g.run('JSON.stringify(drawCalls)');
  g.run('drawCalls = []; catToDraw.meowRemaining = 1; drawTownCat(catToDraw)');
  assert.equal(g.run('JSON.stringify(drawCalls)'), silent);
});
