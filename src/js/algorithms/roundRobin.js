/**
 * roundRobin.js
 * Round Robin (RR) CPU Scheduling Algorithm
 */
function runRoundRobin(processList, options = {}) {
  const quantum = Math.max(1, Number(options.timeQuantum) || 2);
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  // Sort by arrival time primarily
  const sorted = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime || a.id.localeCompare(b.id));

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;

  const readyQueue = [];
  let nextArriveIdx = 0;
  const completed = [];

  const recordTick = (t, runningId, isCS, qLevel = 0) => {
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
      activeQueueLevel: qLevel
    });
  };

  let safetyCounter = 0;
  const maxSafety = 10000;

  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    // Collect arrivals up to currentTime
    while (nextArriveIdx < sorted.length && sorted[nextArriveIdx].arrivalTime <= currentTime) {
      const p = sorted[nextArriveIdx];
      p.state = 'READY';
      readyQueue.push(p);
      nextArriveIdx++;
    }

    if (readyQueue.length === 0) {
      if (nextArriveIdx >= sorted.length) break;
      const nextArrival = sorted[nextArriveIdx].arrivalTime;
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
        recordTick(t, null, false);
      }
      idleTime += idleDuration;
      currentTime = nextArrival;
      continue;
    }

    const currentProcess = readyQueue.shift();

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
        while (nextArriveIdx < sorted.length && sorted[nextArriveIdx].arrivalTime <= tickTime) {
          const p = sorted[nextArriveIdx];
          p.state = 'READY';
          readyQueue.push(p);
          nextArriveIdx++;
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
    const executeSlice = Math.min(quantum, currentProcess.remainingTime);
    const startExec = currentTime;

    timeline.push({
      type: 'PROCESS',
      processId: currentProcess.id,
      color: currentProcess.color,
      start: startExec,
      end: startExec + executeSlice,
      duration: executeSlice,
      queueLevel: 0
    });

    currentProcess.executedSegments.push({
      start: startExec,
      end: startExec + executeSlice,
      queueLevel: 0
    });

    for (let s = 0; s < executeSlice; s++) {
      const tickTime = currentTime + s;
      // Arriving processes during execution slice
      while (nextArriveIdx < sorted.length && sorted[nextArriveIdx].arrivalTime <= tickTime) {
        const p = sorted[nextArriveIdx];
        p.state = 'READY';
        readyQueue.push(p);
        nextArriveIdx++;
      }
      currentProcess.remainingTime -= 1;
      recordTick(tickTime, currentProcess.id, false);
    }

    currentTime += executeSlice;
    lastRunningId = currentProcess.id;

    // Check newly arrived processes exactly at the slice end time before re-enqueuing current
    while (nextArriveIdx < sorted.length && sorted[nextArriveIdx].arrivalTime <= currentTime) {
      const p = sorted[nextArriveIdx];
      p.state = 'READY';
      readyQueue.push(p);
      nextArriveIdx++;
    }

    if (currentProcess.remainingTime === 0) {
      currentProcess.finalize(currentTime);
      completed.push(currentProcess);
    } else {
      currentProcess.state = 'READY';
      readyQueue.push(currentProcess);
    }
  }

  recordTick(currentTime, null, false);

  return {
    algorithm: 'RR',
    name: `Round Robin (Quantum = ${quantum})`,
    quantum,
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
  module.exports = runRoundRobin;
}
