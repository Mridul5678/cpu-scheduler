/**
 * mlq.js
 * Multilevel Queue (MLQ) Scheduling Algorithm
 * Queue 0 (Foreground): Round Robin (q = 2 or configured)
 * Queue 1 (Background): FCFS
 * Queue 0 has absolute priority over Queue 1 with preemption.
 */
function runMLQ(processList, options = {}) {
  const q0Quantum = Math.max(1, Number(options.timeQuantum) || 2);
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;
  const completed = [];

  // Two Queues: Q0 (Foreground: RR), Q1 (Background: FCFS)
  const q0 = [];
  const q1 = [];

  let q0CurrentSlice = 0;
  let currentRunning = null;

  const recordTick = (t, runningId, isCS, qLevel = 0) => {
    ticks.push({
      time: t,
      runningProcessId: runningId,
      isContextSwitch: isCS,
      readyQueue: [...q0, ...q1].map(p => p.id),
      queue0: q0.map(p => p.id),
      queue1: q1.map(p => p.id),
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

  const enqueueArrivals = (t) => {
    processes.forEach(p => {
      if (p.arrivalTime <= t && p.remainingTime > 0 && p.completionTime === -1 &&
          !q0.includes(p) && !q1.includes(p) && currentRunning !== p) {
        p.state = 'READY';
        if (p.queueLevel === 0) {
          q0.push(p);
        } else {
          q1.push(p);
        }
      }
    });
  };

  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    // Check arrivals up to currentTime
    enqueueArrivals(currentTime);

    // Check if CPU is idle
    if (!currentRunning && q0.length === 0 && q1.length === 0) {
      const unarrived = processes.filter(p => p.remainingTime > 0 && p.completionTime === -1);
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
        recordTick(t, null, false, 0);
      }
      idleTime += idleDuration;
      currentTime = nextArrival;
      continue;
    }

    // Scheduling decision:
    // If Q0 has ready jobs and currentRunning is from Q1, preempt Q1!
    if (currentRunning && currentRunning.queueLevel === 1 && q0.length > 0) {
      // Preempt Q1
      currentRunning.state = 'READY';
      q1.unshift(currentRunning); // Return to front of Q1
      currentRunning = null;
    }

    // Select process if none running
    if (!currentRunning) {
      if (q0.length > 0) {
        currentRunning = q0.shift();
        q0CurrentSlice = 0;
      } else if (q1.length > 0) {
        currentRunning = q1.shift();
      }
    }

    // A context switch is any change to a different process (the first dispatch is not one).
    // Overhead time is only added to the schedule when a switch has a cost.
    const isSwitch = currentRunning && lastRunningId !== null && lastRunningId !== currentRunning.id;
    if (isSwitch) contextSwitchCount++;
    if (isSwitch && contextSwitchOverhead > 0) {
      timeline.push({
        type: 'CONTEXT_SWITCH',
        from: lastRunningId,
        to: currentRunning.id,
        start: currentTime,
        end: currentTime + contextSwitchOverhead,
        duration: contextSwitchOverhead
      });
      for (let cs = 0; cs < contextSwitchOverhead; cs++) {
        const tickTime = currentTime + cs;
        enqueueArrivals(tickTime);
        recordTick(tickTime, null, true, currentRunning.queueLevel);
      }
      currentTime += contextSwitchOverhead;
    }

    if (currentRunning.startTime === -1) {
      currentRunning.startTime = currentTime;
      currentRunning.responseTime = currentTime - currentRunning.arrivalTime;
    }

    currentRunning.state = 'RUNNING';
    recordTick(currentTime, currentRunning.id, false, currentRunning.queueLevel);

    // Execute 1 tick
    currentRunning.remainingTime -= 1;
    if (currentRunning.queueLevel === 0) {
      q0CurrentSlice += 1;
    }

    const lastSeg = timeline[timeline.length - 1];
    if (lastSeg && lastSeg.type === 'PROCESS' && lastSeg.processId === currentRunning.id && lastSeg.end === currentTime) {
      lastSeg.end += 1;
      lastSeg.duration += 1;
    } else {
      timeline.push({
        type: 'PROCESS',
        processId: currentRunning.id,
        color: currentRunning.color,
        start: currentTime,
        end: currentTime + 1,
        duration: 1,
        queueLevel: currentRunning.queueLevel
      });
    }

    currentTime += 1;
    lastRunningId = currentRunning.id;

    // After 1 tick check completions or slice expiration
    if (currentRunning.remainingTime === 0) {
      currentRunning.finalize(currentTime);
      completed.push(currentRunning);
      currentRunning = null;
      q0CurrentSlice = 0;
    } else if (currentRunning.queueLevel === 0 && q0CurrentSlice >= q0Quantum) {
      // Slice expired for Q0 process
      // Check arrivals at new currentTime before re-queuing
      enqueueArrivals(currentTime);
      currentRunning.state = 'READY';
      q0.push(currentRunning);
      currentRunning = null;
      q0CurrentSlice = 0;
    }
  }

  processes.forEach(p => {
    p.executedSegments = timeline
      .filter(seg => seg.type === 'PROCESS' && seg.processId === p.id)
      .map(seg => ({ start: seg.start, end: seg.end, queueLevel: seg.queueLevel }));
  });

  recordTick(currentTime, null, false, 0);

  return {
    algorithm: 'MLQ',
    name: 'Multilevel Queue (Q0: RR, Q1: FCFS)',
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
  module.exports = runMLQ;
}
