import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const folder = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(path.join(folder, 'tracks.js'), 'utf8'), context);

test('les trois circuits ont des tracés distincts et des lignes centrales fermées et échantillonnées', () => {
  const ids = ['monaco', 'singapore', 'abuDhabi'];
  const routes = ids.map(id => vm.runInContext(`createPresetCenterline('${id}', 1200, 800)`, context));
  for (let i = 0; i < routes.length; i++) {
    assert.equal(routes[i].length, vm.runInContext(`TRACK_PRESETS['${ids[i]}'].points.length * 5`, context));
  }
  const fingerprints = routes.map(route => route.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('|'));
  assert.equal(new Set(fingerprints).size, 3);
  for (const route of routes) {
    assert.ok(route.every(point => point.x > 0 && point.x < 1200 && point.y > 0 && point.y < 800));
  }
});

test('un identifiant de circuit inconnu est rejeté explicitement', () => {
  assert.throws(() => vm.runInContext("createPresetCenterline('unknown', 1200, 800)", context), /Circuit inconnu/);
});
