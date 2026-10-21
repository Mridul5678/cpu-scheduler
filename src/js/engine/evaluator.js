/**
 * evaluator.js
 * Comprehensive performance metrics calculator and OS criteria evaluation.
 */

class SchedulerEvaluator {
  /**
   * Splits a run's elapsed time into process execution, context-switch overhead and idle time,
   * measured from the result's own timeline so the numbers always match the Gantt chart.
   * For a completed run: executionTime + switchOverheadTime + idleTime = totalTime.
   *   CPU utilization  = executionTime / totalTime * 100   (useful work only)
   *   Switch overhead  = switchOverheadTime / totalTime * 100
   *   Idle             = idleTime / totalTime * 100
   * Percentages are 0 when totalTime is 0.
   * @param {Object} result - Output from an algorithm runner (or the Play view)
   */
  static timeBreakdown(result) {
    const timeline = result.timeline || [];
    const timeIn = type => timeline.filter(s => s.type === type).reduce((acc, s) => acc + (s.end - s.start), 0);
    const totalTime = result.totalTime || 0;
    const executionTime = timeIn('PROCESS');
    const switchOverheadTime = timeIn('CONTEXT_SWITCH');
    const idleTime = result.idleTime || 0;
    const percentOfTotal = t => (totalTime > 0 ? (t / totalTime) * 100 : 0);
    return {
      totalTime,
      executionTime,
      switchOverheadTime,
      idleTime,
      cpuUtilization: percentOfTotal(executionTime),
      switchOverheadPercent: percentOfTotal(switchOverheadTime),
      idlePercent: percentOfTotal(idleTime)
    };
  }

