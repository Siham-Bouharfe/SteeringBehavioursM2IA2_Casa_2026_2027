// Vérification dans un vrai navigateur, y compris quand index.html est ouvert en file://.
// Usage : node 6-ObstacleAvoidance/tests/browserSmoke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const browser = process.env.MIAOUVILLE_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'miaouville-smoke-'));
const errors = [];
const warnings = [];
let processOutput = '';
let browserProcess;
let server;
let socket;
let nextId = 1;
const pending = new Map();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPort() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (fs.existsSync(portFile)) return Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    if (browserProcess.exitCode !== null) throw new Error(`Navigateur arrêté : ${processOutput}`);
    await wait(100);
  }
  throw new Error(`Port de débogage inaccessible : ${processOutput}`);
}

async function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`Commande Chrome expirée : ${method}`));
    }, 10000).unref();
  });
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function eventually(label, expression, predicate, attempts = 50) {
  let lastValue;
  for (let i = 0; i < attempts; i++) {
    const value = lastValue = await evaluate(expression);
    if (predicate(value)) return value;
    await wait(100);
  }
  throw new Error(`${label} : état non atteint (${JSON.stringify(lastValue)})`);
}

async function main() {
  assert.ok(fs.existsSync(browser), `Chrome introuvable : ${browser}`);
  const httpMode = process.argv.includes('--http');
  let pageUrl = pathToFileURL(path.join(root, 'index.html')).href;
  if (httpMode) {
    server = http.createServer((request, response) => {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
        response.writeHead(404).end();
        return;
      }
      const extension = path.extname(file);
      response.setHeader('Content-Type', {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary',
        '.mp3': 'audio/mpeg',
      }[extension] || 'application/octet-stream');
      fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    pageUrl = `http://127.0.0.1:${server.address().port}/index.html`;
  }
  browserProcess = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-extensions', '--window-size=1280,720', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    pageUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  browserProcess.stderr.on('data', chunk => { processOutput += chunk.toString(); });
  const port = await getPort();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find(target => target.type === 'page' && target.url === pageUrl);
  assert.ok(page, 'Page de Miaouville introuvable dans Chrome');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const action = pending.get(message.id);
      pending.delete(message.id);
      message.error ? action.reject(new Error(message.error.message)) : action.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') {
      warnings.push(message.params.args.map(arg => arg.description || arg.value).join(' '));
    }
  });
  await command('Runtime.enable');
  const ready = await eventually('Initialisation',
    '({player: !!globalThis.playerCat || (typeof playerCat !== "undefined" && !!playerCat), hud: !!document.getElementById("overlay-action"), canvas: !!document.querySelector("canvas"), fireflies: typeof fireflies !== "undefined" && fireflies.length})',
    value => value.player && value.hud && value.canvas && value.fireflies > 0);
  assert.ok(ready.player);
  assert.deepEqual(errors, [], 'Erreur pendant le chargement');
  if (httpMode) {
    const model = await eventually('Modèle GLB Babylon',
      '({ready: !!city3DRenderer?.ready, template: !!city3DRenderer?.catVisual?.template, rigged: !!city3DRenderer?.catVisual?.rigged, cats: city3DRenderer?.catMeshes?.size || 0, animated: Array.from(city3DRenderer?.catMeshes?.values() || []).filter(node => node.metadata?.animatedCat).length, upright: Array.from(city3DRenderer?.catMeshes?.values() || []).filter(node => node.getChildMeshes(false).some(mesh => mesh.name.includes("Cat") && mesh.parent?.name.includes("RootNode") && Math.abs(mesh.rotation.z) < 0.001)).length})',
      value => value.ready && value.template && value.rigged && value.cats > 0 && value.animated === value.cats && value.upright === value.cats, 70);
    assert.equal(model.animated, model.cats, 'Tous les chats doivent utiliser le modèle articulé');
  }
  await evaluate('document.getElementById("overlay-action").click()');
  await eventually('Démarrage balade', '({state: gameState, cats: strayCats.length})',
    value => value.state === 'running' && value.cats > 0);
  assert.equal(await evaluate('playerCat.name'), 'Zouin');
  await wait(350);
  if (httpMode) {
    const stance = await evaluate(`(() => {
      const visual = city3DRenderer.catMeshes.get(playerCat);
      const bone = name => visual.metadata.bones.get(name).node.getAbsolutePosition();
      const feet = ['L_Foot', 'R_Foot', 'L_BFoot', 'R_BFoot'].map(bone);
      const mesh = visual.getChildMeshes(false).find(part => part.name.includes('Cat'));
      return { headY: bone('Head').y, footHeights: feet.map(foot => foot.y),
        frontBack: Math.hypot(feet[0].x - feet[2].x, feet[0].z - feet[2].z),
        leftRight: Math.hypot(feet[0].x - feet[1].x, feet[0].z - feet[1].z),
        groundY: mesh.getBoundingInfo().boundingBox.minimumWorld.y };
    })()`);
    assert.ok(stance.footHeights.every(height => height >= 0 && height < 5),
      `Les quatre pattes doivent être proches du sol : ${JSON.stringify(stance)}`);
    assert.ok(stance.headY > Math.max(...stance.footHeights) + 10,
      'La tête doit rester au-dessus des pattes');
    assert.ok(stance.frontBack > 6 && stance.leftRight > 2,
      'Les quatre pattes doivent entourer le corps, pas se superposer');
    assert.ok(stance.groundY > -1 && stance.groundY < 2,
      'Le modèle doit toucher le niveau de la route');
  }
  if (process.argv.includes('--screenshot')) {
    const modelBounds = await evaluate(`(() => {
      const node = city3DRenderer.catMeshes.get(playerCat);
      const mesh = node?.getChildMeshes(false).find(part => part.name.includes('Cat'));
      const box = mesh?.getBoundingInfo().boundingBox;
      return { node: node?.name, parts: node?.getChildMeshes(false).length,
        enabled: mesh?.isEnabled(), visible: mesh?.isVisible,
        min: box?.minimumWorld.asArray(), max: box?.maximumWorld.asArray(),
        parentScale: mesh?.parent?.scaling.asArray(),
        joints: Object.fromEntries(['Head','L_Foot','R_Foot','L_BFoot','R_BFoot'].map(name =>
          [name, node?.metadata?.bones?.get(name)?.node?.getAbsolutePosition()?.asArray()])) };
    })()`);
    process.stdout.write(`Modèle : ${JSON.stringify(modelBounds)}\n`);
    await evaluate('noLoop()');
    await evaluate('city3DRenderer.scene.render()');
    await wait(250);
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    const imagePath = path.join(os.tmpdir(), 'miaouville-cat-browser-preview.png');
    fs.writeFileSync(imagePath, Buffer.from(screenshot.data, 'base64'));
    process.stdout.write(`Capture : ${imagePath}\n`);
    await evaluate('loop()');
  }
  const drive = await evaluate(`(() => {
    const x = CITY_WIDTH / 2, y = CITY_HEIGHT / 2;
    const run = (key, heading) => {
      playerCat.pos.set(x, y);
      playerCat.vel.set(0, 0);
      playerCat.acc.set(0, 0);
      playerCat.facingHeading = heading;
      keysDown.clear();
      keysDown.add(key);
      updatePlayer(1);
      return { dx: playerCat.pos.x - x, dy: playerCat.pos.y - y,
        heading: playerCat.facingHeading };
    };
    const result = {
      forward: run('arrowup', -Math.PI / 2),
      reverse: run('arrowdown', -Math.PI / 2),
      right: run('arrowright', -Math.PI / 2),
      left: run('arrowleft', -Math.PI / 2),
    };
    keysDown.clear();
    playerCat.pos.set(x, y);
    playerCat.vel.set(0, 0);
    playerCat.acc.set(0, 0);
    playerCat.facingHeading = -Math.PI / 2;
    return result;
  })()`);
  assert.ok(drive.forward.dy < 0 && Math.abs(drive.forward.dx) < 0.01,
    `Le chat n'avance pas selon son regard : ${JSON.stringify(drive)}`);
  assert.ok(drive.reverse.dy > 0 && drive.reverse.heading === drive.forward.heading,
    `Le recul retourne le chat : ${JSON.stringify(drive)}`);
  assert.ok(drive.right.heading > drive.forward.heading && drive.left.heading < drive.forward.heading,
    `Les virages ne suivent pas les touches : ${JSON.stringify(drive)}`);
  assert.ok(Math.abs(drive.right.dx) < 0.01 && Math.abs(drive.left.dy) < 0.01,
    'Les touches de virage seules ne doivent pas déplacer le chat');
  if (httpMode) {
    const facing = await evaluate(`(() => {
      const visual = city3DRenderer.catMeshes.get(playerCat);
      const head = visual.metadata.bones.get('Head').node;
      const check = heading => {
        city3DRenderer.catVisual.pose(visual, playerCat, frameCount, heading);
        city3DRenderer.scene.render();
        const point = head.getAbsolutePosition();
        return (point.x - playerCat.pos.x) * Math.cos(heading) +
          (point.z - playerCat.pos.y) * Math.sin(heading);
      };
      const forward = check(-Math.PI / 2);
      const right = check(0);
      check(playerCat.facingHeading);
      playerCat.vel.set(0, 1);
      playerCat.walkDirection = -1;
      visual.metadata.phase = 1;
      visual.metadata.lastFrame = frameCount - 1;
      city3DRenderer.catVisual.pose(visual, playerCat, frameCount, playerCat.facingHeading);
      const reversePhase = visual.metadata.phase;
      playerCat.vel.set(0, 0);
      playerCat.walkDirection = 0;
      return { forward, right, reversePhase };
    })()`);
    assert.ok(facing.forward > 5 && facing.right > 5,
      `Le modèle doit regarder dans le sens de la marche : ${JSON.stringify(facing)}`);
    assert.ok(facing.reversePhase < 1,
      `L'animation des pattes doit s'inverser au recul : ${JSON.stringify(facing)}`);
  }
  const followingFireflies = await evaluate('strayCats.filter(cat => cat.fireflyTargetId).length');
  assert.ok(followingFireflies > 0, 'Les chats doivent sélectionner des lucioles comme cibles de steering');

  const recording = await evaluate('audioFeedback.prepareMeows().then(buffer => ({duration: buffer?.duration || 0, samples: buffer?.length || 0}))');
  assert.ok(recording.duration > 0 && recording.samples > 1000, 'Le vrai MP3 doit être décodé dans Chrome');
  await evaluate(`{
    const target = strayCats[0];
    carriedFood = 0;
    target.pos.set(playerCat.pos.x + 25, playerCat.pos.y);
    window.__greetingTarget = target;
    audioFeedback.__meowCount = 0;
    const play = audioFeedback.play.bind(audioFeedback);
    const ctx = audioFeedback.ctx;
    window.__meowPeak = 0;
    if (ctx) {
      window.__meowAnalyser = ctx.createAnalyser();
      window.__meowAnalyser.fftSize = 256;
      audioFeedback.animalSounds.output.connect(window.__meowAnalyser);
      window.__recordedStarts = [];
      const createSource = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = () => {
        const node = createSource();
        const start = node.start.bind(node);
        node.start = (...args) => {
          if (node.buffer === audioFeedback.animalSounds.buffer) window.__recordedStarts.push(node.playbackRate.value);
          return start(...args);
        };
        return node;
      };
      window.__meowSampler = setInterval(() => {
        const samples = new Float32Array(256);
        window.__meowAnalyser.getFloatTimeDomainData(samples);
        window.__meowPeak = Math.max(window.__meowPeak, ...samples.map(Math.abs));
      }, 15);
    }
    audioFeedback.play = (kind, count) => {
      if (kind === 'meow') audioFeedback.__meowCount++;
      return play(kind, count);
    };
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'e', code: 'KeyE', bubbles: true, cancelable: true
    }));
  }`);
  const greeting = await evaluate('({ target: meowTargetCat === window.__greetingTarget, meows: audioFeedback.__meowCount })');
  assert.ok(greeting.target, 'E près d’un chat doit déclencher son salut');
  assert.equal(greeting.meows, 1, 'E près d’un chat doit jouer le miaou');
  if (httpMode) {
    assert.equal(await evaluate('city3DRenderer.scene.meshes.some(node => node.name.startsWith("speech-"))'), false,
      'Aucune bulle de miaou ne doit apparaître');
  }
  const reply = await eventually('Réponse du chat et signal audio',
    '({count: audioFeedback.__meowCount, peak: window.__meowPeak, replied: conversations.replied, recorded: window.__recordedStarts, accepted: followers.includes(window.__greetingTarget)})',
    value => value.count === 2 && value.peak > 0.00001 && value.replied && value.recorded.length === 2 && value.accepted, 100);
  assert.ok(reply.peak > 0.00001, 'Les miaous doivent produire un vrai signal Web Audio');
  assert.equal(reply.recorded[0], 1, 'Zouin joue l’enregistrement original');
  assert.ok(reply.recorded[1] > 1, 'Le chat accepté répond avec un timbre différent');
  if (httpMode) assert.equal(await evaluate('city3DRenderer.scene.meshes.some(node => node.name.startsWith("speech-"))'), false,
    'La réponse doit également rester sonore, sans bulle');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'e', code: 'KeyE', repeat: true, bubbles: true}));`);
  assert.equal(await evaluate('audioFeedback.__meowCount'), 2, 'Un maintien de E ne doit pas boucler les miaous');
  await evaluate('clearInterval(window.__meowSampler)');
  await eventually('Fin du salut', 'window.__greetingTarget.chatPause === 0', value => value, 100);
  assert.deepEqual(errors, [], 'Erreur pendant la balade');

  await evaluate(`{
    followers.push(...strayCats.splice(0, Math.max(0, 2 - followers.length)));
    followers.forEach((cat, index) => {
      cat.pos.set(playerCat.pos.x + (index ? -55 : 60), playerCat.pos.y + 25);
      cat.vel.set(0, 0);
      cat.acc.set(0, 0);
    });
  }`);
  const nearbyBefore = await eventually('Wander près de Minette',
    'followers.map(cat => ({active: cat.nearMinetteWander, angle: cat.wanderTheta}))',
    value => value.length === 2 && value.every(cat => cat.active));
  await wait(650);
  const nearbyAfter = await evaluate(`followers.map(cat => ({
    active: cat.nearMinetteWander, angle: cat.wanderTheta,
    distance: p5.Vector.dist(cat.pos, playerCat.pos), speed: cat.vel.mag()
  }))`);
  assert.ok(nearbyAfter.every((cat, index) => cat.active && cat.distance < 155 &&
    cat.speed > 0.01 && Math.abs(cat.angle - nearbyBefore[index].angle) > 0.001),
    `Les chats proches doivent explorer avec wander : ${JSON.stringify(nearbyAfter)}`);
  if (httpMode) {
    const coats = await evaluate(`Array.from(city3DRenderer.catMeshes.values()).map(visual => {
      const material = visual.getChildMeshes(false).find(mesh => mesh.name.includes('Cat')).material;
      return { color: material.albedoColor.toHexString(), glow: material.emissiveColor.r,
        texture: !!material.albedoTexture, metallic: material.metallic };
    })`);
    assert.ok(coats.every(coat => coat.glow > 0.05 && coat.glow < 0.2 && coat.texture && coat.metallic === 0),
      `Les pelages doivent rester lisibles et texturés : ${JSON.stringify(coats)}`);
    assert.ok(new Set(coats.map(coat => coat.color)).size >= 4, 'Les chats doivent avoir des pelages distincts');
    if (process.argv.includes('--screenshot')) {
      const capture = await command('Page.captureScreenshot', { format: 'png' });
      const imagePath = path.join(os.tmpdir(), 'miaouville-cat-wander-preview.png');
      fs.writeFileSync(imagePath, Buffer.from(capture.data, 'base64'));
      process.stdout.write(`Capture wander : ${imagePath}\n`);
    }
  }
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowUp', code: 'ArrowUp', bubbles: true, cancelable: true
  }))`);
  await eventually('Reprise du suivi', 'followers.every(cat => !cat.nearMinetteWander)', value => value === true);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'ArrowUp', code: 'ArrowUp', bubbles: true, cancelable: true
  }))`);

  const inheritance = await evaluate(`({
    food: foodItems.every(item => item instanceof Vehicle),
    moths: vacuumPatrollers.every(item => item instanceof Vehicle),
    trees: trees.every(item => item instanceof Vehicle)
  })`);
  assert.ok(inheritance.food && inheritance.moths && inheritance.trees);
  await evaluate(`document.getElementById('zouin-notebook').open = true;
    document.querySelector('[data-garden-mission="escort"]').click();`);
  const escort = await eventually('Mission escorte depuis le carnet',
    '({kind: gardenMissions.active?.kind, vehicle: gardenMissions.active?.cat instanceof Vehicle, marker: !!gardenMissions.active?.beacon})',
    value => value.kind === 'escort' && value.vehicle && value.marker);
  assert.ok(escort.vehicle);
  await evaluate(`playerCat.pos.set(1800, 1250); playerCat.vel.set(0, 0);
    window.__escortStart = gardenMissions.active.cat.pos.copy();`);
  await eventually('Pompon avance avec le suivi de chemin',
    'p5.Vector.dist(gardenMissions.active.cat.pos, window.__escortStart)', value => value > 1, 100);
  if (httpMode) assert.ok(await evaluate('city3DRenderer.catMeshes.has(gardenMissions.active.cat) && city3DRenderer.beaconMeshes.size === 1'));
  await evaluate('document.getElementById("cancel-garden-mission").click()');
  assert.equal(await evaluate('gardenMissions.active'), null);

  await evaluate(`document.querySelector('[data-garden-mission="lost"]').click();
    carriedFood = 0;
    playerCat.pos.set(gardenMissions.active.cat.pos.x + 30, gardenMissions.active.cat.pos.y);
    playerCat.vel.set(0, 0);
    conversations.reset();
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'e',code:'KeyE',bubbles:true}));
    document.dispatchEvent(new KeyboardEvent('keyup', {key:'e',code:'KeyE',bubbles:true}));`);
  await eventually('Recrutement du chat perdu', 'gardenMissions.active?.stage', value => value === 'home');
  const coinsBeforeRescue = await evaluate('coins');
  await evaluate(`gardenMissions.active.cat.pos.set(extractionZone.pos.x, extractionZone.pos.y - 30);
    playerCat.pos.set(extractionZone.pos.x, extractionZone.pos.y); playerCat.vel.set(0,0);`);
  await eventually('Récompense du chat perdu', 'gardenMissions.completed.lost', value => value === 1);
  assert.ok(await evaluate('coins') >= coinsBeforeRescue + 140);
  await evaluate(`document.querySelector('[data-garden-mission="escape"]').click();`);
  await eventually('Mission esquive', 'gardenMissions.active?.kind', value => value === 'escape');
  await evaluate('gardenMissions.active.hits = 3');
  await eventually('Fin de mission sans bloquer le jeu', '({active: !!gardenMissions.active, state: gameState})',
    value => !value.active && value.state === 'running');

  await evaluate(`startGame();
    window.__otherBrainsBefore = JSON.stringify(strayCats.map(cat => cat.raceBrain || null));
    document.getElementById('training-cat').value = 'player';
    document.getElementById('train-personal-brain').click();`);
  await eventually('Entraînement individuel lancé par le bouton', '!!personalTraining || personalTrainingQueue.length > 0', value => value);
  await evaluate(`noLoop();
    for (let batch = 0; batch < 3000 && (personalTraining || personalTrainingQueue.length); batch++) processPersonalTraining();
    loop();`);
  const training = await evaluate(`({
    trials: savedRaceLearning.player?.trainingTrials,
    unchangedOthers: window.__otherBrainsBefore === JSON.stringify(strayCats.map(cat => cat.raceBrain || null)),
    saved: !!JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)).brains.player,
    done: !personalTraining && !personalTrainingQueue.length
  })`);
  assert.equal(training.trials, 12);
  assert.ok(training.done && training.unchangedOthers && training.saved, JSON.stringify(training));
  if (process.argv.includes('--screenshot')) {
    await evaluate('document.getElementById("zouin-notebook").open = true; updateNotebook()');
    const capture = await command('Page.captureScreenshot', { format: 'png' });
    const imagePath = path.join(os.tmpdir(), 'zouin-notebook-preview.png');
    fs.writeFileSync(imagePath, Buffer.from(capture.data, 'base64'));
    process.stdout.write(`Capture carnet : ${imagePath}\n`);
    await evaluate('document.getElementById("zouin-notebook").open = false');
  }

  await evaluate('startCatRace()');
  await eventually('Départ course', '({state: gameState, racers: raceParticipants.length, brains: raceParticipants.filter(c => !!c.raceBrain).length})',
    value => value.state === 'raceCountdown' && value.racers > 1 && value.brains === value.racers);
  const raceSetup = await evaluate(`({
    racers: raceParticipants.length,
    speeds: [...new Set(raceParticipants.map(cat => cat.raceMaxSpeed))],
    brains: new Set(raceParticipants.map(cat => JSON.stringify(cat.raceBrain))).size
  })`);
  assert.equal(raceSetup.speeds.length, 1, 'La grille doit donner la même vitesse à tous les coureurs');
  assert.equal(raceSetup.brains, raceSetup.racers, 'Chaque chat doit commencer avec un cerveau indépendant');
  await evaluate(`raceParticipants.forEach(cat => {
    const predict = cat.raceBrain.predict.bind(cat.raceBrain);
    cat.__brainCalls = 0;
    cat.raceBrain.predict = inputs => { cat.__brainCalls++; return predict(inputs); };
  })`);
  await evaluate('raceCountdown = 0.01');
  await wait(150);
  const before = await evaluate('raceParticipants.map(c => ({x: c.pos.x, y: c.pos.y}))');
  const legsBefore = httpMode ? await evaluate(`raceParticipants.map(cat => {
    const node = city3DRenderer.catMeshes.get(cat);
    const entry = node?.metadata?.bones.get('L_Leg_Upper');
    return { speed: cat.vel.mag(), phase: node?.metadata?.phase,
      rotation: entry?.bone.getRotationQuaternion(BABYLON.Space.LOCAL).asArray(),
      linked: entry?.bone.getTransformNode()?.rotationQuaternion?.asArray() };
  })`) : null;
  await wait(1200);
  const after = await evaluate('raceParticipants.map(c => ({x: c.pos.x, y: c.pos.y}))');
  const legsAfter = httpMode ? await evaluate(`raceParticipants.map(cat => {
    const node = city3DRenderer.catMeshes.get(cat);
    const entry = node?.metadata?.bones.get('L_Leg_Upper');
    return { speed: cat.vel.mag(), phase: node?.metadata?.phase,
      rotation: entry?.bone.getRotationQuaternion(BABYLON.Space.LOCAL).asArray(),
      linked: entry?.bone.getTransformNode()?.rotationQuaternion?.asArray() };
  })`) : null;
  const brainCalls = await evaluate('raceParticipants.map(c => c.__brainCalls)');
  if (httpMode) {
    const modeledRacers = await evaluate('raceParticipants.filter(cat => city3DRenderer.catMeshes.get(cat)?.metadata?.animatedCat).length');
    assert.equal(modeledRacers, after.length, 'Tous les coureurs doivent garder le modèle articulé');
    const independentRigs = await evaluate(`new Set(raceParticipants.map(cat =>
      city3DRenderer.catMeshes.get(cat).metadata.bones.get('L_Leg_Upper').node)).size`);
    assert.equal(independentRigs, after.length, 'Chaque chat doit avoir son propre squelette');
    const walking = legsAfter.filter((leg, index) => leg.speed > 0.1 &&
      leg.phase > legsBefore[index].phase &&
      leg.rotation.some((value, axis) => Math.abs(value - legsBefore[index].rotation[axis]) > 0.001)).length;
    if (walking <= 1) process.stderr.write(`Marche avant/après : ${JSON.stringify({ before: legsBefore, after: legsAfter })}\n`);
    assert.ok(walking > 1, `Les pattes de seulement ${walking} chat(s) bougent pendant la course`);
    const supports = await evaluate(`raceParticipants.map(cat => {
      const bones = city3DRenderer.catMeshes.get(cat).metadata.bones;
      return ['L_Foot', 'R_Foot', 'L_BFoot', 'R_BFoot']
        .map(name => bones.get(name).node.getAbsolutePosition().y);
    })`);
    assert.ok(supports.every(feet => feet.filter(height => height < 5).length >= 2),
      `Des chats courent sans pattes proches du sol : ${JSON.stringify(supports)}`);
  }
  const networkStatus = await evaluate('document.getElementById("race-brain-status").textContent');
  const moved = after.filter((point, index) => Math.hypot(point.x - before[index].x, point.y - before[index].y) > 0.5).length;
  assert.ok(moved > 1, `La course n'anime que ${moved} chat(s)`);
  assert.ok(brainCalls.every(count => count > 0), `Réseaux neuronaux non utilisés : ${brainCalls}`);
  assert.match(networkStatus, /RÉSEAUX ACTIFS · \d+\/\d+/);

  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'd', code: 'KeyD', bubbles: true, cancelable: true
  }))`);
  const debugView = await eventually('Mode capteurs',
    '({enabled: raceDebugEnabled, hidden: document.getElementById("race-debug-panel").hidden})',
    value => value.enabled && !value.hidden);
  await wait(150);
  const debugProof = await evaluate(`({
    inputs: document.getElementById("race-debug-inputs").textContent,
    mode: document.getElementById("race-debug-mode").textContent,
    neural: playerCat.raceBrainActive,
    dIsDriving: keysDown.has("d")
  })`);
  assert.ok(debugView.enabled);
  assert.match(debugProof.inputs, /\d\.\d{2}/, 'Les entrées du réseau doivent être visibles');
  assert.match(debugProof.mode, /PILOTAGE 100 % NEURONAL/);
  assert.ok(debugProof.neural, 'D ne doit pas remplacer le pilotage du réseau par une commande manuelle');
  assert.equal(debugProof.dIsDriving, false);
  const sensorMeshCount = await evaluate(`city3DRenderer?.ready
    ? Array.from(city3DRenderer.raceSensorMeshes.values()).reduce((total, lines) => total + lines.length, 0)
    : null`);
  if (sensorMeshCount !== null) {
    assert.ok(sensorMeshCount >= brainCalls.length * 5,
      `Le rendu 3D devrait montrer cinq rayons par chat : ${sensorMeshCount} maillages`);
  }
  assert.deepEqual(errors, [], 'Erreur pendant la course');
  if (httpMode) assert.ok(!warnings.some(message => /skeleton node is not a common root/i.test(message)),
    `Le modèle conserve une racine de squelette invalide : ${warnings.join('; ')}`);
  const debugRenderer = sensorMeshCount === null ? 'rendu 2D' : `${sensorMeshCount} rayons 3D`;
  const previousWatched = await evaluate('watchedRacer.name');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Tab',code:'Tab',bubbles:true,cancelable:true}))`);
  assert.notEqual(await evaluate('watchedRacer.name'), previousWatched);
  const finish = await evaluate(`(() => {
    noLoop();
    const base = raceElapsed;
    for (let frame = 1; frame < 2600 && raceParticipants.some(cat => cat.raceFinishedAt === null); frame++) {
      raceElapsed = base + frame / 60;
      for (const cat of raceParticipants) if (cat.raceFinishedAt === null) updateRacer(cat, 1);
    }
    const result = {finished: raceParticipants.filter(cat => cat.raceFinishedAt !== null && !cat.raceCrashed).length,
      crashed: raceParticipants.filter(cat => cat.raceCrashed).length};
    finishCatRace();
    result.state = gameState;
    result.trainingQueued = personalTrainingQueue.length;
    result.records = Object.values(savedRaceLearning).filter(record => record.races > 0).length;
    loop();
    return result;
  })()`);
  assert.equal(finish.finished, after.length, JSON.stringify(finish));
  assert.equal(finish.crashed, 0);
  assert.equal(finish.state, 'results');
  assert.equal(finish.trainingQueued, after.length);
  assert.equal(finish.records, after.length);
  assert.deepEqual(errors, [], 'Erreur pendant les missions, entraînements ou résultats');
  process.stdout.write(`Navigateur OK (${httpMode ? 'HTTP + modèle GLB' : 'file:// + chat de secours'}) : Zouin, deux vrais miaous MP3 (${recording.duration.toFixed(2)} s) avec signal audio et réponse après recrutement, aucune bulle, trois missions, entraînement privé (${training.trials} essais), ${finish.finished}/${after.length} chats à l’arrivée exclusivement neuronale, caméra TAB, ${debugRenderer}, sauvegarde, aucune exception.\n`);
}

main().catch(error => { console.error(error, errors, warnings, processOutput.slice(-2000)); process.exitCode = 1; })
  .finally(async () => {
    if (socket?.readyState === WebSocket.OPEN) {
      try { await command('Browser.close'); } catch (_) { /* Fermeture déjà engagée. */ }
      socket.close();
    }
    if (browserProcess?.exitCode === null) browserProcess.kill();
    server?.close();
    await wait(400);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
    } catch (error) {
      console.warn(`Profil temporaire non supprimé (${profile}) : ${error.message}`);
    }
  });
