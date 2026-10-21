/**
 * Process.js
 * Represents a single process in the CPU scheduling simulator.
 */
class Process {
  /**
   * @param {Object} data
   * @param {string} data.id - Unique ID (e.g., "P1")
   * @param {number} data.arrivalTime - Arrival time (non-negative integer)
   * @param {number} data.burstTime - Total CPU burst time (positive integer)
   * @param {number} [data.priority=1] - Priority (lower number = higher priority by default, or configurable)
   * @param {number} [data.queueLevel=0] - For MLQ / MLFQ (0 is highest priority queue)
   * @param {string} [data.color] - Hex or HSL color code for visualization
   */
  constructor({ id, arrivalTime, burstTime, priority = 1, queueLevel = 0, color = null }) {
    this.id = String(id || 'P1');
    const arr = parseInt(arrivalTime, 10);
    this.arrivalTime = isNaN(arr) || arr < 0 ? 0 : arr;
    const burst = parseInt(burstTime, 10);
    this.burstTime = isNaN(burst) || burst <= 0 ? 1 : burst;
    const pri = parseInt(priority, 10);
    this.priority = isNaN(pri) ? 1 : pri;
    const ql = parseInt(queueLevel, 10);
    this.queueLevel = isNaN(ql) || ql < 0 ? 0 : ql;
    this.color = color || Process.generateColor(this.id);

    // Dynamic execution tracking
    this.remainingTime = this.burstTime;
    this.startTime = -1;       // Time when process first got CPU
    this.completionTime = -1;  // Time when process finished
    this.waitingTime = 0;      // Total time spent in ready queue
    this.turnaroundTime = 0;   // completionTime - arrivalTime
    this.responseTime = -1;    // startTime - arrivalTime

    // MLFQ & advanced metrics
    this.currentQueue = this.queueLevel;
    this.timeInCurrentQueue = 0;
    this.lastActiveTime = this.arrivalTime;
    this.executedSegments = []; // Array of { start, end, queueLevel }
    this.state = 'NOT_ARRIVED'; // 'NOT_ARRIVED' | 'READY' | 'RUNNING' | 'COMPLETED'
  }

  /**
   * Clone a fresh copy of the process for fresh simulation runs
   */
  clone() {
    return new Process({
      id: this.id,
      arrivalTime: this.arrivalTime,
      burstTime: this.burstTime,
      priority: this.priority,
      queueLevel: this.queueLevel,
      color: this.color
    });
  }

  /**
   * Resets execution state
   */
  reset() {
    this.remainingTime = this.burstTime;
    this.startTime = -1;
    this.completionTime = -1;
    this.waitingTime = 0;
    this.turnaroundTime = 0;
    this.responseTime = -1;
    this.currentQueue = this.queueLevel;
    this.timeInCurrentQueue = 0;
    this.lastActiveTime = this.arrivalTime;
    this.executedSegments = [];
    this.state = 'NOT_ARRIVED';
  }

  /**
   * Calculate final metrics after process completion
   */
  finalize(currentTime) {
    this.completionTime = currentTime;
    this.turnaroundTime = this.completionTime - this.arrivalTime;
    this.waitingTime = this.turnaroundTime - this.burstTime;
    if (this.responseTime === -1 && this.startTime !== -1) {
      this.responseTime = this.startTime - this.arrivalTime;
    }
    this.state = 'COMPLETED';
  }

