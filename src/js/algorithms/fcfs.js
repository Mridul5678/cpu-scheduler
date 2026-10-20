/**
 * fcfs.js
 * First-Come, First-Served (FCFS) Scheduling Algorithm
 */
function runFCFS(processList, options = {}) {
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  // Clone processes to avoid mutating originals
  const processes = processList.map(p => p.clone());

  // Sort primarily by arrivalTime, secondarily by original order
  const sorted = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;

  const arrivedQueue = [];
  let nextToArriveIdx = 0;
  const completed = [];

  const recordTick = (t, runningId, isCS, qLevel = 0) => {
    // Update ready processes waiting time or state for tick
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
    // Check arrivals at or before currentTime
    while (nextToArriveIdx < sorted.length && sorted[nextToArriveIdx].arrivalTime <= currentTime) {
      const p = sorted[nextToArriveIdx];
      p.state = 'READY';
      arrivedQueue.push(p);
      nextToArriveIdx++;
    }

    if (arrivedQueue.length === 0) {
      if (nextToArriveIdx >= sorted.length) break;
      const nextArrival = sorted[nextToArriveIdx].arrivalTime;
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
        recordTick(t, null, false);
      }
      idleTime += idleDuration;
      currentTime = nextArrival;
      continue;
    }

    // Pick first arrived process
    const currentProcess = arrivedQueue.shift();

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
        // While context switching, check if new processes arrive
        const tickTime = currentTime + cs;
        while (nextToArriveIdx < sorted.length && sorted[nextToArriveIdx].arrivalTime <= tickTime) {
          const p = sorted[nextToArriveIdx];
          p.state = 'READY';
          arrivedQueue.push(p);
          nextToArriveIdx++;
        }
        recordTick(tickTime, null, true);
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
      // Arriving processes during execution
      while (nextToArriveIdx < sorted.length && sorted[nextToArriveIdx].arrivalTime <= tickTime) {
        const p = sorted[nextToArriveIdx];
        p.state = 'READY';
        arrivedQueue.push(p);
        nextToArriveIdx++;
      }
      currentProcess.remainingTime = burst - (b + 1);
      recordTick(tickTime, currentProcess.id, false);
    }

    currentTime += burst;
    currentProcess.finalize(currentTime);
    completed.push(currentProcess);
    lastRunningId = currentProcess.id;
  }

  // Final tick snapshot
  recordTick(currentTime, null, false);

  return {
    algorithm: 'FCFS',
    name: 'First-Come, First-Served',
    timeline,
    ticks,
    processes,
    totalTime: currentTime,
    idleTime,
    contextSwitchCount,
    contextSwitchOverhead
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = runFCFS;
}
