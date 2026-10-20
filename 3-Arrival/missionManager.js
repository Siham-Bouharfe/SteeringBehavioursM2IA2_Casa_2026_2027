class MissionManager {
  constructor() {
    this.missions = [
      { type: 'snacks', target: 5, label: 'Mange 5 croquettes' },
      { type: 'combo', target: 3, label: 'Enchaîne 3 croquettes' },
      { type: 'golden', target: 1, label: 'Trouve une croquette dorée' },
    ];
    this.missionIndex = 0;
    this.progress = 0;
  }

  get current() {
    return this.missions[this.missionIndex];
  }

  getState() {
    return {
      label: this.current.label,
      progress: this.progress,
      target: this.current.target,
      type: this.current.type,
    };
  }

  recordSnack({ isGolden, isCombo }) {
    if (this.current.type === 'snacks') {
      this.progress++;
    } else if (this.current.type === 'combo') {
      this.progress = isCombo ? this.progress + 1 : 1;
    } else if (this.current.type === 'golden' && isGolden) {
      this.progress++;
    }

    if (this.progress < this.current.target) return null;
    const completed = this.current;
    this.missionIndex = (this.missionIndex + 1) % this.missions.length;
    this.progress = 0;
    return completed;
  }
}

if (typeof window !== 'undefined') window.MissionManager = MissionManager;
