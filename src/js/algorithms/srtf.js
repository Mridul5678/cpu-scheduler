/**
 * srtf.js
 * Shortest Remaining Time First (SRTF) - Preemptive SJF Scheduling Algorithm
 */
function runSRTF(processList, options = {}) {
  const contextSwitchOverhead = options.contextSwitchOverhead || 0;
  const processes = processList.map(p => p.clone());

  let currentTime = 0;
  const timeline = [];
  const ticks = [];
  let contextSwitchCount = 0;
  let idleTime = 0;
  let lastRunningId = null;
  const completed = [];

  const recordTick = (t, runningId, isCS, readyQueue, qLevel = 0) => {
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

  // We simulate tick-by-tick discrete time
  while (completed.length < processes.length && safetyCounter++ < maxSafety) {
    const available = processes.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);

    if (available.length === 0) {
      // Find next arrival
      const unarrived = processes.filter(p => p.remainingTime > 0);
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

    // Sort by remainingTime ASC, arrivalTime ASC, ID ASC
    available.sort((a, b) => {
      if (a.remainingTime !== b.remainingTime) return a.remainingTime - b.remainingTime;
      if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
      return a.id.localeCompare(b.id);
    });

    const chosen = available[0];
    const readyQueue = available.slice(1);

    // A context switch is any change to a different process (the first dispatch is not one).
    // Overhead time is only added to the schedule when a switch has a cost.
    const isSwitch = lastRunningId !== null && lastRunningId !== chosen.id;
    if (isSwitch) contextSwitchCount++;
    if (isSwitch && contextSwitchOverhead > 0) {
      timeline.push({
        type: 'CONTEXT_SWITCH',
        from: lastRunningId,
        to: chosen.id,
        start: currentTime,
        end: currentTime + contextSwitchOverhead,
        duration: contextSwitchOverhead
      });
      for (let cs = 0; cs < contextSwitchOverhead; cs++) {
        const tickTime = currentTime + cs;
        const currentReady = processes.filter(p => p.arrivalTime <= tickTime && p.remainingTime > 0);
        currentReady.sort((a, b) => a.remainingTime - b.remainingTime);
        recordTick(tickTime, null, true, currentReady);
      }
      currentTime += contextSwitchOverhead;
    }

    if (chosen.startTime === -1) {
      chosen.startTime = currentTime;
      chosen.responseTime = currentTime - chosen.arrivalTime;
    }

    chosen.state = 'RUNNING';

    // Execute 1 tick
    recordTick(currentTime, chosen.id, false, readyQueue);
    chosen.remainingTime -= 1;

    // Extend or create timeline segment
    const lastSeg = timeline[timeline.length - 1];
    if (lastSeg && lastSeg.type === 'PROCESS' && lastSeg.processId === chosen.id && lastSeg.end === currentTime) {
      lastSeg.end += 1;
      lastSeg.duration += 1;
    } else {
      timeline.push({
        type: 'PROCESS',
        processId: chosen.id,
        color: chosen.color,
        start: currentTime,
        end: currentTime + 1,
        duration: 1,
        queueLevel: 0
      });
    }

    currentTime += 1;
    lastRunningId = chosen.id;

    if (chosen.remainingTime === 0) {
      chosen.finalize(currentTime);
      completed.push(chosen);
    } else {
      chosen.state = 'READY';
    }
  }

  // Merge contiguous process segments in process.executedSegments
  processes.forEach(p => {
    p.executedSegments = timeline
      .filter(seg => seg.type === 'PROCESS' && seg.processId === p.id)
      .map(seg => ({ start: seg.start, end: seg.end, queueLevel: seg.queueLevel }));
  });

  recordTick(currentTime, null, false, []);

  return {
    algorithm: 'SRTF',
    name: 'Shortest Remaining Time First (Preemptive)',
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
  module.exports = runSRTF;
}
