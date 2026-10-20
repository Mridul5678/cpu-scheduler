/**
 * multiRace.js
 * Multi-Scheduler Synchronous Race Visualizer
 * Runs 2 to 4 schedulers side-by-side in real-time lockstep on the exact same workload.
 */

class MultiSchedulerRace {
  /**
   * @param {HTMLElement|string} container
   */
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.selectedAlgorithms = ['FCFS', 'SJF', 'SRTF', 'RR'];
    this.results = [];
    this.maxTotalTime = 0;
    this.currentTick = 0;
    this.isPlaying = false;
    this.timer = null;
    this.speedMs = 600;
  }

  /**
   * Prepare race with processes and options
   */
  setup(processes, selectedAlgos, options = {}) {
    this.selectedAlgorithms = selectedAlgos || this.selectedAlgorithms;
    this.processes = processes;
    this.options = options;
    this.pause();
    this.currentTick = 0;

    // Empty workload: no tracks to race (the evaluator has no metrics for zero processes)
    if (!processes || processes.length === 0) {
      this.results = [];
      this.maxTotalTime = 0;
      this.render();
      return;
    }

    this.results = this.selectedAlgorithms.map(key => {
      const algo = MultiSchedulerRace.ALGORITHMS.find(a => a.key === key);
      if (!algo) {
        // Never substitute a different algorithm for an unknown selection
        throw new Error(`Unknown scheduler selected for race: ${key}`);
      }
      const res = algo.run(processes, options);
      const evalMetrics = SchedulerEvaluator.evaluate(res);
      return { key, result: res, metrics: evalMetrics };
    });

    this.maxTotalTime = Math.max(...this.results.map(r => r.result.totalTime), 1);
    this.render();
  }

  play() {
    if (this.isPlaying) return;
    if (this.currentTick >= this.maxTotalTime) {
      this.currentTick = 0;
    }
    this.isPlaying = true;
    this.updateControlsUI();

    this.timer = setInterval(() => {
      if (this.currentTick < this.maxTotalTime) {
        this.currentTick++;
        this.renderTick();
      } else {
        this.pause();
      }
    }, this.speedMs);
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
    this.updateControlsUI();
  }

  stepForward() {
    this.pause();
    if (this.currentTick < this.maxTotalTime) {
      this.currentTick++;
      this.renderTick();
    }
  }

  stepBackward() {
    this.pause();
    if (this.currentTick > 0) {
      this.currentTick--;
      this.renderTick();
    }
  }

  reset() {
    this.pause();
    this.currentTick = 0;
    this.renderTick();
  }

  setSpeedMultiplier(mult) {
    this.speedMs = Math.max(50, Math.round(600 / mult));
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  render() {
    if (!this.container) return;

    if (this.results.length === 0) {
      this.container.innerHTML = `
        <div class="card text-muted text-sm" style="text-align: center; padding: 2rem 1rem;">
          No processes in the workload. Add a process or load a preset, then start the race.
        </div>
      `;
      return;
    }

    let html = `
      <div class="race-wrapper">
        <div class="race-controls-bar">
          <div class="race-playback-btns">
            <button id="raceBtnReset" class="btn btn-sm btn-outline"><i class="icon">⏮</i> Reset</button>
            <button id="raceBtnPrev" class="btn btn-sm btn-outline"><i class="icon">⏪</i> Step</button>
            <button id="raceBtnPlay" class="btn btn-sm btn-primary"><i class="icon">▶</i> Play Race</button>
            <button id="raceBtnNext" class="btn btn-sm btn-outline"><i class="icon">⏩</i> Step</button>
          </div>
          <div class="race-time-display">
            Shared Time Tick: <span id="raceTimeCounter" class="badge badge-primary font-mono" style="font-size: 1.1rem;">${this.currentTick}</span> / ${this.maxTotalTime}
          </div>
          <div class="race-speed-ctrl">
            <label class="text-xs text-muted">Speed:</label>
            <select id="raceSpeedSelect" class="form-select form-select-sm">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1.0x</option>
              <option value="2">2.0x</option>
              <option value="4">4.0x</option>
            </select>
          </div>
        </div>

        <div class="race-tracks-container" id="raceTracksContainer">
          <!-- Stacked Gantt charts rendered dynamically -->
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.bindEvents();
    this.renderTick();
  }

  bindEvents() {
    const btnPlay = this.container.querySelector('#raceBtnPlay');
    const btnReset = this.container.querySelector('#raceBtnReset');
    const btnPrev = this.container.querySelector('#raceBtnPrev');
    const btnNext = this.container.querySelector('#raceBtnNext');
    const selSpeed = this.container.querySelector('#raceSpeedSelect');

    if (btnPlay) {
      btnPlay.onclick = () => {
        if (this.isPlaying) this.pause();
        else this.play();
      };
    }
    if (btnReset) btnReset.onclick = () => this.reset();
    if (btnPrev) btnPrev.onclick = () => this.stepBackward();
    if (btnNext) btnNext.onclick = () => this.stepForward();
    if (selSpeed) {
      selSpeed.onchange = (e) => this.setSpeedMultiplier(parseFloat(e.target.value));
    }
  }

  updateControlsUI() {
    if (!this.container) return;
    const btnPlay = this.container.querySelector('#raceBtnPlay');
    if (btnPlay) {
      btnPlay.innerHTML = this.isPlaying ? '<i class="icon">⏸</i> Pause' : '<i class="icon">▶</i> Play Race';
      btnPlay.className = this.isPlaying ? 'btn btn-sm btn-warning' : 'btn btn-sm btn-primary';
    }
  }

  renderTick() {
    if (!this.container) return;
    const counter = this.container.querySelector('#raceTimeCounter');
    if (counter) counter.textContent = this.currentTick;

    const tracksContainer = this.container.querySelector('#raceTracksContainer');
    if (!tracksContainer) return;

    const chartWidth = Math.max(this.maxTotalTime * 30, 600);
    const playheadLeft = (this.currentTick / this.maxTotalTime) * 100;

    let tracksHtml = '';

    this.results.forEach(item => {
      const { key, result, metrics } = item;
      const timeline = result.timeline || [];

      // Segments up to currentTick
      let segmentsHtml = '';
      timeline.forEach(seg => {
        if (seg.start >= this.currentTick) return;
        const clippedEnd = Math.min(seg.end, this.currentTick);
        if (clippedEnd <= seg.start) return;

        const leftPct = (seg.start / this.maxTotalTime) * 100;
        const widthPct = ((clippedEnd - seg.start) / this.maxTotalTime) * 100;

        if (seg.type === 'PROCESS') {
          segmentsHtml += `
            <div class="gantt-block gantt-process" style="left: ${leftPct}%; width: ${widthPct}%; background: ${seg.color || '#6366f1'};">
              <span class="gantt-label">${seg.processId}</span>
            </div>
          `;
        } else if (seg.type === 'CONTEXT_SWITCH') {
          segmentsHtml += `
            <div class="gantt-block gantt-cs" style="left: ${leftPct}%; width: ${widthPct}%;">
              <span class="gantt-label-sm">CS</span>
            </div>
          `;
        } else if (seg.type === 'IDLE') {
          segmentsHtml += `
            <div class="gantt-block gantt-idle" style="left: ${leftPct}%; width: ${widthPct}%;">
              <span class="gantt-label-sm">Idle</span>
            </div>
          `;
        }
      });

      // Find current running process at tick
      const tickData = result.ticks ? (result.ticks[Math.min(this.currentTick, result.ticks.length - 1)] || {}) : {};
      const runningId = tickData.runningProcessId || (tickData.isContextSwitch ? 'CS' : 'IDLE');

      tracksHtml += `
        <div class="race-row">
          <div class="race-row-header">
            <div class="race-algo-title">
              <strong>${result.name}</strong>
              <span class="badge ${runningId === 'IDLE' ? 'badge-secondary' : 'badge-success'}">Now: ${runningId}</span>
            </div>
            <div class="race-algo-quick-metrics">
              <span>Avg WT: <strong>${metrics.avgWaitingTime}</strong></span>
              <span>Avg TAT: <strong>${metrics.avgTurnaroundTime}</strong></span>
              <span>Fairness: <strong>${metrics.fairnessPercent}%</strong></span>
            </div>
          </div>
          <div class="gantt-wrapper" style="overflow-x: auto; position: relative;">
            <div class="gantt-track race-track" style="width: ${chartWidth}px; min-height: 50px; position: relative;">
              ${segmentsHtml}
              <div class="gantt-playhead" style="left: ${playheadLeft}%;"></div>
            </div>
          </div>
        </div>
      `;
    });

    tracksContainer.innerHTML = tracksHtml;
  }
}

// Every algorithm that can take part in a race. The race checkboxes are built from
// this list, so it must cover every key the recommendation engine can rank
// (otherwise "Race Top 3" would silently drop that algorithm).
// Runners are looked up when called, so the algorithm scripts can load after this file.
MultiSchedulerRace.ALGORITHMS = [
  { key: 'FCFS', label: 'FCFS', raceDefault: true, run: (p, o) => runFCFS(p, o) },
  { key: 'SJF', label: 'SJF', raceDefault: true, run: (p, o) => runSJF(p, o) },
  { key: 'SRTF', label: 'SRTF', raceDefault: true, run: (p, o) => runSRTF(p, o) },
  { key: 'RR', label: 'Round Robin', raceDefault: true, run: (p, o) => runRoundRobin(p, o) },
  { key: 'Priority-NP', label: 'Priority (Non-Preemptive)', raceDefault: false, run: (p, o) => runPriorityNonPreemptive(p, o) },
  { key: 'Priority-P', label: 'Priority (Preemptive)', raceDefault: false, run: (p, o) => runPriorityPreemptive(p, o) },
  { key: 'HRRN', label: 'HRRN', raceDefault: false, run: (p, o) => runHRRN(p, o) },
  { key: 'MLQ', label: 'MLQ', raceDefault: false, run: (p, o) => runMLQ(p, o) },
  { key: 'MLFQ', label: 'MLFQ', raceDefault: false, run: (p, o) => runMLFQ(p, o) }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultiSchedulerRace;
}
