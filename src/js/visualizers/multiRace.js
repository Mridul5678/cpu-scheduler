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

    // Same speed choices as the Simulate view; keep the current speed selected on re-render
    const currentMult = 600 / this.speedMs;
    const speedOptions = [0.25, 0.5, 1, 1.5, 2, 3].map(m =>
      `<option value="${m}"${Math.abs(m - currentMult) < 0.01 ? ' selected' : ''}>${m}×</option>`
    ).join('');
    const icon = MultiSchedulerRace.icon;

    let html = `
      <div class="race-wrapper">
        <div class="race-controls-bar">
          <div class="race-playback-btns" role="group" aria-label="Race playback">
            <button id="raceBtnReset" class="btn btn-outline btn-ctrl" title="Reset to time 0" aria-label="Reset to time 0">${icon('reset')}<span class="btn-text">Reset</span></button>
            <button id="raceBtnPrev" class="btn btn-outline btn-ctrl" title="Step back one time unit" aria-label="Step back one time unit">${icon('step-back')}<span class="btn-text">Step back</span></button>
            <button id="raceBtnPlay" class="btn btn-primary btn-ctrl btn-play">${icon('play')}<span>Play</span></button>
            <button id="raceBtnNext" class="btn btn-outline btn-ctrl" title="Step forward one time unit" aria-label="Step forward one time unit">${icon('step-forward')}<span class="btn-text">Step forward</span></button>
          </div>
          <div class="race-time-display">
            Time <strong id="raceTimeCounter">${this.currentTick}</strong> / ${this.maxTotalTime}
          </div>
          <label class="race-speed-ctrl">
            <span>Speed</span>
            <select id="raceSpeedSelect" class="form-select form-select-sm">${speedOptions}</select>
          </label>
        </div>

        <div class="race-tracks-container" id="raceTracksContainer">
          <!-- One lane per algorithm, rendered by renderTick() -->
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
      btnPlay.innerHTML = this.isPlaying
        ? `${MultiSchedulerRace.icon('pause')}<span>Pause</span>`
        : `${MultiSchedulerRace.icon('play')}<span>Play</span>`;
    }
  }

  renderTick() {
    if (!this.container) return;
    const counter = this.container.querySelector('#raceTimeCounter');
    if (counter) counter.textContent = this.currentTick;

    const tracksContainer = this.container.querySelector('#raceTracksContainer');
    if (!tracksContainer) return;

    // Every lane uses the same scale (maxTotalTime) and the same currentTick, so the
    // blocks, playheads and the shared axis below line up across algorithms.
    const playheadLeft = (this.currentTick / this.maxTotalTime) * 100;

    let tracksHtml = '';

    this.results.forEach(item => {
      const { result, metrics } = item;
      const timeline = result.timeline || [];

      // Segments up to currentTick, clipped at the playhead
      const segmentsHtml = timeline
        .filter(seg => seg.start < this.currentTick)
        .map(seg => GanttChartVisualizer.segmentHtml({ ...seg, displayedEnd: Math.min(seg.end, this.currentTick) }, this.maxTotalTime))
        .join('');

      // What this lane's CPU is doing at the shared tick
      let status;
      if (this.currentTick >= result.totalTime && !metrics.isComplete) {
        // The safety limit stopped this run early: do not present it as a finished schedule
        status = { label: 'Stopped at limit', cls: 'badge-danger', title: `Did not finish: ${metrics.unfinishedProcesses.join(', ')}` };
      } else if (this.currentTick >= result.totalTime) {
        status = { label: 'Done', cls: 'badge-secondary' };
      } else {
        const tickData = result.ticks ? (result.ticks[Math.min(this.currentTick, result.ticks.length - 1)] || {}) : {};
        if (tickData.runningProcessId) status = { label: `Running ${tickData.runningProcessId}`, cls: 'badge-success' };
        else if (tickData.isContextSwitch) status = { label: 'Switching', cls: 'badge-danger' };
        else status = { label: 'Idle', cls: 'badge-secondary' };
      }

      tracksHtml += `
        <div class="race-row">
          <div class="race-row-header">
            <div class="race-algo-title">
              <strong title="${result.name}">${result.name}</strong>
              <span class="badge ${status.cls}"${status.title ? ` title="${status.title}"` : ''}>${status.label}</span>
            </div>
            <div class="race-algo-quick-metrics">
              ${metrics.isComplete ? `
              <span>Avg wait <strong>${metrics.avgWaitingTime}</strong></span>
              <span>Avg TAT <strong>${metrics.avgTurnaroundTime}</strong></span>
              <span>Fairness <strong>${metrics.fairnessPercent}%</strong></span>` : `
              <span class="text-danger">Did not finish: ${metrics.unfinishedProcesses.join(', ')} (no final averages)</span>`}
            </div>
          </div>
          <div class="gantt-track race-track">
            ${segmentsHtml}
            <div class="gantt-playhead" style="left: ${playheadLeft}%;"></div>
          </div>
        </div>
      `;
    });

    // One time axis shared by all lanes
    tracksHtml += `
      <div class="race-axis-row">
        <div></div>
        <div class="gantt-axis">${GanttChartVisualizer.axisHtml(this.maxTotalTime)}</div>
      </div>
    `;

    tracksContainer.innerHTML = tracksHtml;
  }

  static icon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
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
