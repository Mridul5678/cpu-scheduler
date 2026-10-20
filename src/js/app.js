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
  const optQuantumGroup = document.getElementById('optQuantumGroup');
  const inputQuantum = document.getElementById('inputQuantum');
  const optPriorityModeGroup = document.getElementById('optPriorityModeGroup');
  const selPriorityMode = document.getElementById('selPriorityMode');
  const inputContextSwitch = document.getElementById('inputContextSwitch');
  const btnAutoQuantum = document.getElementById('btnAutoQuantum');

  const btnCtrlReset = document.getElementById('btnCtrlReset');
  const btnCtrlPrev = document.getElementById('btnCtrlPrev');
  const btnCtrlPlay = document.getElementById('btnCtrlPlay');
  const btnCtrlNext = document.getElementById('btnCtrlNext');
  const btnCtrlEnd = document.getElementById('btnCtrlEnd');
  const timeReadoutBadge = document.getElementById('timeReadoutBadge');
  const speedSlider = document.getElementById('speedSlider');
  const speedValueLabel = document.getElementById('speedValueLabel');

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

  // Toast Notification System
  function showToast(message, icon = '✓') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
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
        <div class="algo-spec-title">
          <span>📖</span>
          <span>${spec.name}</span>
        </div>
        <div class="algo-spec-tags">
          <span class="algo-tag ${spec.tagClass}">${spec.tag}</span>
          <span class="algo-tag algo-tag-complexity">${spec.complexity}</span>
        </div>
      </div>
      <div class="algo-spec-grid">
        <div class="algo-spec-item">
          <div class="algo-spec-label">Selection Rule / Metric</div>
          <div class="algo-spec-val font-mono" style="color: #67e8f9;">${spec.formula}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Primary Advantage</div>
          <div class="algo-spec-val" style="color: #86efac;">${spec.strength}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Key OS Pitfall</div>
          <div class="algo-spec-val" style="color: #fca5a5;">${spec.pitfall}</div>
        </div>
        <div class="algo-spec-item">
          <div class="algo-spec-label">Real-World OS Reference</div>
          <div class="algo-spec-val" style="color: #cbd5e1;">${spec.realWorld}</div>
        </div>
      </div>
    `;
  }

  // Linux Kernel Dispatcher Syslog Generator (/dev/kmsg)
  function generateKernelSyslog(result, processes, config = {}) {
    if (!kernelSyslogTerminal || !result) return;
    const logs = [];
    const formatTime = (t) => `[ ${(t || 0).toFixed(6).padStart(8, ' ')} ]`;

    const algoName = config.algorithm || simulator.currentAlgorithm || 'CPU_SCHEDULER';
    const q = config.timeQuantum || simulator.timeQuantum || 2;
    const cs = config.contextSwitchOverhead || simulator.contextSwitchOverhead || 0;

    logs.push({
      time: 0,
      tag: 'BOOT',
      tagClass: 'syslog-tag-boot',
      msg: `Linux kernel 6.8.0-schedx: Core #0 initialized. Scheduler active: ${algoName} (q=${q}, cs_cost=${cs}ms)`
    });

    // Track arrivals
    (processes || []).forEach(p => {
      logs.push({
        time: p.arrivalTime,
        tag: 'ARRIVAL',
        tagClass: 'syslog-tag-arrival',
        msg: `task_struct: PID ${p.id} arrived in TASK_RUNNING state [burst=${p.burstTime}ms, prio=${p.priority}, qLevel=${p.queueLevel}]`
      });
    });

    // Track timeline events
    let prevPid = null;
    (result.timeline || []).forEach((slice) => {
      if (slice.isContextSwitch) {
        logs.push({
          time: slice.startTime,
          tag: 'CSWITCH',
          tagClass: 'syslog-tag-cswitch',
          msg: `Hardware Context Switch: core0 flushing TLB registers -> switching PCB context (${slice.duration}ms)`
        });
      } else if (slice.isIdle) {
        logs.push({
          time: slice.startTime,
          tag: 'IDLE',
          tagClass: 'syslog-tag-idle',
          msg: `cpu_idle: Ready queue empty -> core0 entering C1E power-saving idle state [${slice.startTime}ms - ${slice.endTime}ms]`
        });
        prevPid = null;
      } else {
        if (prevPid && prevPid !== slice.processId && cs === 0) {
          logs.push({
            time: slice.startTime,
            tag: 'PREEMPT',
            tagClass: 'syslog-tag-preempt',
            msg: `sched_switch: PID ${prevPid} preempted/demoted -> PID ${slice.processId} scheduled on Core #0`
          });
        }
        logs.push({
          time: slice.startTime,
          tag: 'DISPATCH',
          tagClass: 'syslog-tag-dispatch',
          msg: `sched_dispatch: PID ${slice.processId} dispatched to CPU Core #0 for slice [${slice.startTime}ms -> ${slice.endTime}ms]`
        });
        prevPid = slice.processId;
      }
    });

    // Track completions
    if (result.processes) {
      result.processes.forEach(p => {
        logs.push({
          time: p.completionTime,
          tag: 'COMPLETE',
          tagClass: 'syslog-tag-complete',
          msg: `task_exit: PID ${p.id} completed execution -> state TASK_DEAD (TAT=${p.turnaroundTime}ms, WT=${p.waitingTime}ms, RT=${p.responseTime}ms)`
        });
      });
    }

    // Final summary
    if (result.totalTime > 0) {
      const utilPct = (100 - (result.idleTime / result.totalTime * 100)).toFixed(1);
      logs.push({
        time: result.totalTime,
        tag: 'COMPLETE',
        tagClass: 'syslog-tag-complete',
        msg: `kernel_exec: All workloads processed. Total: ${result.totalTime}ms | CPU Util: ${utilPct}%`
      });
    }

    // Sort chronologically
    logs.sort((a, b) => a.time - b.time);

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
          <span class="badge font-mono" style="background: ${p.color}20; color: ${p.color}; border: 1px solid ${p.color};">
            ${p.id}
          </span>
        </td>
        <td>
          <input type="number" class="form-control form-control-sm font-mono input-arr" data-index="${index}" value="${p.arrivalTime}" min="0" max="100" style="width: 55px; padding: 0.2rem 0.4rem;">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm font-mono input-burst" data-index="${index}" value="${p.burstTime}" min="1" max="100" style="width: 55px; padding: 0.2rem 0.4rem;">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm font-mono input-pri" data-index="${index}" value="${p.priority}" min="1" max="20" style="width: 50px; padding: 0.2rem 0.4rem;">
        </td>
        <td>
          <select class="form-select form-select-sm font-mono input-q" data-index="${index}" style="width: 55px; padding: 0.2rem 0.3rem;">
            <option value="0" ${p.queueLevel === 0 ? 'selected' : ''}>Q0</option>
            <option value="1" ${p.queueLevel === 1 ? 'selected' : ''}>Q1</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-outline btn-del-row text-danger" data-index="${index}" style="padding: 0.15rem 0.35rem;" title="Delete">✕</button>
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

    updateAlgoOptionsVisibility(algo);
    renderAlgorithmSpec(algo);
    ganttAlgoLabel.textContent = algoSelect.options[algoSelect.selectedIndex].text;
    renderOutputTableInitial();
    hideSingleRiskAlert();

    // Run synchronous calculation to populate kernel syslog & metrics immediately
    if (simulator.simulationResult) {
      generateKernelSyslog(simulator.simulationResult, currentProcesses, {
        algorithm: algoSelect.options[algoSelect.selectedIndex].text,
        timeQuantum: q,
        contextSwitchOverhead: cs
      });
    }
  }

  function updateAlgoOptionsVisibility(algo) {
    optQuantumGroup.style.display = (algo === 'RR' || algo === 'MLQ') ? 'block' : 'none';
    optPriorityModeGroup.style.display = (algo === 'Priority-NP' || algo === 'Priority-P') ? 'block' : 'none';
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
          <span class="badge font-mono" style="background: ${p.color}20; color: ${p.color}; border: 1px solid ${p.color};">
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
    btnCtrlPlay.innerHTML = isPlaying ? '⏸ Pause' : '▶ Play';
    btnCtrlPlay.className = isPlaying ? 'btn btn-warning' : 'btn btn-primary';
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
    valAWT.innerHTML = `${ev.avgWaitingTime}<span class="metric-unit">ms</span>`;
    valATAT.innerHTML = `${ev.avgTurnaroundTime}<span class="metric-unit">ms</span>`;
    valUtil.innerHTML = `${ev.cpuUtilization}<span class="metric-unit">%</span>`;
    valIdleSub.textContent = `${ev.idleTime} ms idle time`;
    valFairness.innerHTML = `${ev.fairnessPercent}<span class="metric-unit">%</span>`;
    valThroughput.innerHTML = `${ev.throughput}<span class="metric-unit">p/t</span>`;
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
          <div style="margin-bottom: 0.65rem;">
            <div style="font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem;">
              <span>${r.icon}</span> <span>${r.name}</span>
            </div>
            <div class="risk-alert-body" style="margin-top: 0.25rem;">
              ${r.explanation}
            </div>
            <div class="risk-alert-mitigation">
              <strong>💡 OS Mitigation Strategy:</strong> ${r.mitigation}
            </div>
          </div>
        `;
      });

      box.className = 'risk-diagnostic-container risk-alert-danger mb-3';
      box.innerHTML = `
        <div class="risk-alert-header">
          <div class="risk-alert-title text-danger">
            <span>🚨</span> <span>Kernel Diagnostic Warning: Scheduling Risk Detected in ${ev.name || ev.algorithm}</span>
          </div>
          <button class="btn btn-sm btn-outline text-xs btn-open-diag" style="border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
            Deep Theory Analysis ℹ️
          </button>
        </div>
        ${risksHtml}
      `;
      box.style.display = 'block';

      const btnOpen = box.querySelector('.btn-open-diag');
      if (btnOpen) {
        btnOpen.onclick = () => openRiskExplanationModal({ name: ev.name || ev.algorithm, metrics: ev });
      }
    } else {
      box.className = 'risk-diagnostic-container risk-alert-safe mb-3';
      box.innerHTML = `
        <div class="risk-alert-header" style="margin-bottom: 0;">
          <div class="risk-alert-title text-success">
            <span>🛡️</span> <span>Kernel Health: Optimal</span>
          </div>
          <span class="text-xs text-muted">0 Starvation, Convoy Blocking, or Thrashing detected (Fairness: ${ev.fairnessPercent}%)</span>
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

  speedSlider.oninput = (e) => {
    const val = parseFloat(e.target.value);
    speedValueLabel.textContent = `${val.toFixed(2)}x`;
    simulator.setSpeedMultiplier(val);
  };

  algoSelect.onchange = () => syncSimulatorWithInputs();
  inputQuantum.onchange = () => syncSimulatorWithInputs();
  inputContextSwitch.onchange = () => syncSimulatorWithInputs();
  selPriorityMode.onchange = () => syncSimulatorWithInputs();

  // Auto-Suggest Quantum
  btnAutoQuantum.onclick = () => {
    const optQ = RecommendationEngine.computeOptimalQuantum(currentProcesses);
    inputQuantum.value = optQ;
    syncSimulatorWithInputs();
    showToast(`Calculated Optimal Quantum: q = ${optQ}`, '✨');
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
    showToast(`Added process ${newP.id}`, '➕');
  };

  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = (e) => {
      const pKey = e.target.dataset.preset;
      loadPreset(pKey);
      showToast(`Loaded ${btn.textContent.trim()} preset`, '📂');
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
    showToast('Generated 5 randomized processes', '🎲');
  };

  // Reset / Clear
  btnResetWorkload.onclick = () => {
    currentProcesses = [
      new Process({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 1, queueLevel: 0 })
    ];
    renderInputTable();
    syncSimulatorWithInputs();
    showToast('Reset workload matrix', '🔄');
  };

  // JSON Export & Import
  btnExportJSON.onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProcesses, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "cpu_scheduling_processes.json");
    dl.click();
    showToast('Exported workload JSON', '💾');
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
          showToast(`Imported ${currentProcesses.length} processes from JSON`, '📥');
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
    showToast('Exported metrics CSV', '📊');
  };

  // Syslog Actions
  if (btnCopySyslog) {
    btnCopySyslog.onclick = () => {
      if (kernelSyslogTerminal) {
        navigator.clipboard.writeText(kernelSyslogTerminal.innerText).then(() => {
          showToast('Kernel Syslog copied to clipboard!', '📋');
        }).catch(() => {
          showToast('Copied to clipboard!', '📋');
        });
      }
    };
  }

  if (btnClearSyslog) {
    btnClearSyslog.onclick = () => {
      if (kernelSyslogTerminal) {
        kernelSyslogTerminal.innerHTML = '<div class="syslog-line"><span class="syslog-msg text-muted">Syslog cleared. Run simulation to trace kernel events.</span></div>';
        showToast('Kernel Syslog cleared', '🗑️');
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

    viewSingle.style.display = targetMode === 'single' ? 'block' : 'none';
    viewRace.style.display = targetMode === 'race' ? 'block' : 'none';
    viewBenchmark.style.display = targetMode === 'benchmark' ? 'block' : 'none';
    viewDocs.style.display = targetMode === 'docs' ? 'block' : 'none';
    viewGame.style.display = targetMode === 'game' ? 'block' : 'none';

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

  // 9. AI Recommendation & Benchmark Handler
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
      // No workload: hide any verdict left over from a previous report
      recommendationVerdictCard.style.display = 'none';
      return;
    }

    currentBenchmarkMap.clear();

    // Render Verdict Card
    const diag = report.diagnostic;
    let highlightsHtml = '';
    diag.highlights.forEach(h => {
      highlightsHtml += `<li>${h}</li>`;
    });

    recommendationVerdictCard.innerHTML = `
      <div class="verdict-header">
        <div>
          <span class="badge badge-novelty" style="margin-left: 0; margin-bottom: 0.35rem;">AI Recommendation Verdict</span>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: #fff;">${diag.title}</h2>
        </div>
        <div class="verdict-score-badge">
          <span>Efficiency Score</span>
          <span class="verdict-score-num">${diag.score}</span>/100
        </div>
      </div>
      <div class="verdict-content">
        <p>${diag.summary}</p>
        <ul class="verdict-highlights">
          ${highlightsHtml}
        </ul>
        ${diag.runnerUpNote ? `<div style="margin-top: 0.65rem; font-size: 0.85rem; color: var(--text-muted);">${diag.runnerUpNote}</div>` : ''}

        <div style="margin-top: 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
          <button id="btnApplyRecommendation" class="btn btn-sm btn-primary" style="display: flex; align-items: center; gap: 0.4rem;">
            <span>🚀</span> Apply ${report.bestAlgorithm.name} to Single Simulator
          </button>
          <button id="btnRaceTop3" class="btn btn-sm btn-outline" style="display: flex; align-items: center; gap: 0.4rem;">
            <span>⚡</span> Race Top 3 Schedulers
          </button>
        </div>
      </div>
    `;
    // The card starts hidden in index.html until a report has been rendered
    recommendationVerdictCard.style.display = 'block';

    // Bind 1-Click Apply & Race Top 3
    const btnApply = recommendationVerdictCard.querySelector('#btnApplyRecommendation');
    if (btnApply) {
      btnApply.onclick = () => {
        const best = report.bestAlgorithm;
        algoSelect.value = best.key;
        if (best.key === 'RR' || best.key === 'MLQ') {
          inputQuantum.value = report.recommendedQuantum;
        }
        switchMode('single');
        syncSimulatorWithInputs();
        simulator.jumpToEnd();
        showToast(`Applied ${best.name} to Single Simulator!`, '🚀');
      };
    }

    const btnRace = recommendationVerdictCard.querySelector('#btnRaceTop3');
    if (btnRace) {
      btnRace.onclick = () => {
        const top3Keys = report.leaderboard.slice(0, 3).map(r => r.key);
        raceAlgoCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = top3Keys.includes(cb.value);
        });
        switchMode('race');
        initRaceMode();
        showToast('Started Multi-Race with Top 3 Schedulers!', '⚡');
      };
    }

    // Render Comparative Leaderboard Table
    leaderboardTableBody.innerHTML = '';
    report.leaderboard.forEach(item => {
      const m = item.metrics;
      currentBenchmarkMap.set(item.key, item);

      const rankClass = item.rank === 1 ? 'rank-1' : (item.rank === 2 ? 'rank-2' : (item.rank === 3 ? 'rank-3' : 'rank-other'));

      let riskCellHtml = `<span class="badge-risk-safe">✓ Optimal</span>`;
      if (m.hasHighRisk) {
        riskCellHtml = `
          <button class="btn-risk-badge btn-risk-badge-high btn-trigger-risk-modal" data-algo-key="${item.key}" title="Click to view deep OS explanation">
            ⚠️ High Risk <span class="badge-info-icon">Explain ℹ️</span>
          </button>
        `;
      } else if (m.risks && m.risks.length > 0) {
        riskCellHtml = `
          <button class="btn-risk-badge btn-trigger-risk-modal" data-algo-key="${item.key}" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="Click to view explanation">
            ⚠️ Moderate <span class="badge-info-icon">Explain ℹ️</span>
          </button>
        `;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${item.rank}</span></td>
        <td><strong>${item.name}</strong></td>
        <td><strong style="color: var(--primary); font-family: var(--font-mono);">${item.compositeScore}</strong></td>
        <td class="font-mono">${m.avgWaitingTime} ms</td>
        <td class="font-mono">${m.avgTurnaroundTime} ms</td>
        <td class="font-mono">${m.avgResponseTime} ms</td>
        <td class="font-mono">${m.cpuUtilization}%</td>
        <td class="font-mono">${m.fairnessPercent}%</td>
        <td class="font-mono">${m.contextSwitchCount}</td>
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
    riskModalAlgoName.textContent = `Evaluation: Fairness ${m.fairnessPercent}% | Avg Wait: ${m.avgWaitingTime}ms | CS: ${m.contextSwitchCount}`;
    riskModalIcon.textContent = m.hasHighRisk ? '🚨' : (m.risks && m.risks.length > 0 ? '⚠️' : '🛡️');

    if (!m.risks || m.risks.length === 0) {
      riskModalBody.innerHTML = `
        <div class="risk-item-card" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
          <div class="risk-item-header">
            <div class="risk-item-name" style="color: #6ee7b7;">🛡️ No Scheduling Anomalies Detected</div>
            <span class="badge badge-success">Optimal Execution</span>
          </div>
          <div class="risk-explanation-text">
            Under the current workload, <strong>${item.name}</strong> achieves balanced execution with zero process starvation, no convoy blocking, and minimal preemption overhead.
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
              <div class="risk-item-name">
                <span>${r.icon}</span> <span>${r.name}</span>
              </div>
              <span class="badge ${r.badgeClass}">${r.severity}</span>
            </div>

            <div>
              <div class="risk-section-label">Diagnostic Findings & Impact</div>
              <div class="risk-explanation-text">${r.explanation}</div>
              ${affectedPills}
            </div>

            <div>
              <div class="risk-section-label">Operating Systems Root Cause</div>
              <div class="risk-explanation-text" style="color: #cbd5e1;">${r.rootCause}</div>
            </div>

            <div class="risk-mitigation-box">
              <strong>💡 Recommended OS Solution:</strong> ${r.mitigation}
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
    if (game.aiEvaluation && gameOptimalTargetNote) {
      gameOptimalTargetNote.innerHTML = `AI Optimal (SRTF) Target Waiting Time: <strong>${game.aiEvaluation.avgWaitingTime} ms</strong>`;
    }
  }

  function renderDispatchCards(state) {
    if (!gameDispatchGrid) return;
    if (state.isGameOver) {
      gameDispatchGrid.innerHTML = '<div class="text-success text-sm font-semibold" style="grid-column: 1/-1;">🎉 All processes executed! Check your score below.</div>';
      return;
    }

    let html = '';
    if (state.availableProcesses.length === 0) {
      html += `
        <button class="dispatch-btn dispatch-btn-idle" id="btnDispatchIdle" style="grid-column: 1/-1; padding: 1rem;">
          <div class="dispatch-pid" style="color: #94a3b8;">💤 CPU IDLE</div>
          <div class="dispatch-rem">No processes ready at tick ${state.currentTick}. Click to advance time.</div>
        </button>
      `;
    } else {
      state.availableProcesses.forEach(p => {
        html += `
          <button class="dispatch-btn" data-pid="${p.id}" style="border-color: ${p.color}; box-shadow: 0 0 10px ${p.color}25;">
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
        <div style="margin-top: 1rem; padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-md);">
          <strong class="text-xs uppercase text-danger" style="display: flex; align-items: center; gap: 0.4rem;">
            <span>⚠️</span> Kernel Scheduling Risk Detected in Your Schedule:
          </strong>
          <div style="font-size: 0.85rem; color: #fca5a5; margin-top: 0.35rem;">
            ${highR.map(r => r.explanation).join('<br>')}
          </div>
          <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.4rem;">
            <strong>OS Insight:</strong> ${highR.map(r => r.mitigation).join(' ')}
          </div>
        </div>
      `;
    }

    gameOverModal.innerHTML = `
      <div class="game-score-banner">
        <div>
          <span class="badge ${summary.badgeClass}" style="margin-bottom: 0.4rem;">Performance Assessment</span>
          <h3 style="font-size: 1.5rem; font-weight: 800; color: #fff;">${summary.rankTitle}</h3>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Efficiency Rating</div>
          <div style="font-size: 2rem; font-weight: 800; font-family: var(--font-mono); color: var(--primary);">
            ${summary.efficiency}%
          </div>
        </div>
      </div>

      <div class="game-comparison-grid">
        <div class="comp-box">
          <h4>Your Decisions (Human Scheduler)</h4>
          <div class="comp-metric-row"><span>Average Waiting Time:</span> <strong>${h.avgWaitingTime} ms</strong></div>
          <div class="comp-metric-row"><span>Average Turnaround Time:</span> <strong>${h.avgTurnaroundTime} ms</strong></div>
          <div class="comp-metric-row"><span>Context Switches:</span> <strong>${h.contextSwitchCount}</strong></div>
          <div class="comp-metric-row"><span>Jain's Fairness Index:</span> <strong>${h.fairnessPercent}%</strong></div>
        </div>

        <div class="comp-box">
          <h4>AI Optimal Benchmark (SRTF)</h4>
          <div class="comp-metric-row"><span>Average Waiting Time:</span> <strong>${ai.avgWaitingTime} ms</strong></div>
          <div class="comp-metric-row"><span>Average Turnaround Time:</span> <strong>${ai.avgTurnaroundTime} ms</strong></div>
          <div class="comp-metric-row"><span>Context Switches:</span> <strong>${ai.contextSwitchCount}</strong></div>
          <div class="comp-metric-row"><span>Jain's Fairness Index:</span> <strong>${ai.fairnessPercent}%</strong></div>
        </div>
      </div>

      ${riskDiagnosticHtml}

      ${summary.achievements.length > 0 ? `
        <div class="game-achievements">
          <strong class="text-xs uppercase" style="color: #34d399;">🎖️ Achievements Unlocked:</strong>
          <ul class="game-achievements-list">
            ${achievementsHtml}
          </ul>
        </div>
      ` : ''}

      <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
        <button id="btnPlayAgain" class="btn btn-primary">🎮 Play Again</button>
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