  /**
   * Evaluates a simulation result run
   * @param {Object} result - Output from an algorithm runner (timeline, processes, totalTime, etc.)
   * @returns {Object} Detailed evaluation metrics
   */
  static evaluate(result) {
    const processes = result.processes;
    const n = processes.length;
    if (n === 0) return null;

    // A run stopped by the safety limit is reported as incomplete: its averages, fairness and
    // risk conclusions would treat unfinished processes as if they had finished.
    const unfinishedIds = SchedulerEvaluator.unfinishedProcessIds(result);
    if (unfinishedIds.length > 0) return SchedulerEvaluator.evaluateIncomplete(result, unfinishedIds);

    const totalBurst = processes.reduce((acc, p) => acc + p.burstTime, 0);
    const totalWT = processes.reduce((acc, p) => acc + p.waitingTime, 0);
    const totalTAT = processes.reduce((acc, p) => acc + p.turnaroundTime, 0);
    const totalRT = processes.reduce((acc, p) => acc + (p.responseTime >= 0 ? p.responseTime : 0), 0);

    const avgWaitingTime = totalWT / n;
    const avgTurnaroundTime = totalTAT / n;
    const avgResponseTime = totalRT / n;

    const totalTime = Math.max(1, result.totalTime);
    // Useful utilization: time spent running processes (switch overhead and idle time excluded)
    const breakdown = SchedulerEvaluator.timeBreakdown(result);
    const cpuUtilization = breakdown.cpuUtilization;
    const throughput = n / totalTime;

    // Jain's Fairness Index for Waiting Time
    // J = (sum(x_i))^2 / (n * sum(x_i^2))
    // We evaluate on normalized penalty ratio: (Turnaround Time / Burst Time)
    const penaltyRatios = processes.map(p => p.burstTime > 0 ? (p.turnaroundTime / p.burstTime) : 1);
    const sumRatios = penaltyRatios.reduce((acc, r) => acc + r, 0);
    const sumSquaredRatios = penaltyRatios.reduce((acc, r) => acc + (r * r), 0);
    let jainsFairnessIndex = 1.0;
    if (sumSquaredRatios > 0) {
      jainsFairnessIndex = (sumRatios * sumRatios) / (n * sumSquaredRatios);
      // Bound between 0 and 1
      jainsFairnessIndex = Math.min(1.0, Math.max(0.0, jainsFairnessIndex));
    }

    // Starvation Analysis
    // A process suffers starvation risk ONLY in greedy/priority-based algorithms
    // (SJF, SRTF, Priority-NP, Priority-P, MLQ) where newly arriving tasks can repeatedly
    // bypass existing waiting tasks.
    // FIFO (FCFS), Round Robin (RR), and HRRN are mathematically starvation-free.
    const isStarvationProneAlgo = ['SJF', 'SRTF', 'Priority-NP', 'Priority-P', 'MLQ'].includes(result.algorithm);
    const starvedProcesses = [];
    if (isStarvationProneAlgo) {
      // Use proportional thresholds based on total workload to avoid false positives
      const maxBurst = Math.max(...processes.map(p => p.burstTime));
      const starvationWaitFloor = Math.max(30, totalBurst * 0.5);

      processes.forEach(p => {
        const waitToBurstRatio = p.burstTime > 0 ? (p.waitingTime / p.burstTime) : 0;
        // Only flag truly extreme starvation: wait must exceed a proportional floor
        // AND be significantly higher than average
        const isExtremeWait = p.waitingTime >= starvationWaitFloor && p.waitingTime >= avgWaitingTime * 3.0;
        const isExtremePenalty = waitToBurstRatio >= 5.0 && p.waitingTime >= starvationWaitFloor;

        if (isExtremeWait || isExtremePenalty) {
          starvedProcesses.push({
            id: p.id,
            waitingTime: p.waitingTime,
            burstTime: p.burstTime,
            ratio: waitToBurstRatio.toFixed(2),
            explanation: `Process ${p.id} waited ${p.waitingTime} ms (${waitToBurstRatio.toFixed(1)}x its burst time of ${p.burstTime} ms, vs average wait ${avgWaitingTime.toFixed(1)} ms).`
          });
        }
      });
    }

    // Convoy Effect Severity
    // Occurs when short burst processes wait behind a long CPU-bound burst process
    let convoyEffectDetected = false;
    let convoyDetails = null;
    let convoyBlockedProcesses = [];
    if (result.algorithm === 'FCFS' || result.algorithm === 'Priority-NP') {
      const sortedByArrival = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
      const avgBurst = totalBurst / n;
      // Convoy: first process must be at least 5x longer than the average burst
      // of subsequent processes, and subsequent short processes must wait at least
      // 2x the average burst time
      if (sortedByArrival.length >= 3 && sortedByArrival[0].burstTime >= 20) {
        const subsequent = sortedByArrival.slice(1);
        const avgSubBurst = subsequent.reduce((s, p) => s + p.burstTime, 0) / subsequent.length;
        const burstRatio = avgSubBurst > 0 ? (sortedByArrival[0].burstTime / avgSubBurst) : 0;
        const subsequentShort = subsequent.filter(p => p.burstTime <= avgBurst * 0.5 && p.waitingTime >= sortedByArrival[0].burstTime * 0.6);
        if (burstRatio >= 4 && subsequentShort.length >= 2) {
          convoyEffectDetected = true;
          convoyBlockedProcesses = subsequentShort.map(p => p.id);
          convoyDetails = `Process ${sortedByArrival[0].id} (Burst: ${sortedByArrival[0].burstTime} ms) arrived first and monopolized the CPU, causing severe convoy blocking on short processes (${convoyBlockedProcesses.join(', ')}).`;
        }
      }
    }

    // Context Switch Thrashing Risk
    // Only a genuine risk when switches have a cost and that overhead takes >= 20% of total time
    const contextSwitchCount = result.contextSwitchCount || 0;
    const csCost = result.contextSwitchOverhead || 0;
    const csOverheadPercent = breakdown.switchOverheadPercent;
    const isThrashingRisk = csCost > 0 && csOverheadPercent >= 20;

    // CPU Idle Risk
    // Low utilization is only a concern if CPU is idle for a substantial portion of the schedule
    const isLowUtilRisk = cpuUtilization < 40 && (result.idleTime || 0) >= totalTime * 0.3;

    // Compile Structured Multi-Risk Diagnostics with Deep OS Explanations
    const risks = [];

    if (starvedProcesses.length > 0) {
      risks.push({
        id: 'starvation',
        name: 'Process Starvation / Indefinite Postponement',
        severity: 'High Risk',
        icon: '⚠️',
        badgeClass: 'badge-danger',
        affectedProcesses: starvedProcesses.map(p => p.id),
        summary: `${starvedProcesses.length} process(es) [${starvedProcesses.map(p => p.id).join(', ')}] experienced severe starvation.`,
        explanation: `Under ${result.name || result.algorithm}, processes with longer burst times or lower priorities are continually superseded by newly arriving shorter or higher-priority tasks in the ready queue. Processes [${starvedProcesses.map(p => `${p.id} (Wait: ${p.waitingTime}ms / Burst: ${p.burstTime}ms)`).join(', ')}] were indefinitely postponed.`,
        rootCause: `Greedy priority or burst optimization in ${result.algorithm} prioritizes immediate local turnaround time over global process fairness.`,
        mitigation: `Introduce Aging mechanisms (gradually boosting priority/response ratio as waiting time accumulates) or switch to starvation-free schedulers like HRRN (Highest Response Ratio Next) or MLFQ (Multilevel Feedback Queue with aging).`
      });
    }

    if (convoyEffectDetected) {
      risks.push({
        id: 'convoy',
        name: 'Convoy Effect / Head-of-Line CPU Monopolization',
        severity: 'High Risk',
        icon: '🚛',
        badgeClass: 'badge-danger',
        affectedProcesses: convoyBlockedProcesses,
        summary: `Convoy Effect observed: CPU-bound process blocked multiple short interactive tasks.`,
        explanation: convoyDetails,
        rootCause: `Non-preemptive scheduling (${result.algorithm}) cannot interrupt a long CPU-bound process once dispatched, forcing all subsequent short-burst tasks to queue up behind it regardless of urgency.`,
        mitigation: `Adopt preemptive scheduling like Round Robin (RR) or Shortest Remaining Time First (SRTF) so short tasks can interleave and complete rapidly.`
      });
    }

    if (isThrashingRisk) {
      risks.push({
        id: 'thrashing',
        name: 'Context Switch Overhead & Thrashing',
        severity: 'High Risk',
        icon: '⚡',
        badgeClass: 'badge-warning',
        affectedProcesses: processes.map(p => p.id),
        summary: `Excessive context switching (${contextSwitchCount} switches, ${csOverheadPercent.toFixed(1)}% overhead time).`,
        explanation: `The scheduler performed ${contextSwitchCount} context switches across ${n} processes. Frequent preemptions cause CPU cycles to be spent saving and restoring Process Control Blocks (PCBs) and cache invalidation rather than executing program instructions.`,
        rootCause: `Time quantum (q) is set too small relative to average burst times, or frequent priority preemptions are fragmenting execution.`,
        mitigation: `Increase the Round Robin time slice (q) towards the recommended 80th-percentile burst duration (rule of thumb: ~80% of bursts should finish in one quantum).`
      });
    }

    if (isLowUtilRisk) {
      risks.push({
        id: 'underutilization',
        name: 'Low CPU Utilization / Workload Fragmentation',
        severity: 'Moderate Risk',
        icon: '💤',
        badgeClass: 'badge-info',
        affectedProcesses: [],
        summary: `CPU utilization dropped to ${cpuUtilization.toFixed(1)}% (${result.idleTime || 0} ms idle time).`,
        explanation: `Large gaps between process arrival times left the ready queue empty for extended intervals, resulting in significant CPU idle periods.`,
        rootCause: `Sparse or delayed process arrival stream rather than algorithmic inefficiency.`,
        mitigation: `Schedule background batch or maintenance tasks to execute during detected idle gaps.`
      });
    }

    const hasHighRisk = risks.some(r => r.severity === 'High Risk');
    const overallRiskLevel = hasHighRisk ? 'High' : (risks.length > 0 ? 'Moderate' : 'Low');
    const riskSummary = risks.length > 0 ? risks.map(r => r.name).join('; ') : 'No scheduling risks detected (Safe execution profile)';

    // Standard deviation of waiting time
    const varianceWT = processes.reduce((acc, p) => acc + Math.pow(p.waitingTime - avgWaitingTime, 2), 0) / n;
    const stdDevWT = Math.sqrt(varianceWT);

    return {
      algorithm: result.algorithm,
      name: result.name,
      isComplete: true,
      unfinishedProcesses: [],
      processCount: n,
      totalTime,
      idleTime: result.idleTime || 0,
      executionTime: breakdown.executionTime,
      switchOverheadTime: breakdown.switchOverheadTime,
      switchOverheadPercent: Number(breakdown.switchOverheadPercent.toFixed(1)),
      idlePercent: Number(breakdown.idlePercent.toFixed(1)),
      contextSwitchCount,
      avgWaitingTime: Number(avgWaitingTime.toFixed(2)),
      avgTurnaroundTime: Number(avgTurnaroundTime.toFixed(2)),
      avgResponseTime: Number(avgResponseTime.toFixed(2)),
      cpuUtilization: Number(cpuUtilization.toFixed(1)),
      throughput: Number(throughput.toFixed(4)),
      jainsFairnessIndex: Number(jainsFairnessIndex.toFixed(3)),
      fairnessPercent: Number((jainsFairnessIndex * 100).toFixed(1)),
      stdDevWT: Number(stdDevWT.toFixed(2)),
      starvedProcesses,
      starvationRisk: starvedProcesses.length > 0,
      convoyEffectDetected,
      convoyDetails,
      risks,
      hasHighRisk,
      overallRiskLevel,
      riskSummary,
      processes: processes.map(p => ({
        id: p.id,
        arrivalTime: p.arrivalTime,
        burstTime: p.burstTime,
        priority: p.priority,
        startTime: p.startTime,
        completionTime: p.completionTime,
        turnaroundTime: p.turnaroundTime,
        waitingTime: p.waitingTime,
        responseTime: p.responseTime,
        color: p.color,
        finished: true
      }))
    };
  }

