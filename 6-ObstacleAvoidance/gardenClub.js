function gardenWorld() {
  return { player: playerCat, strays: strayCats, followers, refuge: extractionZone,
    moths: vacuumPatrollers, obstacles: cityObstacles, difficulty: raceDifficulty };
}

function extraGardenCats() {
  return gardenMissions?.active?.kind === 'escort' ? [gardenMissions.active.cat] : [];
}

function prepareTownCat(cat, dt) {
  if (cat.chatPause > 0) {
    cat.applyForce(cat.arrive(cat.pos));
    finishTownCatStep(cat);
    return true;
  }
  const radius = cat.dna?.dangerRadius || 130;
  const threat = vacuumPatrollers.filter(moth => moth.hitCooldown <= 0 && p5.Vector.dist(cat.pos, moth.pos) < radius)
    .sort((a, b) => p5.Vector.dist(cat.pos, a.pos) - p5.Vector.dist(cat.pos, b.pos))[0];
  cat.evading = !!threat;
  if (!threat) return false;
  cat.nearMinetteWander = false;
  const evade = GardenBehaviors.evade(cat, threat, 10);
  cat.targetDirection = evade.copy().normalize();
  const target = cat.pos.copy().add(cat.targetDirection.copy().mult(70));
  const force = GameRules.composeSteering([
    { force: evade, weight: cat.dna?.dangerWeight || 1.8 },
    { force: cat.avoid(cityObstacles, cat.targetDirection, target, true), weight: 3 },
    { force: cat.separation([...followers, ...strayCats, playerCat], 35), weight: 1 },
  ], cat.maxForce);
  cat.applyForce(createVector(force.x, force.y));
  finishTownCatStep(cat);
  return true;
}

function startGardenMission(kind) {
  if (gameState !== 'running') return false;
  const started = gardenMissions.start(kind, gardenWorld());
  if (started) {
    showToast(`${gardenMissions.active.title} · suis le repère doré sur le radar`);
    document.getElementById('zouin-notebook').open = false;
  } else showToast('Une mission est déjà en cours, ou aucun chat perdu n’est disponible.');
  updateNotebook();
  return started;
}

function updateGardenMission(dt) {
  const result = gardenMissions?.tick(Math.max(0, dt) / 60, gardenWorld());
  if (!result) return;
  coins += result.reward;
  if (result.success && result.cat?.dna) savedCatTraits[result.cat.name] = GardenGenetics.mutate(result.cat.dna);
  audioFeedback?.play(result.success ? 'victory' : 'danger');
  showToast(result.message);
  saveProgress();
  updateNotebook();
}

function cancelPersonalTraining() {
  personalTraining = null;
  personalTrainingQueue = [];
}

function queuePersonalTraining(cats, automatic) {
  cancelPersonalTraining();
  const unique = [...new Set(cats)];
  for (const cat of unique) {
    const key = raceBrainKey(cat, playerCat);
    if (!savedRaceBrains[key]) savedRaceBrains[key] = (cat.raceBrain || new CatRaceNetwork()).copy();
    if (!savedRaceLearning[key]) savedRaceLearning[key] = {
      races: 0, generation: 0, bestFitness: null, difficulty: raceDifficulty, mutationRate: 0.06,
    };
    personalTrainingQueue.push({ cat, key, difficulty: raceDifficulty, automatic });
  }
  if (!automatic) showToast('Entraînement lancé : le jardin reste jouable pendant les essais.');
}

function processPersonalTraining() {
  if (!personalTraining && personalTrainingQueue.length) {
    const item = personalTrainingQueue.shift();
    personalTraining = new PersonalTraining(item.cat, new CatRaceNetwork(savedRaceBrains[item.key]), raceTrack,
      item.difficulty, { populationSize: item.automatic ? 4 : 6, generations: item.automatic ? 1 : 2 });
    personalTraining.key = item.key;
  }
  if (!personalTraining) return;
  const job = personalTraining;
  const deadline = performance.now() + 4;
  do { job.step(24); } while (!job.done && performance.now() < deadline);
  if (!job.done) return;
  const record = savedRaceLearning[job.key];
  savedRaceBrains[job.key] = job.champion.copy();
  job.cat.raceBrain = job.champion.copy();
  record.trainingTrials = (record.trainingTrials || 0) + job.trials;
  record.trainingGenerations = (record.trainingGenerations || 0) + job.generation;
  record.trainingFitness = job.bestFitness;
  if (job.bestLap !== null) record.bestLap = Math.min(record.bestLap || Infinity, job.bestLap);
  record.history = [...(Array.isArray(record.history) ? record.history.slice(-4) : []),
    { trials: job.trials, lap: job.bestLap, difficulty: job.difficulty }];
  personalTraining = null;
  saveProgress();
  if (!personalTrainingQueue.length) showToast('Entraînement terminé : chaque chat garde son meilleur cerveau personnel.');
  updateNotebook();
}

function updateNotebook() {
  const select = document.getElementById('training-cat');
  if (!select || !playerCat) return;
  const cats = [...new Set([playerCat, ...followers, ...strayCats, ...raceParticipants])];
  const signature = cats.map(cat => raceBrainKey(cat, playerCat)).join('|');
  if (select.dataset.signature !== signature) {
    const previous = select.value;
    select.replaceChildren(...cats.map(cat => {
      const option = document.createElement('option');
      option.value = raceBrainKey(cat, playerCat);
      option.textContent = cat.name;
      return option;
    }));
    select.dataset.signature = signature;
    if (cats.some(cat => raceBrainKey(cat, playerCat) === previous)) select.value = previous;
  }
  const record = savedRaceLearning[select.value];
  const cat = cats.find(item => raceBrainKey(item, playerCat) === select.value);
  document.getElementById('personal-learning-record').textContent =
    `${record?.races || 0} course(s) · ${record?.trainingTrials || 0} essais privés\n` +
    `${record?.trainingGenerations || 0} générations d’entraînement · meilleur tour : ${record?.bestLap ? record.bestLap.toFixed(2) + ' s' : 'à établir'}` +
    (cat?.dna ? `\nTempérament : ${cat.dna.foodWeight > 0.75 ? 'gourmand' : 'curieux'}, ${cat.dna.dangerRadius > 130 ? 'prudent' : 'audacieux'} · lignée ${cat.dna.generation}` : '');
  const active = gardenMissions?.active;
  const medals = gardenMissions ? Object.values(gardenMissions.completed).reduce((sum, n) => sum + n, 0) : 0;
  document.getElementById('garden-mission-note').textContent = active
    ? `${active.title} · ${active.hint || 'Rejoins le repère doré'}` : `${medals} mission(s) accomplie(s). Choisis ta prochaine aventure.`;
  document.querySelectorAll('[data-garden-mission]').forEach(button => { button.disabled = gameState !== 'running' || !!active; });
  document.getElementById('cancel-garden-mission').hidden = !active;
  document.getElementById('train-personal-brain').disabled = gameState !== 'running' || !!personalTraining || personalTrainingQueue.length > 0;
  document.getElementById('cancel-personal-training').hidden = !personalTraining && !personalTrainingQueue.length;
  document.getElementById('personal-training-status').textContent = personalTraining
    ? `${personalTraining.cat.name} : essai ${personalTraining.trials + 1} / ${personalTraining.populationSize * personalTraining.generations} · ${personalTrainingQueue.length} chat(s) en attente`
    : 'Cerveaux indépendants · entraînement automatique après chaque course';
}
