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
   * IDs not in the "P<n>" form (e.g. from a JSON import) are ignored.
   */
  static nextId(processes) {
    const maxNum = (processes || []).reduce((max, p) => {
      const match = /^P(\d+)$/.exec(String(p.id));
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Process;
}
