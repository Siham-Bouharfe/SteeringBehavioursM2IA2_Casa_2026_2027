const test = require('node:test');
const assert = require('node:assert/strict');
const { BabylonCityRenderer } = require('../babylonCityRenderer.js');

test('Babylon race debug keeps five live sensor rays per racer and disposes them when hidden', () => {
  const previousBabylon = global.BABYLON;
  const created = [];
  const updated = [];
  global.BABYLON = {
    Vector3: class {
      constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    },
    Color3: { FromHexString: color => color },
    MeshBuilder: {
      CreateLines(name, options) {
        if (options.instance) {
          options.instance.points = options.points;
          updated.push(options.instance);
          return options.instance;
        }
        const line = {
          name,
          points: options.points,
          disposed: false,
          dispose() { this.disposed = true; },
        };
        created.push(line);
        return line;
      },
    },
  };

  try {
    const renderer = Object.create(BabylonCityRenderer.prototype);
    renderer.scene = {};
    renderer.raceSensorMeshes = new Map();
    const cat = {
      pos: { x: 20, y: 40 },
      raceSensorReadings: Array.from({ length: 5 }, (_, index) => ({
        distance: index === 0 ? 20 : 100,
        end: { x: 100 + index, y: 200 + index },
      })),
    };

    renderer.syncRaceSensors([cat], true);
    assert.equal(created.length, 5);
    assert.equal(renderer.raceSensorMeshes.get(cat).length, 5);
    assert.deepEqual(
      { ...created[0].points[0] },
      { x: 20, y: 3, z: 40 }
    );
    assert.equal(created[0].color, '#ef6a54');
    assert.equal(created[1].color, '#ffe184');

    cat.pos.x = 25;
    renderer.syncRaceSensors([cat], true);
    assert.equal(updated.length, 5);
    assert.deepEqual(
      { ...created[0].points[0] },
      { x: 25, y: 3, z: 40 }
    );

    renderer.syncRaceSensors([cat], false);
    assert.equal(renderer.raceSensorMeshes.size, 0);
    assert.ok(created.every(line => line.disposed));
  } finally {
    global.BABYLON = previousBabylon;
  }
});
