/**
 * simulator.js
 * Central simulation controller handling step-by-step playback, real-time animation,
 * speed control, and state management.
 */

class SimulationController {
  constructor() {
    this.currentAlgorithm = 'FCFS';
    this.options = {
      timeQuantum: 2,
      contextSwitchOverhead: 0,
      priorityMode: 'lower-is-higher',
      q0Quantum: 2,
      q1Quantum: 4,
      agingThreshold: 12
    };

    this.processes = [];
    this.simulationResult = null;
    this.evaluation = null;

    this.currentTickIndex = 0;
    this.isPlaying = false;
    this.speedMs = 600; // ms per tick (default 1x)
    this.timer = null;

    // Listeners for state changes
    this.listeners = {
      tick: [],
      stateChange: [],
      complete: []
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  setProcesses(processes) {
    this.processes = processes;
    this.reset();
  }

  setAlgorithm(algoKey) {
    this.currentAlgorithm = algoKey;
    this.reset();
  }

  setOptions(newOpts) {
    this.options = { ...this.options, ...newOpts };
    this.reset();
  }

  setSpeedMultiplier(mult) {
    // 1x = 600ms, 2x = 300ms, 0.5x = 1200ms
    const base = 600;
    this.speedMs = Math.max(50, Math.round(base / mult));
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Computes the full execution plan for the current algorithm
   */
  runAlgorithm() {
    if (!this.processes || this.processes.length === 0) {
      // Drop the previous run so it is not shown as if it belonged to the empty workload
      this.simulationResult = null;
      this.evaluation = null;
      return null;
    }

    let res = null;
    const opts = this.options;
    switch (this.currentAlgorithm) {
      case 'FCFS':
        res = runFCFS(this.processes, opts);
        break;
      case 'SJF':
        res = runSJF(this.processes, opts);
        break;
      case 'SRTF':
        res = runSRTF(this.processes, opts);
        break;
      case 'RR':
        res = runRoundRobin(this.processes, opts);
        break;
      case 'Priority-NP':
        res = runPriorityNonPreemptive(this.processes, opts);
        break;
      case 'Priority-P':
        res = runPriorityPreemptive(this.processes, opts);
        break;
      case 'HRRN':
        res = runHRRN(this.processes, opts);
        break;
      case 'MLQ':
        res = runMLQ(this.processes, opts);
        break;
      case 'MLFQ':
        res = runMLFQ(this.processes, opts);
        break;
      default:
        res = runFCFS(this.processes, opts);
    }

    this.simulationResult = res;
    this.evaluation = SchedulerEvaluator.evaluate(res);
    return res;
  }

  reset() {
    this.pause();
    this.runAlgorithm();
    this.currentTickIndex = 0;
    this.emit('stateChange', {
      currentTick: this.currentTickIndex,
      totalTicks: this.simulationResult ? this.simulationResult.ticks.length : 0,
      isPlaying: false
    });
    this.notifyCurrentTick();
  }

  play() {
    if (this.isPlaying || !this.simulationResult) return;
    const maxTicks = this.simulationResult.ticks.length;
    if (this.currentTickIndex >= maxTicks - 1) {
      // If already at end, restart from 0
      this.currentTickIndex = 0;
    }

    this.isPlaying = true;
    this.emit('stateChange', { isPlaying: true });

    this.timer = setInterval(() => {
      if (this.currentTickIndex < maxTicks - 1) {
        this.currentTickIndex++;
        this.notifyCurrentTick();
      } else {
        this.pause();
        this.emit('complete', { result: this.simulationResult, eval: this.evaluation });
      }
    }, this.speedMs);
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
    this.emit('stateChange', { isPlaying: false });
  }

  stepForward() {
    this.pause();
    if (!this.simulationResult) return;
    const maxTicks = this.simulationResult.ticks.length;
    if (this.currentTickIndex < maxTicks - 1) {
      this.currentTickIndex++;
      this.notifyCurrentTick();
    }
  }

  stepBackward() {
    this.pause();
    if (!this.simulationResult) return;
    if (this.currentTickIndex > 0) {
      this.currentTickIndex--;
      this.notifyCurrentTick();
    }
  }

  jumpToTime(time) {
    this.pause();
    if (!this.simulationResult) return;
    const ticks = this.simulationResult.ticks;
    const idx = ticks.findIndex(tk => tk.time >= time);
    this.currentTickIndex = idx !== -1 ? idx : ticks.length - 1;
    this.notifyCurrentTick();
  }

  jumpToEnd() {
    this.pause();
    if (!this.simulationResult) return;
    this.currentTickIndex = this.simulationResult.ticks.length - 1;
    this.notifyCurrentTick();
    this.emit('complete', { result: this.simulationResult, eval: this.evaluation });
  }

  notifyCurrentTick() {
    if (!this.simulationResult || !this.simulationResult.ticks[this.currentTickIndex]) return;
    const currentTickData = this.simulationResult.ticks[this.currentTickIndex];
    const totalTicks = this.simulationResult.ticks.length;
    this.emit('tick', {
      tickIndex: this.currentTickIndex,
      tickData: currentTickData,
      totalTicks,
      isEnd: this.currentTickIndex >= totalTicks - 1,
      result: this.simulationResult,
      evaluation: this.evaluation
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimulationController;
}
