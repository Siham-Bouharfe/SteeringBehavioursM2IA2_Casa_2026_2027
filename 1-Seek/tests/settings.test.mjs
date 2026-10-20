import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SeekSettings } = require('../settings.js');

test('applique les mêmes paramètres à tous les véhicules', () => {
  const settings = new SeekSettings(8, 0.45);
  const vehicles = [
    { maxSpeed: 1, maxForce: 1 },
    { maxSpeed: 2, maxForce: 2 },
  ];

  settings.applyTo(vehicles);

  assert.deepEqual(vehicles, [
    { maxSpeed: 8, maxForce: 0.45 },
    { maxSpeed: 8, maxForce: 0.45 },
  ]);

  const target = { maxSpeed: 3, maxForce: 0.1 };
  settings.applyTo(target);
  assert.deepEqual(target, { maxSpeed: 8, maxForce: 0.45 });
});

test('convertit les valeurs des curseurs en nombres', () => {
  const settings = new SeekSettings();

  settings.setMaxSpeed('12.5');
  settings.setMaxForce('0.35');

  assert.equal(settings.maxSpeed, 12.5);
  assert.equal(settings.maxForce, 0.35);
});

test('respecte les bornes demandées pour vitesse et force maximales', () => {
  const settings = new SeekSettings();

  settings.setMaxSpeed('-3');
  settings.setMaxForce('12');
  assert.equal(settings.maxSpeed, 0);
  assert.equal(settings.maxForce, 10);

  settings.setMaxSpeed('20');
  settings.setMaxForce('0');
  assert.equal(settings.maxSpeed, 20);
  assert.equal(settings.maxForce, 0);
});
