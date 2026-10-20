/**
 * UIManager.js
 * Synchronizes HTML DOM overlay elements with current game state:
 * - HUD top-bar (Mode name, live statistics)
 * - Mode specific side-panels (Evo sliders, Race speed multiplier & graph)
 * - Toasts and alerts
 */
class UIManager {
  constructor() {
    this.menuOverlay = document.getElementById('menu-overlay');
    this.ingameHud   = document.getElementById('ingame-hud');
    this.modeName    = document.getElementById('hud-mode-name');
    this.hudStat     = document.getElementById('hud-stat');
    this.btnBack     = document.getElementById('btn-back');

    this.cityInfo    = document.getElementById('city-info');
    this.evoPanel    = document.getElementById('evo-panel');
    this.evoStats    = document.getElementById('evo-stats');
    this.racePanel   = document.getElementById('race-panel');
    this.toastContainer = document.getElementById('toast-container');

    this.initEvents();
  }

  initEvents() {
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        if (typeof showMenu === 'function') showMenu();
      });
    }

    // Evo Sliders
    const foodSlider = document.getElementById('food-rate');
    const poisonSlider = document.getElementById('poison-rate');
    if (foodSlider) {
      foodSlider.addEventListener('input', (e) => {
        if (window.evoMode) window.evoMode.foodRate = parseFloat(e.target.value);
        const valEl = document.getElementById('food-rate-val');
        if (valEl) valEl.innerText = e.target.value;
      });
    }
    if (poisonSlider) {
      poisonSlider.addEventListener('input', (e) => {
        if (window.evoMode) window.evoMode.poisonRate = parseFloat(e.target.value);
        const valEl = document.getElementById('poison-rate-val');
        if (valEl) valEl.innerText = e.target.value;
      });
    }

    // Race Speed Buttons
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const spd = parseInt(btn.dataset.speed, 10);
        if (window.raceMode) {
          window.raceMode.speedMultiplier = spd;
          this.showToast(`Vitesse de simulation : ${spd}x`);
        }
      });
    });
  }

  setMode(mode) {
    if (mode === 'menu') {
      if (this.menuOverlay) this.menuOverlay.classList.remove('hidden');
      if (this.ingameHud)   this.ingameHud.classList.remove('visible');
      if (this.cityInfo)    this.cityInfo.classList.remove('visible');
      if (this.evoPanel)    this.evoPanel.classList.remove('visible');
      if (this.evoStats)    this.evoStats.classList.remove('visible');
      if (this.racePanel)   this.racePanel.classList.remove('visible');
    } else {
      if (this.menuOverlay) this.menuOverlay.classList.add('hidden');
      if (this.ingameHud)   this.ingameHud.classList.add('visible');

      if (this.cityInfo)  this.cityInfo.classList.toggle('visible', mode === 'city');
      if (this.evoPanel)  this.evoPanel.classList.toggle('visible', mode === 'evo');
      if (this.evoStats)  this.evoStats.classList.toggle('visible', mode === 'evo');
      if (this.racePanel) this.racePanel.classList.toggle('visible', mode === 'race');

      if (mode === 'city') {
        this.modeName.innerText = '🏙️ Ville — Chaos Urbain';
        this.modeName.style.color = 'var(--cyan)';
      } else if (mode === 'evo') {
        this.modeName.innerText = '🧬 Évolution — Sélection Naturelle';
        this.modeName.style.color = 'var(--green)';
      } else if (mode === 'race') {
        this.modeName.innerText = '🏎️ Course — Neuroévolution IA';
        this.modeName.style.color = 'var(--magenta)';
      }
    }
  }

  update(currentMode, modeInstance) {
    if (!modeInstance) return;

    if (currentMode === 'city') {
      if (this.hudStat) {
        this.hudStat.innerText = `SCORE : ${modeInstance.score} PTS | CITOYENS : ${modeInstance.civilians.length} | BOIDS : ${modeInstance.flock.boids.length}`;
      }
    } else if (currentMode === 'evo') {
      const stats = modeInstance.stats;
      if (this.hudStat) {
        this.hudStat.innerText = `POPULATION : ${stats.popCount} | SANTÉ MOY : ${(stats.avgHealth * 100).toFixed(0)}%`;
      }
      this.updateEvoStats(stats);
    } else if (currentMode === 'race') {
      const alive = modeInstance.cars.filter(c => !c.dead).length;
      if (this.hudStat) {
        this.hudStat.innerText = `GÉNÉRATION : ${modeInstance.generation} | VIVANTES : ${alive} / ${modeInstance.populationSize} | RECORD : ${modeInstance.bestScoreEver} CP`;
      }
      this.renderRaceGraph(modeInstance.historyScores);
    }
  }

  updateEvoStats(stats) {
    const barHealth = document.getElementById('stat-health');
    const barFood   = document.getElementById('stat-food');
    const barPoison = document.getElementById('stat-poison');

    if (barHealth) barHealth.style.width = `${Math.min(100, Math.max(0, stats.avgHealth * 100))}%`;
    if (barFood) {
      // Map [-2, 2] to [0, 100]%
      const norm = ((stats.avgFoodWeight + 2) / 4) * 100;
      barFood.style.width = `${Math.min(100, Math.max(0, norm))}%`;
    }
    if (barPoison) {
      const norm = ((stats.avgPoisonWeight + 2) / 4) * 100;
      barPoison.style.width = `${Math.min(100, Math.max(0, norm))}%`;
    }
  }

  renderRaceGraph(scores) {
    const canvas = document.getElementById('race-gen-graph');
    if (!canvas || !scores || scores.length === 0) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    const maxVal = Math.max(10, ...scores);
    const step = w / Math.max(1, scores.length - 1);

    // Draw graph line
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < scores.length; i++) {
      const x = i * step;
      const y = h - (scores[i] / maxVal) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under line
    ctx.lineTo((scores.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = 'rgba(255, 0, 170, 0.15)';
    ctx.fill();
  }

  showToast(message) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }
}

