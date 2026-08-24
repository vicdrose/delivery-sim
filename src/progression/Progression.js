const KEY = 'snackrun.profile.v1';

const DEFAULT_PROFILE = {
  totalEarned: 0,
  deliveriesCompleted: 0,
  deliveriesFailed: 0,
  daysWorked: 0,
  bank: 0,
  unlocks: {
    vehicles: ['hatch'],
    cities: ['metro'],
    songs: [],
    upgrades: []
  }
};

export class Progression {
  constructor() {
    this.profile = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_PROFILE);
      const data = JSON.parse(raw);
      return { ...structuredClone(DEFAULT_PROFILE), ...data, unlocks: { ...DEFAULT_PROFILE.unlocks, ...(data.unlocks || {}) } };
    } catch {
      return structuredClone(DEFAULT_PROFILE);
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.profile));
    } catch {
      /* storage unavailable */
    }
  }

  addMoney(amount) {
    this.profile.bank += amount;
    this.profile.totalEarned += amount;
    this.save();
  }

  spendMoney(amount) {
    if (this.profile.bank < amount) return false;
    this.profile.bank -= amount;
    this.save();
    return true;
  }

  recordDelivery(success, payout = 0) {
    if (success) {
      this.profile.deliveriesCompleted++;
    } else {
      this.profile.deliveriesFailed++;
    }
    this.save();
  }

  endDay() {
    this.profile.daysWorked++;
    this.save();
  }

  grantUnlock(category, id) {
    const list = this.profile.unlocks[category];
    if (Array.isArray(list) && !list.includes(id)) {
      list.push(id);
      this.save();
      return true;
    }
    return false;
  }

  isUnlocked(category, id) {
    const list = this.profile.unlocks[category];
    return Array.isArray(list) && list.includes(id);
  }
}
