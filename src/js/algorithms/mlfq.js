/**
 * mlfq.js
 * Multilevel Feedback Queue (MLFQ) Scheduling Algorithm
 * Q0: RR (Quantum = 2)
 * Q1: RR (Quantum = 4)
 * Q2: FCFS
 * Includes dynamic priority demotion and aging mechanism to prevent starvation.
 */
function runMLFQ(processList, options = {}) {
  const q0Quantum = Math.max(1, Number(options.q0Quantum) || 2);
  const q1Quantum = Math.max(2, Number(options.q1Quantum) || 4);
  const agingThreshold = Math.max(5, Number(options.agingThreshold) || 12);
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;
  const completed = [];

  const q0 = [];
  const q1 = [];
  const q2 = [];

  // Track wait time in current queue for aging
  const waitInQueue = new Map();
  processes.forEach(p => waitInQueue.set(p.id, 0));

  let currentRunning = null;
  let currentSlice = 0;

  const recordTick = (t, runningId, isCS, qLevel = 0) => {
    ticks.push({
      time: t,
      runningProcessId: runningId,
      isContextSwitch: isCS,
      readyQueue: [...q0, ...q1, ...q2].map(p => p.id),
      queue0: q0.map(p => p.id),
      queue1: q1.map(p => p.id),
      queue2: q2.map(p => p.id),
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
          !q0.includes(p) && !q1.includes(p) && !q2.includes(p) && currentRunning !== p) {
        p.state = 'READY';
        p.currentQueue = 0;
        q0.push(p);
        waitInQueue.set(p.id, 0);
      }
    });
  };

  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    // Check arrivals up to currentTime
    enqueueArrivals(currentTime);

    // Aging check: increment waiting counters for queued processes
    // If waiting exceeds agingThreshold, promote the process!
    for (let i = q1.length - 1; i >= 0; i--) {
      const p = q1[i];
      const wait = (waitInQueue.get(p.id) || 0) + 1;
      waitInQueue.set(p.id, wait);
      if (wait >= agingThreshold) {
        q1.splice(i, 1);
        p.currentQueue = 0;
        waitInQueue.set(p.id, 0);
        q0.push(p);
      }
    }
    for (let i = q2.length - 1; i >= 0; i--) {
      const p = q2[i];
      const wait = (waitInQueue.get(p.id) || 0) + 1;
      waitInQueue.set(p.id, wait);
      if (wait >= agingThreshold) {
        q2.splice(i, 1);
        p.currentQueue = 1;
        waitInQueue.set(p.id, 0);
        q1.push(p);
      }
    }

    // Check idle
    if (!currentRunning && q0.length === 0 && q1.length === 0 && q2.length === 0) {
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

    // Preemption check: Higher priority queue preempts lower priority running process
    if (currentRunning) {
      if (currentRunning.currentQueue > 0 && q0.length > 0) {
        currentRunning.state = 'READY';
        if (currentRunning.currentQueue === 1) q1.unshift(currentRunning);
        else q2.unshift(currentRunning);
        currentRunning = null;
        currentSlice = 0;
      } else if (currentRunning.currentQueue === 2 && q1.length > 0) {
        currentRunning.state = 'READY';
        q2.unshift(currentRunning);
        currentRunning = null;
        currentSlice = 0;
      }
    }

    // Select next process if none running
    if (!currentRunning) {
      if (q0.length > 0) {
        currentRunning = q0.shift();
        currentSlice = 0;
      } else if (q1.length > 0) {
        currentRunning = q1.shift();
        currentSlice = 0;
      } else if (q2.length > 0) {
        currentRunning = q2.shift();
        currentSlice = 0;
      }
    }

    // Context switch
    if (currentRunning && contextSwitchOverhead > 0 && lastRunningId !== null && lastRunningId !== currentRunning.id) {
      timeline.push({
        type: 'CONTEXT_SWITCH',
        from: lastRunningId,
        to: currentRunning.id,
        start: currentTime,
        end: currentTime + contextSwitchOverhead,
        duration: contextSwitchOverhead
      });
      contextSwitchCount++;
      for (let cs = 0; cs < contextSwitchOverhead; cs++) {
        const tickTime = currentTime + cs;
        enqueueArrivals(tickTime);
        recordTick(tickTime, null, true, currentRunning.currentQueue);
      }
      currentTime += contextSwitchOverhead;
    }

    if (currentRunning.startTime === -1) {
      currentRunning.startTime = currentTime;
      currentRunning.responseTime = currentTime - currentRunning.arrivalTime;
    }

    currentRunning.state = 'RUNNING';
    recordTick(currentTime, currentRunning.id, false, currentRunning.currentQueue);

    // Execute 1 tick
    currentRunning.remainingTime -= 1;
    currentSlice += 1;

    const lastSeg = timeline[timeline.length - 1];
    if (lastSeg && lastSeg.type === 'PROCESS' && lastSeg.processId === currentRunning.id && lastSeg.queueLevel === currentRunning.currentQueue && lastSeg.end === currentTime) {
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
        queueLevel: currentRunning.currentQueue
      });
    }

    currentTime += 1;
    lastRunningId = currentRunning.id;

    // After 1 tick: check completion or demotion
    if (currentRunning.remainingTime === 0) {
      currentRunning.finalize(currentTime);
      completed.push(currentRunning);
      currentRunning = null;
      currentSlice = 0;
    } else {
      // Check if current queue quantum exhausted
      let shouldDemote = false;
      if (currentRunning.currentQueue === 0 && currentSlice >= q0Quantum) {
        shouldDemote = true;
        currentRunning.currentQueue = 1;
      } else if (currentRunning.currentQueue === 1 && currentSlice >= q1Quantum) {
        shouldDemote = true;
        currentRunning.currentQueue = 2;
      }

      if (shouldDemote) {
        // Collect arrivals at new currentTime before re-queuing
        enqueueArrivals(currentTime);
        currentRunning.state = 'READY';
        waitInQueue.set(currentRunning.id, 0);
        if (currentRunning.currentQueue === 1) q1.push(currentRunning);
        else q2.push(currentRunning);
        currentRunning = null;
        currentSlice = 0;
      }
    }
  }

  processes.forEach(p => {
    p.executedSegments = timeline
      .filter(seg => seg.type === 'PROCESS' && seg.processId === p.id)
      .map(seg => ({ start: seg.start, end: seg.end, queueLevel: seg.queueLevel }));
  });

  recordTick(currentTime, null, false, 0);

  return {
    algorithm: 'MLFQ',
    name: `Multilevel Feedback Queue (Q0: q=${q0Quantum}, Q1: q=${q1Quantum}, Q2: FCFS)`,
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
  module.exports = runMLFQ;
}