  /**
   * IDs of processes that did not finish: those listed by the runner when it hit the safety
   * limit, plus any process without a completion time (completionTime < 0).
   */
  static unfinishedProcessIds(result) {
    const ids = new Set(Array.isArray(result.unfinishedProcessIds) ? result.unfinishedProcessIds : []);
    (result.processes || []).forEach(p => { if (p.completionTime < 0) ids.add(p.id); });
    return [...ids];
  }

  /**
   * Evaluation of a run that stopped before every process finished. Measurements of the
   * elapsed time (utilization, overhead, idle, switches so far) are kept; metrics that need
   * every process to finish are null rather than misleading zeros, and the only reported
   * risk is the incomplete schedule itself.
   */
  static evaluateIncomplete(result, unfinishedIds) {
    const processes = result.processes;
    const n = processes.length;
    const breakdown = SchedulerEvaluator.timeBreakdown(result);
    const limitText = result.stepLimit ? `${result.stepLimit.toLocaleString('en-US')}-step safety limit` : 'safety limit';
    const remaining = processes.filter(p => unfinishedIds.includes(p.id))
      .map(p => `${p.id} (${p.remainingTime} of ${p.burstTime} units left)`);
    const risk = {
      id: 'incomplete',
      name: 'Schedule incomplete: safety limit reached',
      severity: 'High Risk',
      icon: '',
      badgeClass: 'badge-danger',
      affectedProcesses: unfinishedIds,
      summary: `${unfinishedIds.length} of ${n} processes did not finish before the ${limitText}.`,
      explanation: `The simulation stopped at time ${result.totalTime} after reaching the ${limitText}, so ${remaining.join(', ')} never finished. ` +
        'Waiting time, turnaround time, response time, throughput and fairness need every process to finish, so they are not reported for this run.',
      rootCause: 'The workload needs more scheduling steps than the simulator allows for a single run.',
      mitigation: 'Use a smaller workload: at most 50 processes, with burst times from 1 to 100 and arrival times from 0 to 100.'
    };

    return {
      algorithm: result.algorithm,
      name: result.name,
      isComplete: false,
      unfinishedProcesses: unfinishedIds,
      stepLimit: result.stepLimit || null,
      processCount: n,
      totalTime: Math.max(1, result.totalTime),
      idleTime: result.idleTime || 0,
      executionTime: breakdown.executionTime,
      switchOverheadTime: breakdown.switchOverheadTime,
      switchOverheadPercent: Number(breakdown.switchOverheadPercent.toFixed(1)),
      idlePercent: Number(breakdown.idlePercent.toFixed(1)),
      contextSwitchCount: result.contextSwitchCount || 0,
      cpuUtilization: Number(breakdown.cpuUtilization.toFixed(1)),
      // Not available until every process finishes
      avgWaitingTime: null,
      avgTurnaroundTime: null,
      avgResponseTime: null,
      throughput: null,
      jainsFairnessIndex: null,
      fairnessPercent: null,
      stdDevWT: null,
      starvedProcesses: [],
      starvationRisk: false,
      convoyEffectDetected: false,
      convoyDetails: null,
      risks: [risk],
      hasHighRisk: true,
      overallRiskLevel: 'High',
      riskSummary: risk.name,
      processes: processes.map(p => {
        const finished = !unfinishedIds.includes(p.id);
        return {
          id: p.id,
          arrivalTime: p.arrivalTime,
          burstTime: p.burstTime,
          priority: p.priority,
          startTime: p.startTime,
          completionTime: finished ? p.completionTime : -1,
          turnaroundTime: finished ? p.turnaroundTime : null,
          waitingTime: finished ? p.waitingTime : null,
          responseTime: p.responseTime >= 0 ? p.responseTime : null,
          remainingTime: p.remainingTime,
          color: p.color,
          finished
        };
      })
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SchedulerEvaluator;
}
