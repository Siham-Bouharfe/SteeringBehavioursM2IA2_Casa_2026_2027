const test = require('node:test');
const assert = require('node:assert/strict');
const { chaseCameraAlpha, getChaseCameraProfile } = require('../babylonCityRenderer.js');

test('the chase camera azimuth always points to the side behind the cat', () => {
  const eastbound = chaseCameraAlpha(0);
  assert.ok(Math.abs(Math.abs(eastbound) - Math.PI) < 1e-12);

  const southbound = chaseCameraAlpha(Math.PI / 2);
  assert.ok(Math.abs(southbound + Math.PI / 2) < 1e-12);

  const westbound = chaseCameraAlpha(Math.PI);
  assert.ok(Math.abs(westbound) < 1e-12);
  assert.throws(() => chaseCameraAlpha(NaN), TypeError);
});

test('race camera closes in on the circuit while promenade keeps a wider city view', () => {
  const race = getChaseCameraProfile(true);
  const city = getChaseCameraProfile(false);
  assert.ok(race.radius < city.radius);
  assert.ok(race.lookAhead < city.lookAhead);
  assert.ok(race.beta < city.beta);
});
