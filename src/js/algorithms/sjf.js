/**
 * sjf.js
 * Shortest Job First (SJF) - Non-Preemptive Scheduling Algorithm
 */
function runSJF(processList, options = {}) {
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;
  const completed = [];

  const recordTick = (t, runningId, isCS, arrivedQueue, qLevel = 0) => {
    ticks.push({
      time: t,
      runningProcessId: runningId,
      isContextSwitch: isCS,
      readyQueue: arrivedQueue.map(p => p.id),
      processesSnapshot: processes.map(p => ({
        id: p.id,
        remainingTime: p.remainingTime,
        state: p.state,
        waitingTime: p.waitingTime,
        turnaroundTime: p.turnaroundTime,
        currentQueue: p.currentQueue
      })),
      activeQueueLevel: qLevel
    });
  };

  let safetyCounter = 0;
  const maxSafety = 10000;

  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    // Arrived and not completed
    const available = processes.filter(p => p.arrivalTime <= currentTime && p.completionTime === -1);

    if (available.length === 0) {
      // Find next earliest arrival time
      const unarrived = processes.filter(p => p.completionTime === -1);
      if (unarrived.length === 0) break;
      const nextArrival = Math.min(...unarrived.map(p => p.arrivalTime));
      if (!isFinite(nextArrival) || nextArrival <= currentTime) break;
      const idleDuration = nextArrival - currentTime;
      timeline.push({
        type: 'IDLE',
        processId: null,
        start: currentTime,
        end: nextArrival,
        duration: idleDuration
      });
      for (let t = currentTime; t < nextArrival; t++) {
        recordTick(t, null, false, []);
      }
      idleTime += idleDuration;
      currentTime = nextArrival;
      continue;
    }

    // Sort available by burstTime ASC, then arrivalTime ASC, then ID
    available.sort((a, b) => {
      if (a.burstTime !== b.burstTime) return a.burstTime - b.burstTime;
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.id.localeCompare(b.id);
    });

    const currentProcess = available[0];
    const readyQueue = available.slice(1);

    // Context switch
    if (contextSwitchOverhead > 0 && lastRunningId !== null && lastRunningId !== currentProcess.id) {
      timeline.push({
        type: 'CONTEXT_SWITCH',
        from: lastRunningId,
        to: currentProcess.id,
        start: currentTime,
        end: currentTime + contextSwitchOverhead,
        duration: contextSwitchOverhead
      });
      contextSwitchCount++;
      for (let cs = 0; cs < contextSwitchOverhead; cs++) {
        const tickTime = currentTime + cs;
        const currentAvailable = processes.filter(p => p.arrivalTime <= tickTime && p.completionTime === -1 && p.id !== currentProcess.id);
        recordTick(tickTime, null, true, currentAvailable);
      }
      currentTime += contextSwitchOverhead;
    }

    if (currentProcess.startTime === -1) {
      currentProcess.startTime = currentTime;
      currentProcess.responseTime = currentTime - currentProcess.arrivalTime;
    }

    currentProcess.state = 'RUNNING';
    const burst = currentProcess.burstTime;
    const startExec = currentTime;

    timeline.push({
      type: 'PROCESS',
      processId: currentProcess.id,
      color: currentProcess.color,
      start: startExec,
      end: startExec + burst,
      duration: burst,
      queueLevel: 0
    });

    currentProcess.executedSegments.push({
      start: startExec,
      end: startExec + burst,
      queueLevel: 0
    });

    for (let b = 0; b < burst; b++) {
      const tickTime = currentTime + b;
      const currentReady = processes.filter(p => p.arrivalTime <= tickTime && p.completionTime === -1 && p.id !== currentProcess.id);
      currentReady.sort((a, b) => a.burstTime - b.burstTime);
      currentProcess.remainingTime = burst - (b + 1);
      recordTick(tickTime, currentProcess.id, false, currentReady);
    }

    currentTime += burst;
    currentProcess.finalize(currentTime);
    completed.push(currentProcess);
    lastRunningId = currentProcess.id;
  }

  recordTick(currentTime, null, false, []);

  return {
    algorithm: 'SJF',
    name: 'Shortest Job First (Non-Preemptive)',
    timeline,
    ticks,
    processes,
    totalTime: currentTime,
    idleTime,
    contextSwitchCount
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = runSJF;
}
