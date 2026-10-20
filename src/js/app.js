/**
 * app.js
 * Main application coordinator, UI event bindings, presets, and state management.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize State & Visualizers
  let currentProcesses = [];
  const simulator = new SimulationController();
  const ganttVisualizer = new GanttChartVisualizer('#liveGanttChart');
  const stateVisualizer = new StateVisualizer({
    cpuSelector: '#cpuCoreDisplay',
    readyQueueSelector: '#readyQueueDisplay',
    processTableBodySelector: '#processTableBody',
    multilevelSelector: '#multilevelQueuesDisplay'
  });
  const multiRace = new MultiSchedulerRace('#multiRaceContainer');

  // DOM Elements
  const algoSelect = document.getElementById('algoSelect');
  const inputQuantum = document.getElementById('inputQuantum');
  const selPriorityMode = document.getElementById('selPriorityMode');
  const inputContextSwitch = document.getElementById('inputContextSwitch');
  const btnAutoQuantum = document.getElementById('btnAutoQuantum');

  const btnCtrlReset = document.getElementById('btnCtrlReset');
  const btnCtrlPrev = document.getElementById('btnCtrlPrev');
  const btnCtrlPlay = document.getElementById('btnCtrlPlay');
  const btnCtrlNext = document.getElementById('btnCtrlNext');
  const btnCtrlEnd = document.getElementById('btnCtrlEnd');
  const timeReadoutBadge = document.getElementById('timeReadoutBadge');
  const speedSelect = document.getElementById('speedSelect');
  const workloadPanel = document.getElementById('workloadPanel');
  const workloadSummary = document.getElementById('workloadSummary');

  const inputProcessTableBody = document.getElementById('inputProcessTableBody');
  const btnAddProcess = document.getElementById('btnAddProcess');
  const btnRandomWorkload = document.getElementById('btnRandomWorkload');
  const btnResetWorkload = document.getElementById('btnResetWorkload');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const inputImportJSON = document.getElementById('inputImportJSON');
  const btnExportCSV = document.getElementById('btnExportCSV');

  const ganttAlgoLabel = document.getElementById('ganttAlgoLabel');
  const algoSpecCard = document.getElementById('algoSpecCard');
  const kernelSyslogTerminal = document.getElementById('kernelSyslogTerminal');
  const btnCopySyslog = document.getElementById('btnCopySyslog');
  const btnClearSyslog = document.getElementById('btnClearSyslog');
  const toastContainer = document.getElementById('toastContainer');

  // Tour Guide Modal DOM
  const btnOpenTour = document.getElementById('btnOpenTour');
  const tourModal = document.getElementById('tourModal');
  const btnTourModalClose = document.getElementById('btnTourModalClose');
  const btnTourModalDone = document.getElementById('btnTourModalDone');
  const tourNavTabs = document.getElementById('tourNavTabs');

  const valAWT = document.getElementById('valAWT');
  const valATAT = document.getElementById('valATAT');
  const valUtil = document.getElementById('valUtil');
  const valIdleSub = document.getElementById('valIdleSub');
  const valFairness = document.getElementById('valFairness');
  const valThroughput = document.getElementById('valThroughput');
  const valCSSub = document.getElementById('valCSSub');

  // Benchmark DOM
  const btnRunBenchmark = document.getElementById('btnRunBenchmark');
  const benchmarkProfileSelect = document.getElementById('benchmarkProfileSelect');
  const recommendationVerdictCard = document.getElementById('recommendationVerdictCard');
  const leaderboardTableBody = document.getElementById('leaderboardTableBody');

  // Race Mode DOM
  const btnRestartRace = document.getElementById('btnRestartRace');
  const raceAlgoCheckboxes = document.getElementById('raceAlgoCheckboxes');

  // Race checkboxes come from the race's own algorithm list, so every scheduler the
  // recommendation engine can rank (including MLQ and Priority-NP) can be raced
  raceAlgoCheckboxes.innerHTML = MultiSchedulerRace.ALGORITHMS.map(a =>
    `<label class="algo-chip"><input type="checkbox" value="${a.key}"${a.raceDefault ? ' checked' : ''}><span>${a.label}</span></label>`
  ).join('');

  // On phone-width screens start with the workload collapsed so the active view is visible;
  // its header ("Workload ... Edit") opens it again
  if (workloadPanel && window.matchMedia('(max-width: 560px)').matches) {
    workloadPanel.open = false;
  }

  // Play / pause button content (icons come from the SVG sprite in index.html)
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  // Toast Notification System
  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // Algorithm Deep Dive Specifications & Theoretical Formulas
  const ALGO_SPECS = {
    'FCFS': {
      name: 'First-Come, First-Served',
      tag: 'Non-Preemptive',
      tagClass: 'algo-tag-nonpreemptive',
      complexity: 'O(1) Dispatch',
      formula: 'Next PID = argmin(Arrival_Time_i)',
      strength: 'Simplest FIFO queue with zero scheduling overhead.',
      pitfall: 'Severe Convoy Effect when a CPU-bound job blocks short interactive tasks.',
      realWorld: 'Batch processing mainframes, printer/disk I/O queues.'
    },
    'SJF': {
      name: 'Shortest Job First (Non-Preemptive)',
      tag: 'Non-Preemptive',
      tagClass: 'algo-tag-nonpreemptive',
      complexity: 'O(log N) Priority Queue',
      formula: 'Next PID = argmin(Burst_Time_i)',
      strength: 'Minimizes Average Waiting Time when bursts are known in advance.',
      pitfall: 'Starvation of long burst jobs; requires burst estimation.',
      realWorld: 'High-performance computing batch supercomputers.'
    },
    'SRTF': {
      name: 'Shortest Remaining Time First',
      tag: 'Preemptive',
      tagClass: 'algo-tag-preemptive',
      complexity: 'O(log N) Min-Heap',
      formula: 'Next PID = argmin(Remaining_Time_i)',
      strength: 'Provably optimal for minimizing Average Waiting Time (AWT).',
      pitfall: 'Higher context switch overhead; indefinite starvation for heavy tasks.',
      realWorld: 'Real-time embedded controllers with predictable execution times.'
    },
    'RR': {
      name: 'Round Robin',
      tag: 'Preemptive (Time Slice q)',
      tagClass: 'algo-tag-preemptive',
      complexity: 'O(1) Circular FIFO',
      formula: 'Slice = q; Preemption on timer interrupt',
      strength: 'Guaranteed bounded response time, maximum equity, no starvation.',
      pitfall: 'Small q causes context-switch thrashing; large q degenerates to FCFS.',
      realWorld: 'Desktop interactive OS time-sharing cores (Unix, Linux early schedulers).'
    },
    'Priority-NP': {
      name: 'Priority Scheduling (Non-Preemptive)',
      tag: 'Non-Preemptive',
      tagClass: 'algo-tag-nonpreemptive',
      complexity: 'O(log N) Priority Queue',
      formula: 'Next PID = argmax(Priority_i)',
      strength: 'Enforces strict priority levels for mission-critical tasks.',
      pitfall: 'Indefinite starvation of low-priority background processes.',
      realWorld: 'Embedded RTOS with static task classification.'
    },
    'Priority-P': {
      name: 'Priority Scheduling (Preemptive)',
      tag: 'Preemptive',
      tagClass: 'algo-tag-preemptive',
      complexity: 'O(log N) Priority Queue',
      formula: 'Preempts running task if Priority_new > Priority_current',
      strength: 'Immediate preemption for urgent hardware interrupts and high-priority threads.',
      pitfall: 'Frequent context switching & starvation without an aging mechanism.',
      realWorld: 'Hard Real-Time Operating Systems (VxWorks, FreeRTOS).'
    },
    'HRRN': {
      name: 'Highest Response Ratio Next',
      tag: 'Non-Preemptive Dynamic',
      tagClass: 'algo-tag-nonpreemptive',
      complexity: 'O(N) Dynamic Evaluation',
      formula: 'R = (Waiting_Time + Burst_Time) / Burst_Time = 1 + W/S',
      strength: 'Solves starvation mathematically: older waiting jobs naturally gain priority.',
      pitfall: 'Requires knowing burst times in advance; non-preemptive.',
      realWorld: 'Fair-share high performance cluster queue management.'
    },
    'MLQ': {
      name: 'Multilevel Queue Scheduling',
      tag: 'Static Hybrid Queues',
      tagClass: 'algo-tag-preemptive',
      complexity: 'O(1) per Queue Level',
      formula: 'Q0 (Foreground - RR q) > Q1 (Background - FCFS)',
      strength: 'Separates interactive tasks from batch tasks with dedicated policies.',
      pitfall: 'Inflexible static assignment; lower queues may starve if upper queue is active.',
      realWorld: 'Early UNIX multi-user interactive/batch partitioned systems.'
    },
    'MLFQ': {
      name: 'Multilevel Feedback Queue',
      tag: 'Dynamic Adaptive Feedback',
      tagClass: 'algo-tag-preemptive',
      complexity: 'O(1) Dynamic Migration',
      formula: 'Q0 (q=2) -> Q1 (q=4) -> Q2 (FCFS); Aging resets to Q0',
      strength: 'Self-adjusting: prioritizes interactive I/O jobs without prior burst knowledge.',
      pitfall: 'Complex parameter tuning (quantum progression, demotion rules, aging frequency).',
      realWorld: 'Modern OS Schedulers (Linux CFS heuristic origins, macOS XNU, Windows NT).'
    }
  };

  function renderAlgorithmSpec(algoKey) {
    if (!algoSpecCard) return;
    const spec = ALGO_SPECS[algoKey] || ALGO_SPECS['RR'];
    algoSpecCard.innerHTML = `
      <div class="algo-spec-header">
        <div class="algo-spec-title">${spec.name}</div>
        <div class="algo-spec-tags">
          <span class="algo-tag">${spec.tag}</span>
          <span class="algo-tag">${spec.complexity}</span>
        </div>
      </div>
      <div class="algo-spec-grid">
        <div class="algo-spec-item">
          <div class="algo-spec-label">Selection rule</div>
          <div class="algo-spec-val font-mono">${spec.formula}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Main advantage</div>
          <div class="algo-spec-val">${spec.strength}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Key pitfall</div>
          <div class="algo-spec-val">${spec.pitfall}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Real-world use</div>
          <div class="algo-spec-val">${spec.realWorld}</div>
        </div>
      </div>
    `;
  }

  // Linux Kernel Dispatcher Syslog Generator (/dev/kmsg)
  // Event list comes from buildKernelSyslog (src/js/engine/kernelSyslog.js); this only renders it
  function generateKernelSyslog(result, processes, config = {}) {
    if (!kernelSyslogTerminal) return;
    if (!result) {
      kernelSyslogTerminal.innerHTML = '<div class="syslog-line"><span class="syslog-msg text-muted">No processes in the workload. Add a process or load a preset to trace kernel events.</span></div>';
      return;
    }
    const formatTime = (t) => `[ ${(t || 0).toFixed(6).padStart(8, ' ')} ]`;
    const logs = buildKernelSyslog(result, processes, config);

    let html = '';
    logs.forEach(entry => {
      html += `
        <div class="syslog-line">
          <span class="syslog-time font-mono">${formatTime(entry.time)}</span>
          <span class="syslog-tag ${entry.tagClass}">[${entry.tag}]</span>
          <span class="syslog-msg">${entry.msg}</span>
        </div>
      `;
    });

    kernelSyslogTerminal.innerHTML = html;
    kernelSyslogTerminal.scrollTop = kernelSyslogTerminal.scrollHeight;
  }

  // 2. Preset Workloads
  const PRESETS = {
    standard: [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 5, priority: 2, queueLevel: 0 }),
      new Process({ id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P3', arrivalTime: 2, burstTime: 8, priority: 3, queueLevel: 1 }),
      new Process({ id: 'P4', arrivalTime: 3, burstTime: 2, priority: 2, queueLevel: 0 }),
      new Process({ id: 'P5', arrivalTime: 4, burstTime: 4, priority: 1, queueLevel: 1 })
    ],
    convoy: [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 24, priority: 3, queueLevel: 1 }),
      new Process({ id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P3', arrivalTime: 2, burstTime: 3, priority: 2, queueLevel: 0 }),
      new Process({ id: 'P4', arrivalTime: 3, burstTime: 2, priority: 1, queueLevel: 0 })
    ],
    starvation: [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 16, priority: 5, queueLevel: 1 }),
      new Process({ id: 'P2', arrivalTime: 1, burstTime: 4, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P3', arrivalTime: 3, burstTime: 5, priority: 2, queueLevel: 0 }),
      new Process({ id: 'P4', arrivalTime: 5, burstTime: 3, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P5', arrivalTime: 7, burstTime: 4, priority: 2, queueLevel: 0 })
    ],
    interactive: [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 2, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P2', arrivalTime: 1, burstTime: 2, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P3', arrivalTime: 2, burstTime: 1, priority: 2, queueLevel: 0 }),
      new Process({ id: 'P4', arrivalTime: 3, burstTime: 3, priority: 1, queueLevel: 0 }),
      new Process({ id: 'P5', arrivalTime: 5, burstTime: 2, priority: 2, queueLevel: 0 })
    ]
  };

  function loadPreset(presetKey) {
    if (PRESETS[presetKey]) {
      currentProcesses = PRESETS[presetKey].map(p => p.clone());
      renderInputTable();
      syncSimulatorWithInputs();
    }
  }

  // 3. Render Process Matrix Input Rows
  function renderInputTable() {
    inputProcessTableBody.innerHTML = '';
    currentProcesses.forEach((p, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="badge pid-badge" style="background: ${p.color}22; color: ${p.color}; border-color: ${p.color}88;">
            ${p.id}
          </span>
        </td>
        <td>
          <input type="number" class="form-control font-mono input-arr" data-index="${index}" value="${p.arrivalTime}" min="0" max="100" aria-label="${p.id} arrival time">
        </td>
        <td>
          <input type="number" class="form-control font-mono input-burst" data-index="${index}" value="${p.burstTime}" min="1" max="100" aria-label="${p.id} burst time">
        </td>
        <td>
          <input type="number" class="form-control font-mono input-pri" data-index="${index}" value="${p.priority}" min="1" max="20" aria-label="${p.id} priority">
        </td>
        <td>
          <select class="form-select font-mono input-q" data-index="${index}" aria-label="${p.id} queue level">
            <option value="0" ${p.queueLevel === 0 ? 'selected' : ''}>Q0</option>
            <option value="1" ${p.queueLevel === 1 ? 'selected' : ''}>Q1</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-ghost btn-del-row" data-index="${index}" title="Delete ${p.id}" aria-label="Delete ${p.id}">✕</button>
        </td>
      `;
      inputProcessTableBody.appendChild(tr);
    });

    // Input debouncing helper to prevent UI lag on rapid changes
    const debounce = (fn, delay = 150) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    };
    const debouncedSync = debounce(syncSimulatorWithInputs, 150);

    // Bind row input listeners
    inputProcessTableBody.querySelectorAll('.input-arr').forEach(el => {
      el.oninput = (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (currentProcesses[idx]) {
          currentProcesses[idx].arrivalTime = Math.max(0, parseInt(e.target.value, 10) || 0);
          debouncedSync();
        }
      };
    });
    inputProcessTableBody.querySelectorAll('.input-burst').forEach(el => {
      el.oninput = (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (currentProcesses[idx]) {
          currentProcesses[idx].burstTime = Math.max(1, parseInt(e.target.value, 10) || 1);
          currentProcesses[idx].remainingTime = currentProcesses[idx].burstTime;
          debouncedSync();
        }
      };
    });
    inputProcessTableBody.querySelectorAll('.input-pri').forEach(el => {
      el.oninput = (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (currentProcesses[idx]) {
          currentProcesses[idx].priority = parseInt(e.target.value, 10) || 1;
          debouncedSync();
        }
      };
    });
    inputProcessTableBody.querySelectorAll('.input-q').forEach(el => {
      el.onchange = (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (currentProcesses[idx]) {
          currentProcesses[idx].queueLevel = parseInt(e.target.value, 10) || 0;
          syncSimulatorWithInputs();
        }
      };
    });
    inputProcessTableBody.querySelectorAll('.btn-del-row').forEach(el => {
      el.onclick = (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        currentProcesses.splice(idx, 1);
        renderInputTable();
        syncSimulatorWithInputs();
      };
    });
  }

  // 4. Synchronization between Inputs & Simulator
  function syncSimulatorWithInputs() {
    simulator.pause();
    const algo = algoSelect.value;
    const q = Math.max(1, parseInt(inputQuantum.value, 10) || 2);
    const cs = Math.max(0, parseInt(inputContextSwitch.value, 10) || 0);
    const priMode = selPriorityMode.value;

    simulator.setOptions({
      timeQuantum: q,
      contextSwitchOverhead: cs,
      priorityMode: priMode
    });
    simulator.setAlgorithm(algo);
    simulator.setProcesses(currentProcesses.map(p => p.clone()));

    renderAlgorithmSpec(algo);
    ganttAlgoLabel.textContent = algoSelect.options[algoSelect.selectedIndex].text;
    renderOutputTableInitial();
    hideSingleRiskAlert();
    updateWorkloadSummary(q, cs);

    if (!simulator.simulationResult) {
      // Empty workload: no tick events fire, so clear the panels from the previous run
      showEmptySingleView();
    } else {
      // Metrics are filled in when playback reaches the end
      resetMetricsCards('Run to the end to see results');
    }

    // Run synchronous calculation to populate kernel syslog & metrics immediately
    generateKernelSyslog(simulator.simulationResult, currentProcesses, {
      algorithm: algoSelect.options[algoSelect.selectedIndex].text,
      timeQuantum: q,
      contextSwitchOverhead: cs
    });
  }

  function showEmptySingleView() {
    timeReadoutBadge.textContent = '0';
    document.getElementById('liveGanttChart').innerHTML = '<div class="gantt-empty">No processes in the workload. Add a process or load a preset.</div>';
    document.getElementById('cpuCoreDisplay').innerHTML = '<div class="ready-queue-empty">No workload</div>';
    document.getElementById('readyQueueDisplay').innerHTML = '<div class="ready-queue-empty">Empty</div>';
    document.getElementById('multilevelQueuesDisplay').style.display = 'none';
    resetMetricsCards('No workload');
  }

  function resetMetricsCards(note) {
    [valAWT, valATAT, valUtil, valFairness, valThroughput].forEach(el => { el.textContent = '—'; });
    valIdleSub.textContent = note;
    valCSSub.textContent = note;
  }

  // One-line summary shown in the Workload header (useful when the panel is collapsed)
  function updateWorkloadSummary(q, cs) {
    if (!workloadSummary) return;
    const n = currentProcesses.length;
    const algoLabel = algoSelect.options[algoSelect.selectedIndex].text;
    workloadSummary.textContent = `${n} process${n === 1 ? '' : 'es'} · ${algoLabel} · q = ${q} · switch cost ${cs}`;
  }

  function renderOutputTableInitial() {
    const tbody = document.getElementById('processTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    currentProcesses.forEach(p => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-pid', p.id);
      tr.innerHTML = `
        <td>
          <span class="badge pid-badge" style="background: ${p.color}22; color: ${p.color}; border-color: ${p.color}88;">
            ${p.id}
          </span>
        </td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>${p.priority}</td>
        <td class="col-start">-</td>
        <td class="col-comp">-</td>
        <td class="col-tat">-</td>
        <td class="col-wt">-</td>
        <td class="col-rt">-</td>
        <td class="col-state"><span class="badge badge-secondary">WAITING</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 5. Simulator Event Listeners
  simulator.on('tick', ({ tickIndex, tickData, totalTicks, isEnd, result, evaluation }) => {
    timeReadoutBadge.textContent = tickData.time;
    ganttVisualizer.renderLive(result, tickData.time);
    stateVisualizer.update(tickData, currentProcesses);

    // If reached end, display full final metrics & risk diagnostic
    if (isEnd && evaluation) {
      updateMetricsCards(evaluation);
      updateProcessTableFinal(evaluation.processes);
      updateSingleRiskAlert(evaluation);
      generateKernelSyslog(result, currentProcesses, {
        algorithm: algoSelect.options[algoSelect.selectedIndex].text,
        timeQuantum: Math.max(1, parseInt(inputQuantum.value, 10) || 2),
        contextSwitchOverhead: Math.max(0, parseInt(inputContextSwitch.value, 10) || 0)
      });
    }
  });

  simulator.on('stateChange', ({ isPlaying }) => {
    btnCtrlPlay.innerHTML = isPlaying
      ? `${icon('pause')}<span class="btn-text-keep">Pause</span>`
      : `${icon('play')}<span class="btn-text-keep">Play</span>`;
  });

  simulator.on('complete', ({ result, eval: evaluation }) => {
    if (evaluation) {
      updateMetricsCards(evaluation);
      updateProcessTableFinal(evaluation.processes);
      ganttVisualizer.renderStatic(result);
      updateSingleRiskAlert(evaluation);
      generateKernelSyslog(result, currentProcesses, {
        algorithm: algoSelect.options[algoSelect.selectedIndex].text,
        timeQuantum: Math.max(1, parseInt(inputQuantum.value, 10) || 2),
        contextSwitchOverhead: Math.max(0, parseInt(inputContextSwitch.value, 10) || 0)
      });
    }
  });

  function updateMetricsCards(ev) {
    // Times are in the simulator's abstract time units (ticks)
    valAWT.innerHTML = `${ev.avgWaitingTime}<span class="metric-unit">units</span>`;
    valATAT.innerHTML = `${ev.avgTurnaroundTime}<span class="metric-unit">units</span>`;
    valUtil.innerHTML = `${ev.cpuUtilization}<span class="metric-unit">%</span>`;
    // Utilization counts only process execution; the rest of the elapsed time is shown here
    valIdleSub.textContent = `Switch overhead ${ev.switchOverheadPercent}% · idle ${ev.idlePercent}%`;
    valFairness.innerHTML = `${ev.fairnessPercent}<span class="metric-unit">%</span>`;
    valThroughput.innerHTML = `${ev.throughput}<span class="metric-unit">per unit</span>`;
    valCSSub.textContent = `${ev.contextSwitchCount} context switches`;
  }

  // Kernel Risk Diagnostic Alert in Single View
  function hideSingleRiskAlert() {
    const box = document.getElementById('singleRiskAlertContainer');
    if (box) box.style.display = 'none';
  }

  function updateSingleRiskAlert(ev) {
    const box = document.getElementById('singleRiskAlertContainer');
    if (!box || !ev) return;

    if (ev.hasHighRisk && ev.risks && ev.risks.length > 0) {
      const highRisks = ev.risks.filter(r => r.severity === 'High Risk');
      let risksHtml = '';
      highRisks.forEach(r => {
        risksHtml += `
          <div class="risk-item-inline">
            <div class="risk-item-inline-name">${r.name}</div>
            <div class="risk-alert-body">${r.explanation}</div>
            <div class="risk-alert-mitigation"><strong>Mitigation:</strong> ${r.mitigation}</div>
          </div>
        `;
      });

      box.className = 'risk-diagnostic-container risk-alert-danger';
      box.innerHTML = `
        <div class="risk-alert-header">
          <div class="risk-alert-title text-danger">Scheduling risk detected in ${ev.name || ev.algorithm}</div>
          <button class="btn btn-sm btn-outline btn-open-diag">Explain</button>
        </div>
        ${risksHtml}
      `;
      box.style.display = 'block';

      const btnOpen = box.querySelector('.btn-open-diag');
      if (btnOpen) {
        btnOpen.onclick = () => openRiskExplanationModal({ name: ev.name || ev.algorithm, metrics: ev });
      }
    } else {
      box.className = 'risk-diagnostic-container risk-alert-safe';
      box.innerHTML = `
        <div class="risk-alert-header" style="margin-bottom: 0;">
          <div class="risk-alert-title text-success">No scheduling risks detected</div>
          <span class="text-xs text-muted">No starvation, convoy blocking or thrashing found by the diagnostics</span>
        </div>
      `;
      box.style.display = 'block';
    }
  }

  function updateProcessTableFinal(procMetrics) {
    const tbody = document.getElementById('processTableBody');
    if (!tbody || !procMetrics) return;

    procMetrics.forEach(p => {
      const row = tbody.querySelector(`tr[data-pid="${p.id}"]`);
      if (row) {
        row.querySelector('.col-start').textContent = p.startTime >= 0 ? p.startTime : '-';
        row.querySelector('.col-comp').textContent = p.completionTime >= 0 ? p.completionTime : '-';
        row.querySelector('.col-tat').textContent = p.turnaroundTime;
        row.querySelector('.col-wt').textContent = p.waitingTime;
        row.querySelector('.col-rt').textContent = p.responseTime >= 0 ? p.responseTime : '-';
        row.querySelector('.col-state').innerHTML = `<span class="badge badge-success">COMPLETED</span>`;
      }
    });
  }

  // 6. Playback Controls Event Bindings
  btnCtrlPlay.onclick = () => {
    if (simulator.isPlaying) simulator.pause();
    else simulator.play();
  };
  btnCtrlReset.onclick = () => simulator.reset();
  btnCtrlPrev.onclick = () => simulator.stepBackward();
  btnCtrlNext.onclick = () => simulator.stepForward();
  btnCtrlEnd.onclick = () => simulator.jumpToEnd();

  speedSelect.onchange = (e) => simulator.setSpeedMultiplier(parseFloat(e.target.value));

  algoSelect.onchange = () => syncSimulatorWithInputs();
  inputQuantum.onchange = () => syncSimulatorWithInputs();
  inputContextSwitch.onchange = () => syncSimulatorWithInputs();
  selPriorityMode.onchange = () => syncSimulatorWithInputs();

  // Auto-Suggest Quantum
  btnAutoQuantum.onclick = () => {
    const optQ = RecommendationEngine.computeOptimalQuantum(currentProcesses);
    inputQuantum.value = optQ;
    syncSimulatorWithInputs();
    showToast(`Suggested quantum: q = ${optQ}`);
  };

  // Add Process
  btnAddProcess.onclick = () => {
    const newP = new Process({
      id: Process.nextId(currentProcesses),
      arrivalTime: currentProcesses.length,
      burstTime: Math.floor(Math.random() * 6) + 2,
      priority: Math.floor(Math.random() * 3) + 1,
      queueLevel: 0
    });
    currentProcesses.push(newP);
    renderInputTable();
    syncSimulatorWithInputs();
    showToast(`Added process ${newP.id}`);
  };

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = (e) => {
      const pKey = e.target.dataset.preset;
      loadPreset(pKey);
      showToast(`Loaded ${btn.textContent.trim()} preset`);
    };
  });

  // Random Workload
  btnRandomWorkload.onclick = () => {
    const count = 5;
    const randomized = [];
    for (let i = 1; i <= count; i++) {
      randomized.push(new Process({
        id: `P${i}`,
        arrivalTime: i === 1 ? 0 : Math.floor(Math.random() * 6),
        burstTime: Math.floor(Math.random() * 8) + 2,
        priority: Math.floor(Math.random() * 4) + 1,
        queueLevel: Math.random() > 0.5 ? 0 : 1
      }));
    }
    randomized.sort((a, b) => a.arrivalTime - b.arrivalTime);
    currentProcesses = randomized;
    renderInputTable();
    syncSimulatorWithInputs();
    showToast('Generated 5 randomized processes');
  };

  // Reset / Clear
  btnResetWorkload.onclick = () => {
    currentProcesses = [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1, queueLevel: 0 })
    ];
    renderInputTable();
    syncSimulatorWithInputs();
    showToast('Workload reset to a single process');
  };

  // JSON Export & Import
  btnExportJSON.onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProcesses, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "cpu_scheduling_processes.json");
    dl.click();
    showToast('Exported workload JSON');
  };

  inputImportJSON.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          currentProcesses = parsed.map(item => new Process(item));
          renderInputTable();
          syncSimulatorWithInputs();
          showToast(`Imported ${currentProcesses.length} processes from JSON`);
        }
      } catch (err) {
        alert("Invalid JSON file format.");
      }
    };
    reader.readAsText(file);
  };

  // CSV Export
  btnExportCSV.onclick = () => {
    if (!simulator.simulationResult || !simulator.evaluation) return;
    const procs = simulator.evaluation.processes;
    let csv = "Process,Arrival,Burst,Priority,Start,Completion,TurnaroundTime,WaitingTime,ResponseTime\n";
    procs.forEach(p => {
      csv += `${p.id},${p.arrivalTime},${p.burstTime},${p.priority},${p.startTime},${p.completionTime},${p.turnaroundTime},${p.waitingTime},${p.responseTime}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `schedule_${simulator.currentAlgorithm}.csv`);
    link.click();
    showToast('Exported metrics CSV');
  };

  // Syslog Actions
  if (btnCopySyslog) {
    btnCopySyslog.onclick = () => {
      if (kernelSyslogTerminal) {
        navigator.clipboard.writeText(kernelSyslogTerminal.innerText).then(() => {
          showToast('Kernel log copied to clipboard');
        }).catch(() => {
          showToast('Could not access the clipboard');
        });
      }
    };
  }

  if (btnClearSyslog) {
    btnClearSyslog.onclick = () => {
      if (kernelSyslogTerminal) {
        kernelSyslogTerminal.innerHTML = '<div class="syslog-line"><span class="syslog-msg text-muted">Syslog cleared. Run simulation to trace kernel events.</span></div>';
        showToast('Kernel log cleared');
      }
    };
  }

  // 7. Mode Switching
  const modePills = document.querySelectorAll('#modePills .mode-btn');
  const viewSingle = document.getElementById('viewSingle');
  const viewRace = document.getElementById('viewRace');
  const viewBenchmark = document.getElementById('viewBenchmark');
  const viewDocs = document.getElementById('viewDocs');
  const viewGame = document.getElementById('viewGame');

  function switchMode(targetMode) {
    simulator.pause();
    multiRace.pause();

    modePills.forEach(p => {
      if (p.dataset.mode === targetMode) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // '' falls back to the stylesheet's layout for .view-panel
    viewSingle.style.display = targetMode === 'single' ? '' : 'none';
    viewRace.style.display = targetMode === 'race' ? '' : 'none';
    viewBenchmark.style.display = targetMode === 'benchmark' ? '' : 'none';
    viewDocs.style.display = targetMode === 'docs' ? '' : 'none';
    viewGame.style.display = targetMode === 'game' ? '' : 'none';
    // The workload is not used on the Learn view
    workloadPanel.style.display = targetMode === 'docs' ? 'none' : '';

    if (targetMode === 'race') {
      initRaceMode();
    } else if (targetMode === 'benchmark') {
      runBenchmarkReport();
    } else if (targetMode === 'game') {
      initGameMode();
    }
  }

  modePills.forEach(pill => {
    pill.onclick = () => switchMode(pill.dataset.mode);
  });

  // Guided Tour Modal Controller
  function openTourModal(defaultTab = 'tourNovelty') {
    if (!tourModal) return;
    tourModal.style.display = 'flex';
    switchTourTab(defaultTab);
  }

  function closeTourModal() {
    if (tourModal) tourModal.style.display = 'none';
  }

  function switchTourTab(tabKey) {
    if (!tourNavTabs) return;
    tourNavTabs.querySelectorAll('.tour-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const allSections = document.querySelectorAll('.tour-section');
    allSections.forEach(sec => {
      if (sec.id === `tab-${tabKey}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });
  }

  if (btnOpenTour) btnOpenTour.onclick = () => openTourModal('tourNovelty');
  if (btnTourModalClose) btnTourModalClose.onclick = closeTourModal;
  if (btnTourModalDone) btnTourModalDone.onclick = closeTourModal;
  if (tourNavTabs) {
    tourNavTabs.querySelectorAll('.tour-tab-btn').forEach(btn => {
      btn.onclick = () => switchTourTab(btn.dataset.tab);
    });
  }
  if (tourModal) {
    tourModal.onclick = (e) => {
      if (e.target === tourModal) closeTourModal();
    };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tourModal && tourModal.style.display === 'flex') closeTourModal();
    }
  });

  // 8. MultiRace Mode Handler
  function initRaceMode() {
    const checkedAlgos = Array.from(raceAlgoCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    if (checkedAlgos.length === 0) {
      checkedAlgos.push('FCFS', 'SRTF');
    }
    const q = Math.max(1, parseInt(inputQuantum.value, 10) || 2);
    const cs = Math.max(0, parseInt(inputContextSwitch.value, 10) || 0);

    multiRace.setup(currentProcesses, checkedAlgos, {
      timeQuantum: q,
      contextSwitchOverhead: cs,
      priorityMode: selPriorityMode.value
    });
  }

  btnRestartRace.onclick = () => initRaceMode();

  // 9. Recommendation (multi-criteria benchmark) Handler
  let currentBenchmarkMap = new Map();

  function runBenchmarkReport() {
    const profile = benchmarkProfileSelect.value;
    const q = Math.max(1, parseInt(inputQuantum.value, 10) || 2);
    const cs = Math.max(0, parseInt(inputContextSwitch.value, 10) || 0);

    const report = RecommendationEngine.benchmarkAll(currentProcesses, {
      profile,
      timeQuantum: q,
      contextSwitchOverhead: cs,
      priorityMode: selPriorityMode.value
    });

    if (!report) {
      // No workload: hide the verdict and leaderboard left over from a previous report
      recommendationVerdictCard.style.display = 'none';
      currentBenchmarkMap.clear();
      leaderboardTableBody.innerHTML = `
        <tr>
          <td colspan="10" class="table-empty">No processes in the workload. Add a process or load a preset, then run the benchmark.</td>
        </tr>
      `;
      return;
    }

    currentBenchmarkMap.clear();

    // Render the verdict from the report's own data (scores, metrics, diagnostics, config)
    recommendationVerdictCard.innerHTML = renderVerdictHtml(report);
    // The card starts hidden in index.html until a report has been rendered
    recommendationVerdictCard.style.display = 'block';

    const btnExplainWinner = recommendationVerdictCard.querySelector('#btnExplainWinnerRisks');
    if (btnExplainWinner) {
      btnExplainWinner.onclick = () => openRiskExplanationModal(report.bestAlgorithm);
    }

    // Bind 1-Click Apply & Race Top 3
    const btnApply = recommendationVerdictCard.querySelector('#btnApplyRecommendation');
    if (btnApply) {
      btnApply.onclick = () => {
        const best = report.bestAlgorithm;
        algoSelect.value = best.key;
        applyBenchmarkConfig(report.config);
        switchMode('single');
        syncSimulatorWithInputs();
        simulator.jumpToEnd();
        showToast(`Applied ${best.name} in Simulate`);
      };
    }

    const btnRace = recommendationVerdictCard.querySelector('#btnRaceTop3');
    if (btnRace) {
      btnRace.onclick = () => {
        const top3Keys = report.leaderboard.slice(0, 3).map(r => r.key);
        applyBenchmarkConfig(report.config);
        raceAlgoCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = top3Keys.includes(cb.value);
        });
        switchMode('race');
        initRaceMode();
        showToast('Racing the top 3 schedulers');
      };
    }

    // Render Comparative Leaderboard Table
    leaderboardTableBody.innerHTML = '';
    report.leaderboard.forEach(item => {
      const m = item.metrics;
      currentBenchmarkMap.set(item.key, item);

      const rankClass = item.rank === 1 ? 'rank-1' : (item.rank === 2 ? 'rank-2' : (item.rank === 3 ? 'rank-3' : 'rank-other'));

      // Only show a risk marker when the evaluator actually reported one
      let riskCellHtml = `<span class="risk-none" title="No risks detected">—</span>`;
      if (m.risks && m.risks.length > 0) {
        const level = m.hasHighRisk ? 'High' : 'Moderate';
        riskCellHtml = `
          <button class="btn-risk-badge ${m.hasHighRisk ? 'btn-risk-badge-high' : ''} btn-trigger-risk-modal" data-algo-key="${item.key}"
                  title="${m.risks.map(r => r.name).join('; ')}">
            ${level} <span class="badge-info-icon">Explain</span>
          </button>
        `;
      }

      const score = Math.max(0, Math.min(100, item.compositeScore));
      const tr = document.createElement('tr');
      if (item.rank === 1) tr.className = 'is-winner';
      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${item.rank}</span></td>
        <td class="leaderboard-algo">${item.name}</td>
        <td>
          <div class="score-cell" aria-label="Score ${item.compositeScore} out of 100">
            <div class="score-bar"><div class="score-fill" style="width: ${score}%;"></div></div>
            <span class="score-num">${item.compositeScore}</span>
          </div>
        </td>
        <td class="num">${m.avgWaitingTime}</td>
        <td class="num">${m.avgTurnaroundTime}</td>
        <td class="num">${m.avgResponseTime}</td>
        <td class="num">${m.cpuUtilization}</td>
        <td class="num">${m.fairnessPercent}</td>
        <td class="num">${m.contextSwitchCount}</td>
        <td>${riskCellHtml}</td>
      `;
      leaderboardTableBody.appendChild(tr);
    });

    // Attach click listeners to risk badges
    leaderboardTableBody.querySelectorAll('.btn-trigger-risk-modal').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.algoKey;
        const item = currentBenchmarkMap.get(key);
        if (item) openRiskExplanationModal(item);
      };
    });
  }

  // Verdict card: every statement is read from the benchmark report
  function renderVerdictHtml(report) {
    const best = report.bestAlgorithm;
    const m = best.metrics;
    const board = report.leaderboard;
    const runnerUp = board[1];
    const fcfs = board.find(r => r.key === 'FCFS');
    const goal = benchmarkProfileSelect.options[benchmarkProfileSelect.selectedIndex].text;
    const policy = report.config.priorityMode === 'higher-is-higher' ? 'higher number = higher priority' : 'lower number = higher priority';

    const reasons = [];
    const lead = runnerUp ? best.compositeScore - runnerUp.compositeScore : null;
    if (lead === null) {
      reasons.push(`Highest composite score of the ${board.length} algorithms.`);
    } else if (lead > 0) {
      reasons.push(`Highest composite score of the ${board.length} algorithms, <strong>${lead.toFixed(1)}</strong> points ahead of ${runnerUp.name} (<strong>${runnerUp.compositeScore}</strong>).`);
    } else {
      reasons.push(`Tied on composite score (<strong>${best.compositeScore}</strong>) with ${runnerUp.name}; listed first in the ranking order.`);
    }

    if (fcfs && best.key !== 'FCFS') {
      const diff = fcfs.metrics.avgWaitingTime - m.avgWaitingTime;
      if (diff > 0) {
        reasons.push(`Average wait <strong>${m.avgWaitingTime}</strong> vs <strong>${fcfs.metrics.avgWaitingTime}</strong> under FCFS (${((diff / fcfs.metrics.avgWaitingTime) * 100).toFixed(0)}% lower).`);
      } else if (diff < 0) {
        reasons.push(`Average wait <strong>${m.avgWaitingTime}</strong> is higher than FCFS's <strong>${fcfs.metrics.avgWaitingTime}</strong>, but its composite score is higher.`);
      }
      if (fcfs.metrics.convoyEffectDetected && !m.convoyEffectDetected) {
        reasons.push('No convoy effect flagged, unlike FCFS on this workload.');
      }
    }

    reasons.push(`Fairness <strong>${m.fairnessPercent}%</strong>, CPU utilisation <strong>${m.cpuUtilization}%</strong>, <strong>${m.contextSwitchCount}</strong> context switches.`);

    reasons.push(m.risks && m.risks.length > 0
      ? `Diagnostics flag: ${m.risks.map(r => r.name).join('; ')}.`
      : 'No starvation, convoy or thrashing risk detected.');

    // breakdown values are normalised against the other 8 algorithms (1.00 = best of the 9)
    const standing = [
      ['Avg wait', best.breakdown.normAWT],
      ['Avg TAT', best.breakdown.normATAT],
      ['Avg response', best.breakdown.normART],
      ['Fairness', best.breakdown.normFair],
      ['Context switches', best.breakdown.normCS]
    ].map(([label, v]) => `
      <div class="standing-row">
        <span>${label}</span>
        <div class="score-bar"><div class="score-fill" style="width: ${Math.round(v * 100)}%;"></div></div>
        <span class="num">${v.toFixed(2)}</span>
      </div>`).join('');

    const suggestion = report.recommendedQuantum === report.config.timeQuantum
      ? `The burst-based quantum suggestion is also q = ${report.recommendedQuantum}.`
      : `Burst-based quantum suggestion: q = ${report.recommendedQuantum} (not used for this ranking).`;

    return `
      <div class="verdict-top">
        <div>
          <div class="verdict-eyebrow">Recommended for the ${goal} goal</div>
          <h2 class="verdict-title">${best.name}</h2>
          <p class="verdict-summary">Ranked with q = ${report.config.timeQuantum}, switch cost ${report.config.contextSwitchOverhead}, ${policy}.</p>
        </div>
        <div class="verdict-score">
          <span class="verdict-score-num">${best.compositeScore}</span><span class="verdict-score-max">/ 100</span>
          <div class="score-bar"><div class="score-fill" style="width: ${Math.max(0, Math.min(100, best.compositeScore))}%;"></div></div>
        </div>
      </div>

      <div class="verdict-grid">
        <div>
          <h3 class="verdict-block-title">Why it ranked first</h3>
          <ul class="verdict-highlights">${reasons.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
        <div>
          <h3 class="verdict-block-title">Relative standing (1.00 = best of the ${board.length})</h3>
          ${standing}
          <p class="verdict-note">${suggestion}</p>
        </div>
      </div>

      <div class="verdict-actions">
        <button id="btnApplyRecommendation" class="btn btn-sm btn-primary">Apply in Simulate</button>
        <button id="btnRaceTop3" class="btn btn-sm btn-outline">Race top 3</button>
        ${m.risks && m.risks.length > 0 ? '<button id="btnExplainWinnerRisks" class="btn btn-sm btn-ghost">Explain risks</button>' : ''}
      </div>
    `;
  }

  // Restore the exact settings a benchmark report was ranked with, so the simulator
  // and race reproduce the leaderboard results (inputs may have changed since)
  function applyBenchmarkConfig(config) {
    inputQuantum.value = config.timeQuantum;
    inputContextSwitch.value = config.contextSwitchOverhead;
    selPriorityMode.value = config.priorityMode;
  }

  btnRunBenchmark.onclick = () => runBenchmarkReport();
  benchmarkProfileSelect.onchange = () => runBenchmarkReport();

  // Risk Explanation Modal Controller
  const riskExplanationModal = document.getElementById('riskExplanationModal');
  const riskModalTitle = document.getElementById('riskModalTitle');
  const riskModalAlgoName = document.getElementById('riskModalAlgoName');
  const riskModalIcon = document.getElementById('riskModalIcon');
  const riskModalBody = document.getElementById('riskModalBody');
  const btnRiskModalClose = document.getElementById('btnRiskModalClose');
  const btnRiskModalOk = document.getElementById('btnRiskModalOk');

  function openRiskExplanationModal(item) {
    if (!riskExplanationModal || !item) return;

    const m = item.metrics;
    riskModalTitle.textContent = `${item.name} — Risk & Performance Analysis`;
    riskModalAlgoName.textContent = `Fairness ${m.fairnessPercent}% · Avg wait ${m.avgWaitingTime} units · ${m.contextSwitchCount} context switches`;
    // Coloured status dot: high risk, moderate risk or no risk
    riskModalIcon.className = `risk-modal-icon ${m.hasHighRisk ? 'is-high' : (m.risks && m.risks.length > 0 ? 'is-moderate' : 'is-safe')}`;

    if (!m.risks || m.risks.length === 0) {
      riskModalBody.innerHTML = `
        <div class="risk-item-card">
          <div class="risk-item-header">
            <div class="risk-item-name text-success">No scheduling risks detected</div>
          </div>
          <div class="risk-explanation-text">
            For the current workload, the diagnostics found no starvation, convoy blocking or context-switch thrashing under <strong>${item.name}</strong>.
          </div>
        </div>
      `;
    } else {
      let cardsHtml = '';
      m.risks.forEach((r, idx) => {
        const affectedPills = (r.affectedProcesses && r.affectedProcesses.length > 0)
          ? `<div class="risk-pills-row">
              <span class="text-xs text-muted" style="margin-right: 0.35rem; align-self: center;">Affected:</span>
              ${r.affectedProcesses.map(pid => `<span class="risk-process-pill">${pid}</span>`).join('')}
             </div>`
          : '';

        cardsHtml += `
          <div class="risk-item-card">
            <div class="risk-item-header">
              <div class="risk-item-name">${r.name}</div>
              <span class="badge ${r.severity === 'High Risk' ? 'badge-danger' : 'badge-warning'}">${r.severity}</span>
            </div>

            <div>
              <div class="risk-section-label">Findings</div>
              <div class="risk-explanation-text">${r.explanation}</div>
              ${affectedPills}
            </div>

            <div>
              <div class="risk-section-label">Root cause</div>
              <div class="risk-explanation-text">${r.rootCause}</div>
            </div>

            <div class="risk-mitigation-box">
              <strong>Mitigation:</strong> ${r.mitigation}
            </div>
          </div>
        `;
      });
      riskModalBody.innerHTML = cardsHtml;
    }

    riskExplanationModal.style.display = 'flex';
  }

  function closeRiskModal() {
    if (riskExplanationModal) riskExplanationModal.style.display = 'none';
  }

  if (btnRiskModalClose) btnRiskModalClose.onclick = closeRiskModal;
  if (btnRiskModalOk) btnRiskModalOk.onclick = closeRiskModal;
  if (riskExplanationModal) {
    riskExplanationModal.onclick = (e) => {
      if (e.target === riskExplanationModal) closeRiskModal();
    };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && riskExplanationModal && riskExplanationModal.style.display === 'flex') {
      closeRiskModal();
    }
  });

  // 10. Human vs Scheduler Game Mode Handler
  const gameGanttVisualizer = new GanttChartVisualizer('#gameHumanGantt');
  const gameCurrentTick = document.getElementById('gameCurrentTick');
  const gameContextSwitches = document.getElementById('gameContextSwitches');
  const gameDispatchGrid = document.getElementById('gameDispatchGrid');
  const gameOverModal = document.getElementById('gameOverModal');
  const btnRestartGame = document.getElementById('btnRestartGame');
  const gameOptimalTargetNote = document.getElementById('gameOptimalTargetNote');

  const game = new HumanSchedulerGame({
    onStateChange: (state) => {
      if (gameCurrentTick) gameCurrentTick.textContent = state.currentTick;
      if (gameContextSwitches) gameContextSwitches.textContent = state.contextSwitches;
      renderDispatchCards(state);
      renderHumanGantt(state);
    },
    onGameOver: (summary) => {
      renderGameOverCard(summary);
    }
  });

  function initGameMode() {
    if (gameOverModal) gameOverModal.style.display = 'none';
    game.start(currentProcesses);
    if (gameOptimalTargetNote) {
      gameOptimalTargetNote.innerHTML = game.aiEvaluation
        ? `SRTF benchmark avg wait: <strong>${game.aiEvaluation.avgWaitingTime}</strong> units`
        : 'No SRTF benchmark: the workload is empty.';
    }
  }

  function renderDispatchCards(state) {
    if (!gameDispatchGrid) return;
    if (!state.hasWorkload) {
      gameDispatchGrid.innerHTML = '<div class="text-muted text-sm" style="grid-column: 1/-1;">No processes in the workload. Add a process or load a preset to play.</div>';
      return;
    }
    if (state.isGameOver) {
      gameDispatchGrid.innerHTML = '<div class="text-success text-sm" style="grid-column: 1/-1;">All processes have finished. Your result is below.</div>';
      return;
    }

    let html = '';
    if (state.availableProcesses.length === 0) {
      html += `
        <button class="dispatch-btn dispatch-btn-idle" id="btnDispatchIdle" style="grid-column: 1/-1;">
          <div class="dispatch-pid">CPU idle</div>
          <div class="dispatch-rem">No process is ready at tick ${state.currentTick}. Click to advance time.</div>
        </button>
      `;
    } else {
      state.availableProcesses.forEach(p => {
        html += `
          <button class="dispatch-btn" data-pid="${p.id}" style="border-left-color: ${p.color};">
            <div class="dispatch-pid" style="color: ${p.color};">${p.id}</div>
            <div class="dispatch-rem">Remaining: <strong>${p.remainingTime}</strong> / ${p.burstTime}</div>
            <div class="dispatch-rem">Priority: <strong>${p.priority}</strong></div>
          </button>
        `;
      });
    }

    gameDispatchGrid.innerHTML = html;

    const idleBtn = document.getElementById('btnDispatchIdle');
    if (idleBtn) {
      idleBtn.onclick = () => game.dispatchTick(null);
    }

    gameDispatchGrid.querySelectorAll('.dispatch-btn[data-pid]').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.dataset.pid;
        game.dispatchTick(pid);
      };
    });
  }

  function renderHumanGantt(state) {
    const raw = {
      timeline: state.timeline,
      totalTime: Math.max(state.currentTick, 1)
    };
    gameGanttVisualizer.renderStatic(raw);
  }

  function renderGameOverCard(summary) {
    if (!gameOverModal) return;
    gameOverModal.style.display = 'block';
    const h = summary.humanMetrics;
    const ai = summary.aiMetrics;

    let achievementsHtml = '';
    summary.achievements.forEach(ach => {
      achievementsHtml += `<li>${ach}</li>`;
    });

    let riskDiagnosticHtml = '';
    if (h.hasHighRisk && h.risks && h.risks.length > 0) {
      const highR = h.risks.filter(r => r.severity === 'High Risk');
      riskDiagnosticHtml = `
        <div class="game-risk-note">
          <strong class="text-danger">Scheduling risk detected in your schedule</strong>
          <div class="text-muted" style="margin-top: 0.25rem;">${highR.map(r => r.explanation).join('<br>')}</div>
          <div style="margin-top: 0.35rem;"><strong>Mitigation:</strong> ${highR.map(r => r.mitigation).join(' ')}</div>
        </div>
      `;
    }

    gameOverModal.innerHTML = `
      <div class="game-score-banner">
        <div>
          <div class="game-score-label">Your result</div>
          <h3 class="game-score-title">${summary.rankTitle}</h3>
        </div>
        <div style="text-align: right;">
          <div class="game-score-label">Efficiency vs SRTF</div>
          <div class="game-score-value">${summary.efficiency}%</div>
        </div>
      </div>

      <div class="game-comparison-grid">
        <div class="comp-box">
          <h4>Your schedule</h4>
          <div class="comp-metric-row"><span>Avg wait</span> <strong>${h.avgWaitingTime} units</strong></div>
          <div class="comp-metric-row"><span>Avg TAT</span> <strong>${h.avgTurnaroundTime} units</strong></div>
          <div class="comp-metric-row"><span>Context switches</span> <strong>${h.contextSwitchCount}</strong></div>
          <div class="comp-metric-row"><span>Fairness</span> <strong>${h.fairnessPercent}%</strong></div>
        </div>

        <div class="comp-box">
          <h4>SRTF benchmark</h4>
          <div class="comp-metric-row"><span>Avg wait</span> <strong>${ai.avgWaitingTime} units</strong></div>
          <div class="comp-metric-row"><span>Avg TAT</span> <strong>${ai.avgTurnaroundTime} units</strong></div>
          <div class="comp-metric-row"><span>Context switches</span> <strong>${ai.contextSwitchCount}</strong></div>
          <div class="comp-metric-row"><span>Fairness</span> <strong>${ai.fairnessPercent}%</strong></div>
        </div>
      </div>

      ${riskDiagnosticHtml}

      ${summary.achievements.length > 0 ? `
        <div class="game-achievements">
          <div class="game-achievements-title">Achievements</div>
          <ul class="game-achievements-list">
            ${achievementsHtml}
          </ul>
        </div>
      ` : ''}

      <div class="game-over-actions">
        <button id="btnPlayAgain" class="btn btn-primary">Play again</button>
      </div>
    `;

    const btnPlayAgain = document.getElementById('btnPlayAgain');
    if (btnPlayAgain) {
      btnPlayAgain.onclick = () => initGameMode();
    }
  }

  if (btnRestartGame) {
    btnRestartGame.onclick = () => initGameMode();
  }

  // Initial Load: Standard Preset
  loadPreset('standard');
});
