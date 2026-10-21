/**
 * hrrn.js
 * Highest Response Ratio Next (HRRN) Scheduling Algorithm (Non-Preemptive)
 * Response Ratio R = (Waiting Time + Burst Time) / Burst Time
 */
function runHRRN(processList, options = {}) {
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;
  const completed = [];

  const recordTick = (t, runningId, isCS, readyQueue) => {
    ticks.push({
      time: t,
      runningProcessId: runningId,
      isContextSwitch: isCS,
      readyQueue: readyQueue.map(p => p.id),
      processesSnapshot: processes.map(p => ({
        id: p.id,
        remainingTime: p.remainingTime,
        state: p.state,
        waitingTime: p.waitingTime,
        turnaroundTime: p.turnaroundTime,
        currentQueue: p.currentQueue
      })),
      activeQueueLevel: 0
    });
  };

  let safetyCounter = 0;
  const maxSafety = 10000;

  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    const available = processes.filter(p => p.arrivalTime <= currentTime && p.completionTime === -1);

    if (available.length === 0) {
      const unarrived = processes.filter(p => p.completionTime === -1);
      if (unarrived.length === 0) break;
      const nextArrival = Math.min(...unarrived.map(p => p.arrivalTime));
      if (!isFinite(nextArrival) || nextArrival <= currentTime) {
        currentTime++;
        continue;
      }
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

    // Compute Response Ratio for each available process
    // R = ( (currentTime - arrivalTime) + burstTime ) / burstTime
    available.forEach(p => {
      const waiting = currentTime - p.arrivalTime;
      p.responseRatio = (waiting + p.burstTime) / p.burstTime;
    });

    // Sort by responseRatio DESC, then arrivalTime ASC
    available.sort((a, b) => {
      if (b.responseRatio !== a.responseRatio) return b.responseRatio - a.responseRatio;
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.id.localeCompare(b.id);
    });

    const currentProcess = available[0];
    const readyQueue = available.slice(1);

    // A context switch is any change to a different process (the first dispatch is not one).
    // Overhead time is only added to the schedule when a switch has a cost.
    const isSwitch = lastRunningId !== null && lastRunningId !== currentProcess.id;
    if (isSwitch) contextSwitchCount++;
    if (isSwitch && contextSwitchOverhead > 0) {
      timeline.push({
        type: 'CONTEXT_SWITCH',
        from: lastRunningId,
        to: currentProcess.id,
        start: currentTime,
        end: currentTime + contextSwitchOverhead,
        duration: contextSwitchOverhead
      });
      for (let cs = 0; cs < contextSwitchOverhead; cs++) {
        const tickTime = currentTime + cs;
        const currentReady = processes.filter(p => p.arrivalTime <= tickTime && p.completionTime === -1 && p.id !== currentProcess.id);
        recordTick(tickTime, null, true, currentReady);
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
    algorithm: 'HRRN',
    name: 'Highest Response Ratio Next (HRRN)',
    timeline,
    ticks,
    processes,
    totalTime: currentTime,
    idleTime,
    contextSwitchCount,
    contextSwitchOverhead,
    // false when the safety limit stopped the loop before every process finished
    isComplete: completed.length === processes.length,
    unfinishedProcessIds: processes.filter(p => p.completionTime < 0).map(p => p.id),
    stepLimit: maxSafety
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = runHRRN;
}