  /**
   * Returns the next unused "P<n>" ID: one more than the highest existing number.
   * Based on existing IDs rather than the row count, so deleting P2 from
   * [P1, P2, P3] and adding a process yields P4 instead of a second P3.
   * IDs not in the "P<n>" form (e.g. from a JSON import) are ignored. "p<n>" counts too,
   * because IDs are unique ignoring case.
   */
  static nextId(processes) {
    const maxNum = (processes || []).reduce((max, p) => {
      const match = /^P(\d+)$/i.exec(String(p.id));
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `P${maxNum + 1}`;
  }

  /**
   * Generates a distinct color based on process index or ID.
   * Adjacent process numbers get contrasting hues. Pure red is avoided because the
   * Gantt chart uses red for context switches. Every color keeps >= 5:1 contrast
   * with the dark label text drawn on top of it.
   */
  static generateColor(id) {
    const palette = [
      '#4f97e8', // Blue
      '#e9a23b', // Amber
      '#57bd73', // Green
      '#e2739f', // Pink
      '#3fc1c9', // Cyan
      '#ef8350', // Orange
      '#a9c447', // Lime
      '#7fb3f2', // Light blue
      '#d4b44a', // Gold
      '#f2a07b', // Peach
      '#8fd3b0', // Mint
      '#f3b4cf'  // Light pink
    ];
    // Extract number from ID like "P3" -> 3
    const match = String(id).match(/\d+/);
    const index = match ? parseInt(match[0], 10) - 1 : Math.abs(String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    return palette[((index % palette.length) + palette.length) % palette.length];
  }

  /**
   * Checks one arrival or burst time typed or imported by the user.
   * Only whole numbers inside Process.LIMITS are accepted (numbers or numeric strings).
   * @param {'arrivalTime'|'burstTime'} field
   * @returns {{ ok: boolean, value?: number, error?: string }}
   */
  static validateField(field, raw) {
    const { min, max, label } = Process.LIMITS[field];
    const text = typeof raw === 'string' ? raw.trim() : raw;
    let value = NaN;
    if (typeof text === 'number') value = text;
    else if (typeof text === 'string' && /^-?\d+$/.test(text)) value = parseInt(text, 10);
    if (!Number.isInteger(value) || value < min || value > max) {
      const shown = text === '' || text === undefined || text === null ? 'empty' : JSON.stringify(raw);
      return { ok: false, error: `${label} must be a whole number from ${min} to ${max} (got ${shown}).` };
    }
    return { ok: true, value };
  }

  /**
   * Validates a whole imported workload without changing it. Either every process is valid
   * and the processes are returned, or nothing is accepted and every problem is listed.
   * Processes without an ID get the next free "P<n>". Given IDs must match Process.ID_PATTERN
   * (they are inserted into the page, so HTML or quotes are never accepted) and must be unique
   * ignoring case. Invalid IDs are rejected, never cleaned up.
   * @param {*} items - parsed JSON
   * @returns {{ ok: boolean, processes: Array<Process>, errors: Array<string> }}
   */
  static validateWorkload(items) {
    const errors = [];
    if (!Array.isArray(items)) {
      return { ok: false, processes: [], errors: ['The file must contain a JSON array of processes, for example [{"id": "P1", "arrivalTime": 0, "burstTime": 5}].'] };
    }
    if (items.length > Process.LIMITS.maxProcesses) {
      errors.push(`The workload has ${items.length} processes; the maximum is ${Process.LIMITS.maxProcesses}.`);
    }

    // A missing, null or blank ID means "generate one"; any other value must be a valid ID as given
    const hasId = item => item.id !== undefined && item.id !== null && String(item.id).trim() !== '';
    const isValidId = id => (typeof id === 'string' || typeof id === 'number') && Process.ID_PATTERN.test(String(id));
    const seenIds = new Map(); // lower-case ID -> { id, position } of its first use
    items.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`Process ${i + 1}: must be an object with arrivalTime and burstTime.`);
        return;
      }
      const idOk = hasId(item) && isValidId(item.id);
      const where = `Process ${i + 1}${idOk ? ` (${item.id})` : ''}`;
      if (hasId(item) && !idOk) {
        errors.push(`${where}: ID ${JSON.stringify(item.id)} is not allowed. IDs may contain only letters, digits, hyphens and underscores (1-12 characters).`);
      }
      ['arrivalTime', 'burstTime'].forEach(field => {
        if (item[field] === undefined) {
          errors.push(`${where}: ${Process.LIMITS[field].label.toLowerCase()} is missing.`);
          return;
        }
        const check = Process.validateField(field, item[field]);
        if (!check.ok) errors.push(`${where}: ${check.error}`);
      });
      // Colors are inserted into style attributes: only exact #RRGGBB is accepted. A missing
      // color (undefined or null) keeps the default generated from the ID.
      if (item.color !== undefined && item.color !== null &&
          !(typeof item.color === 'string' && Process.COLOR_PATTERN.test(item.color))) {
        errors.push(`${where}: color ${JSON.stringify(item.color)} is not allowed. Use a six-digit hex color such as "#4f97e8", or leave it out.`);
      }
      if (idOk) {
        const id = String(item.id);
        const first = seenIds.get(id.toLowerCase());
        if (first) {
          errors.push(`${where}: duplicate ID "${id}"; it matches "${first.id}" (process ${first.position}). IDs must be unique, ignoring upper/lower case.`);
        } else {
          seenIds.set(id.toLowerCase(), { id, position: i + 1 });
        }
      }
    });
    if (errors.length > 0) return { ok: false, processes: [], errors };

    const processes = [];
    const givenIds = items.filter(hasId).map(item => ({ id: String(item.id) }));
    items.forEach(item => {
      const id = hasId(item) ? String(item.id) : Process.nextId([...givenIds, ...processes]);
      processes.push(new Process({
        ...item,
        id,
        arrivalTime: Process.validateField('arrivalTime', item.arrivalTime).value,
        burstTime: Process.validateField('burstTime', item.burstTime).value
      }));
    });
    return { ok: true, processes, errors: [] };
  }
}

// Allowed process IDs: ASCII letters, digits, hyphens and underscores, 1-12 characters.
// IDs are inserted into the page and used in attribute selectors, so nothing else is accepted.
Process.ID_PATTERN = /^[A-Za-z0-9_-]{1,12}$/;

// Allowed imported colors: exactly #RRGGBB (hex digits in either case), as exported by the app
Process.COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

// Workload limits enforced on every path that creates or edits processes in the UI
Process.LIMITS = Object.freeze({
  maxProcesses: 50,
  arrivalTime: Object.freeze({ min: 0, max: 100, label: 'Arrival time' }),
  burstTime: Object.freeze({ min: 1, max: 100, label: 'Burst time' })
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Process;
}
