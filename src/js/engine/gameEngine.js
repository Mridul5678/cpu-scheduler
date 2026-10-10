/**
 * gameEngine.js
 * Interactive "Human vs. Scheduler" Game Engine
 * Novelty Feature: Puts the user in the driver seat as the OS CPU Scheduler!
 */

class HumanSchedulerGame {
  constructor(options = {}) {
    this.processes = [];
    this.currentTick = 0;
    this.maxTotalTime = 0;
    this.isGameActive = false;
    this.isGameOver = false;

    this.humanTimeline = [];
    this.humanProcesses = [];
    this.lastDispatchedId = null;
    this.humanContextSwitches = 0;

    this.aiOptimalResult = null;
    this.aiEvaluation = null;

    this.onStateChange = options.onStateChange || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
  }

  /**
   * Start a new game with a process workload
   * @param {Array<Process>} processList
   */
  start(processList) {
    this.processes = processList.map(p => p.clone());
    this.humanProcesses = processList.map(p => p.clone());
    this.currentTick = 0;
    this.humanTimeline = [];
    this.lastDispatchedId = null;
    this.humanContextSwitches = 0;
    this.isGameActive = true;
    this.isGameOver = false;

    // Calculate AI Optimal (SRTF) benchmark
    const optimalRaw = runSRTF(processList);
    this.aiOptimalResult = optimalRaw;
    this.aiEvaluation = SchedulerEvaluator.evaluate(optimalRaw);

    const totalBurst = processList.reduce((acc, p) => acc + p.burstTime, 0);
    const minArrival = Math.min(...processList.map(p => p.arrivalTime));
    this.maxTotalTime = totalBurst + minArrival;

    this.notifyState();
  }

  /**
   * Get processes that have arrived and still have remaining burst time
   */
  getAvailableProcesses() {
    return this.humanProcesses.filter(
      p => p.arrivalTime <= this.currentTick && p.remainingTime > 0
    );
  }

  /**
   * Human dispatcher action: Dispatches chosen process ID (or null for Idle) for 1 tick
   * @param {string|null} processId
   */
  dispatchTick(processId) {
    if (!this.isGameActive || this.isGameOver) return;

    const available = this.getAvailableProcesses();

    if (!processId) {
      // Human chose IDLE
      this.humanTimeline.push({
        type: 'IDLE',
        processId: null,
        start: this.currentTick,
        end: this.currentTick + 1,
        duration: 1
      });
      this.currentTick++;
      this.checkGameCompletion();
      this.notifyState();
      return;
    }

    const chosen = available.find(p => p.id === processId);
    if (!chosen) {
      console.warn(`Process ${processId} is not currently available in Ready Queue.`);
      return;
    }

    // Context switch detection
    if (this.lastDispatchedId !== null && this.lastDispatchedId !== chosen.id) {
      this.humanContextSwitches++;
    }

    if (chosen.startTime === -1) {
      chosen.startTime = this.currentTick;
      chosen.responseTime = this.currentTick - chosen.arrivalTime;
    }

    chosen.remainingTime -= 1;

    // Consolidate or push to timeline
    const lastSeg = this.humanTimeline[this.humanTimeline.length - 1];
    if (lastSeg && lastSeg.type === 'PROCESS' && lastSeg.processId === chosen.id && lastSeg.end === this.currentTick) {
      lastSeg.end += 1;
      lastSeg.duration += 1;
    } else {
      this.humanTimeline.push({
        type: 'PROCESS',
        processId: chosen.id,
        color: chosen.color,
        start: this.currentTick,
        end: this.currentTick + 1,
        duration: 1
      });
    }

    this.currentTick++;
    this.lastDispatchedId = chosen.id;

    if (chosen.remainingTime === 0) {
      chosen.finalize(this.currentTick);
    }

    this.checkGameCompletion();
    this.notifyState();
  }

  checkGameCompletion() {
    const uncompleted = this.humanProcesses.filter(p => p.remainingTime > 0);
    if (uncompleted.length === 0) {
      this.endGame();
    }
  }

  endGame() {
    this.isGameActive = false;
    this.isGameOver = true;

    // Calculate Human Performance Metrics
    const humanRaw = {
      algorithm: 'Human',
      name: 'Human Scheduler',
      timeline: this.humanTimeline,
      processes: this.humanProcesses,
      totalTime: this.currentTick,
      idleTime: this.humanTimeline.filter(s => s.type === 'IDLE').reduce((a, s) => a + s.duration, 0),
      contextSwitchCount: this.humanContextSwitches
    };

    const humanEval = SchedulerEvaluator.evaluate(humanRaw);

    // Compare with AI Optimal
    const aiAWT = this.aiEvaluation.avgWaitingTime;
    const humanAWT = humanEval.avgWaitingTime;

    // Calculate Efficiency Percentage: 100% if humanAWT <= aiAWT
    let efficiency = 100;
    if (humanAWT > aiAWT) {
      efficiency = Math.max(10, Math.round((aiAWT / humanAWT) * 100));
    }

    // Assign Rank Title
    let rankTitle = 'Linux Kernel Architect 👑';
    let badgeClass = 'badge-success';
    if (efficiency >= 95) {
      rankTitle = 'OS Scheduling Master 🏆';
      badgeClass = 'badge-success';
    } else if (efficiency >= 85) {
      rankTitle = 'Senior Systems Engineer ⚡';
      badgeClass = 'badge-info';
    } else if (efficiency >= 70) {
      rankTitle = 'Junior OS Kernel Dev 🛠️';
      badgeClass = 'badge-warning';
    } else {
      rankTitle = 'Suffered The Convoy Effect 🐢';
      badgeClass = 'badge-danger';
    }

    // Achievements
    const achievements = [];
    if (humanEval.avgWaitingTime <= this.aiEvaluation.avgWaitingTime) {
      achievements.push('🎯 Optimal Latency: Matched the mathematical optimum SRTF waiting time!');
    }
    if (this.humanContextSwitches <= 2) {
      achievements.push('⚡ Minimal Overhead: Kept context switches to an absolute minimum!');
    }
    if (!humanEval.starvationRisk) {
      achievements.push('🛡️ Anti-Starvation Hero: Zero processes suffered starvation risk!');
    }
    if (humanEval.fairnessPercent >= 90) {
      achievements.push('⚖️ Pure Equity: Achieved >90% on Jain\'s Fairness Index!');
    }

    const summaryReport = {
      humanMetrics: humanEval,
      aiMetrics: this.aiEvaluation,
      efficiency,
      rankTitle,
      badgeClass,
      achievements,
      deltaWT: Number((humanAWT - aiAWT).toFixed(2))
    };

    this.onGameOver(summaryReport);
  }

  notifyState() {
    const available = this.getAvailableProcesses();
    const isIdleNeeded = available.length === 0 && !this.isGameOver;

    this.onStateChange({
      currentTick: this.currentTick,
      availableProcesses: available,
      isIdleNeeded,
      timeline: this.humanTimeline,
      processes: this.humanProcesses,
      contextSwitches: this.humanContextSwitches,
      isGameOver: this.isGameOver
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HumanSchedulerGame;
}
