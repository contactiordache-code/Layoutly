const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  onboarded: false,
  hotkey: null,
  stack: null,
  llm: null,
  lastUrl: '',
  daily: { day: '', components: [], styles: [] }, // today's free usage
  license: null, // { key, instanceId, activatedAt, lastValidatedAt }
};

class Store {
  constructor(dir, defaults = {}) {
    this.file = path.join(dir, 'layoutly.json');
    this.data = { ...DEFAULTS, ...defaults };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...this.data, ...saved, daily: { ...DEFAULTS.daily, ...(saved.daily || {}) } };
      delete this.data.trial; // replaced by the daily allowance
    } catch {
      // First run or unreadable file: start from defaults.
    }
  }

  get(key) {
    return this.data[key];
  }

  set(patch) {
    this.data = { ...this.data, ...patch };
    this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
