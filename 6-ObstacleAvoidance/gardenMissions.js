class GardenMissions {
  constructor() { this.active = null; this.completed = { lost: 0, escort: 0, escape: 0 }; }

  start(kind, world) {
    if (this.active || !['lost', 'escort', 'escape'].includes(kind)) return false;
    const active = { kind, elapsed: 0, hits: 0, limit: 150, stage: 'meet' };
    if (kind === 'lost') {
      active.cat = world.strays.filter(cat => !world.followers.includes(cat))
        .sort((a, b) => p5.Vector.dist(a.pos, world.player.pos) - p5.Vector.dist(b.pos, world.player.pos))[0];
      if (!active.cat) return false;
      active.title = `Chat perdu · ${active.cat.name}`;
      active.beacon = new MissionBeacon(active.cat.pos.x, active.cat.pos.y, active.cat.name);
    } else if (kind === 'escort') {
      const points = [createVector(1800, 1200), createVector(2400, 1200),
        createVector(2400, 1800), createVector(1800, 1800), world.refuge.pos.copy()];
      active.cat = new EscortCat(points);
      active.title = 'Escorte · le chemin de Pompon';
      active.beacon = new MissionBeacon(points[0].x, points[0].y, 'Pompon');
      active.limit = 180;
    } else {
      const pos = world.player.pos;
      active.moth = new ShadowMoth([createVector(pos.x, Math.max(30, pos.y - 200)),
        createVector(pos.x + 100, Math.max(30, pos.y - 200))], 99);
      active.moth.missionPursuer = true;
      world.moths.push(active.moth);
      active.limit = world.difficulty === 'hard' ? 32 : world.difficulty === 'easy' ? 18 : 25;
      active.title = 'Esquive · la ronde des ombres';
      active.beacon = new MissionBeacon(pos.x, pos.y, 'Reste en mouvement');
    }
    this.active = active;
    return true;
  }

  cancel(world) {
    if (this.active?.moth) {
      const index = world.moths.indexOf(this.active.moth);
      if (index >= 0) world.moths.splice(index, 1);
    }
    this.active = null;
  }

  tick(seconds, world) {
    const active = this.active;
    if (!active) return null;
    active.elapsed += seconds;
    if (active.kind === 'lost') {
      if (world.followers.includes(active.cat)) active.stage = 'home';
      const target = active.stage === 'home' ? world.refuge.pos : active.cat.pos;
      active.beacon.pos.set(target.x, target.y);
      active.hint = active.stage === 'home' ? `Ramène ${active.cat.name} au refuge au sud` : `Trouve ${active.cat.name}, puis appuie sur E`;
      if (active.stage === 'home' && p5.Vector.dist(world.player.pos, world.refuge.pos) < world.refuge.r + 16 &&
          p5.Vector.dist(active.cat.pos, world.refuge.pos) < 155) return this.finish(world, true);
    } else if (active.kind === 'escort') {
      active.cat.escort(world.player, world.obstacles, [world.player, ...world.followers]);
      active.cat.update();
      const nearby = p5.Vector.dist(active.cat.pos, world.player.pos) < 240;
      active.hint = nearby ? 'Accompagne Pompon sur le sentier lumineux' : 'Rejoins Pompon : il t’attend';
      active.beacon.pos.set(active.cat.pos.x, active.cat.pos.y);
      if (p5.Vector.dist(active.cat.pos, world.refuge.pos) < 45 && nearby) return this.finish(world, true);
    } else {
      active.hint = `Tiens encore ${Math.max(0, Math.ceil(active.limit - active.elapsed))} s · ${Math.max(0, 3 - active.hits)} chances`;
      active.beacon.pos.set(active.moth.pos.x, active.moth.pos.y);
      if (active.hits >= 3) return this.finish(world, false);
      if (active.elapsed >= active.limit) return this.finish(world, true);
    }
    if (active.kind !== 'escape' && active.elapsed >= active.limit) return this.finish(world, false);
    return null;
  }

  finish(world, success) {
    const active = this.active;
    const reward = success ? { lost: 140, escort: 180, escape: 160 }[active.kind] : 0;
    if (success) this.completed[active.kind]++;
    if (success && active.kind === 'lost') {
      const index = world.followers.indexOf(active.cat);
      if (index >= 0) world.followers.splice(index, 1);
    }
    const result = { success, reward, kind: active.kind, cat: active.cat,
      message: success ? `${active.title} réussi ! +${reward} pièces` : `${active.title} terminé sans récompense. Tu peux réessayer.` };
    this.cancel(world);
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GardenMissions };
