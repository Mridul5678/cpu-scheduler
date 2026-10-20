/**
 * kernelSyslog.js
 * Builds the Linux-style kernel syslog (/dev/kmsg) entries for a simulation run.
 * Kept free of DOM code so the event list can be tested in Node; app.js renders it.
 *
 * Timeline segments emitted by every algorithm runner have the shape:
 *   { type: 'PROCESS' | 'CONTEXT_SWITCH' | 'IDLE', start, end, duration,
 *     processId (PROCESS), from / to (CONTEXT_SWITCH) }
 */

// Tie-break order for events logged at the same timestamp, so that, for example,
// a process exits before the next one is dispatched at that instant.
const SYSLOG_EVENT_ORDER = {
  BOOT: 0,
  EXIT: 1,
  ARRIVAL: 2,
  PREEMPT: 3,
  CSWITCH: 4,
  IDLE: 5,
  DISPATCH: 6,
  SUMMARY: 7
};

/**
 * @param {Object} result - Algorithm result ({ timeline, processes, totalTime, idleTime })
 * @param {Array<Process>} processes - The workload as entered by the user
 * @param {Object} config - { algorithm, timeQuantum, contextSwitchOverhead } for the boot line
 * @returns {Array<{time, tag, tagClass, msg}>} entries in chronological order
 */
function buildKernelSyslog(result, processes, config = {}) {
  if (!result) return [];
  const logs = [];
  const add = (kind, time, tag, tagClass, msg) => logs.push({ kind, time, tag, tagClass, msg });

  const algoName = config.algorithm || 'CPU_SCHEDULER';
  const q = config.timeQuantum || 2;
  const cs = config.contextSwitchOverhead || 0;

  add('BOOT', 0, 'BOOT', 'syslog-tag-boot',
    `Linux kernel 6.8.0-schedx: Core #0 initialized. Scheduler active: ${algoName} (q=${q}, cs_cost=${cs}ms)`);

  (processes || []).forEach(p => {
    add('ARRIVAL', p.arrivalTime, 'ARRIVAL', 'syslog-tag-arrival',
      `task_struct: PID ${p.id} arrived in TASK_RUNNING state [burst=${p.burstTime}ms, prio=${p.priority}, qLevel=${p.queueLevel}]`);
  });

  // A process that leaves the CPU before its completion time was preempted (or demoted, in MLFQ).
  // completionTime of -1 means the run stopped before the process finished.
  const completionById = {};
  (result.processes || []).forEach(p => { completionById[p.id] = p.completionTime; });
  const wasPreempted = (pid, atTime) => {
    const completion = completionById[pid];
    return completion === undefined || completion < 0 || completion > atTime;
  };
  const logPreempt = (fromPid, toPid, atTime) => {
    add('PREEMPT', atTime, 'PREEMPT', 'syslog-tag-preempt',
      `sched_switch: PID ${fromPid} preempted/demoted -> PID ${toPid} scheduled on Core #0`);
  };

  let prevProcessSeg = null;   // last PROCESS segment that ran on the CPU
  let switchLogged = false;    // a CONTEXT_SWITCH already explained the change of process

  (result.timeline || []).forEach(seg => {
    if (seg.type === 'CONTEXT_SWITCH') {
      if (prevProcessSeg && wasPreempted(seg.from, seg.start)) {
        logPreempt(seg.from, seg.to, seg.start);
      }
      add('CSWITCH', seg.start, 'CSWITCH', 'syslog-tag-cswitch',
        `Hardware Context Switch: core0 flushing TLB registers -> switching PCB context PID ${seg.from} -> PID ${seg.to} (${seg.duration}ms) [${seg.start}ms -> ${seg.end}ms]`);
      switchLogged = true;
    } else if (seg.type === 'IDLE') {
      add('IDLE', seg.start, 'IDLE', 'syslog-tag-idle',
        `cpu_idle: Ready queue empty -> core0 entering C1E power-saving idle state [${seg.start}ms - ${seg.end}ms]`);
      prevProcessSeg = null;
      switchLogged = false;
    } else if (seg.type === 'PROCESS') {
      if (prevProcessSeg && !switchLogged && prevProcessSeg.processId !== seg.processId &&
          wasPreempted(prevProcessSeg.processId, seg.start)) {
        logPreempt(prevProcessSeg.processId, seg.processId, seg.start);
      }
      add('DISPATCH', seg.start, 'DISPATCH', 'syslog-tag-dispatch',
        `sched_dispatch: PID ${seg.processId} dispatched to CPU Core #0 for slice [${seg.start}ms -> ${seg.end}ms]`);
      prevProcessSeg = seg;
      switchLogged = false;
    }
  });

  (result.processes || []).forEach(p => {
    if (p.completionTime < 0) return; // never finished: do not log an exit that did not happen
    add('EXIT', p.completionTime, 'COMPLETE', 'syslog-tag-complete',
      `task_exit: PID ${p.id} completed execution -> state TASK_DEAD (TAT=${p.turnaroundTime}ms, WT=${p.waitingTime}ms, RT=${p.responseTime}ms)`);
  });

  if (result.totalTime > 0) {
    // Same utilization definition as the metric cards (evaluator.js); the browser loads it first
    const evaluator = typeof SchedulerEvaluator !== 'undefined' ? SchedulerEvaluator : require('./evaluator.js');
    const time = evaluator.timeBreakdown(result);
    add('SUMMARY', result.totalTime, 'COMPLETE', 'syslog-tag-complete',
      `kernel_exec: All workloads processed. Total: ${result.totalTime}ms | CPU Util: ${time.cpuUtilization.toFixed(1)}% | Switch overhead: ${time.switchOverheadPercent.toFixed(1)}%`);
  }

  // Array.prototype.sort is stable, so same-time events of one kind keep timeline order
  logs.sort((a, b) => (a.time - b.time) || (SYSLOG_EVENT_ORDER[a.kind] - SYSLOG_EVENT_ORDER[b.kind]));
  return logs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = buildKernelSyslog;
}
