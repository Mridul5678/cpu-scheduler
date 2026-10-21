/**
 * recommendationEngine.js
 * Automated Multi-Criteria Algorithm Evaluator & Best Scheduler Recommendation Engine
 * (Novelty Factor > 15% - Academic & Competitive OS Project Edge)
 */

if (typeof require !== 'undefined') {
  try {
    if (typeof runFCFS === 'undefined') global.runFCFS = require('../algorithms/fcfs.js');
    if (typeof runSJF === 'undefined') global.runSJF = require('../algorithms/sjf.js');
    if (typeof runSRTF === 'undefined') global.runSRTF = require('../algorithms/srtf.js');
    if (typeof runRoundRobin === 'undefined') global.runRoundRobin = require('../algorithms/roundRobin.js');
    if (typeof runPriorityNonPreemptive === 'undefined') {
      const pri = require('../algorithms/priority.js');
      global.runPriorityNonPreemptive = pri.runPriorityNonPreemptive;
      global.runPriorityPreemptive = pri.runPriorityPreemptive;
    }
    if (typeof runHRRN === 'undefined') global.runHRRN = require('../algorithms/hrrn.js');
    if (typeof runMLQ === 'undefined') global.runMLQ = require('../algorithms/mlq.js');
    if (typeof runMLFQ === 'undefined') global.runMLFQ = require('../algorithms/mlfq.js');
    if (typeof SchedulerEvaluator === 'undefined') global.SchedulerEvaluator = require('./evaluator.js');
  } catch (e) {
    // Browser environment
  }
}

class RecommendationEngine {
  /**
   * Suggested Round Robin time quantum: the 80th percentile of the burst times,
   * using the nearest-rank method. Sort the bursts, take rank = ceil(0.8 * n) and
   * return the burst at that 1-based position. At least 80% of the bursts are then
   * <= q, so they finish within a single quantum (rule of thumb from Silberschatz).
   * Example: [1, 2, 3, 4, 100] -> rank ceil(4) = 4 -> q = 4.
   * Burst times are already validated by the Process model (whole numbers >= 1).
   * @param {Array<Process>} processes
   * @returns {number} recommended quantum (2 when there are no processes)
   */
  static computeOptimalQuantum(processes) {
    if (!processes || processes.length === 0) return 2;
    const bursts = processes.map(p => p.burstTime).sort((a, b) => a - b);
    // Integer arithmetic for ceil(0.8 * n), avoiding floating-point error in 0.8 * n
    const rank = Math.ceil((4 * bursts.length) / 5);
    return Math.max(1, bursts[rank - 1]);
  }

  /**
   * Runs all algorithms and computes benchmark rankings
   * @param {Array<Process>} processes
   * @param {Object} options
   * @returns {Object} Full benchmark report with best algorithm and diagnostic verdict
   */
  static benchmarkAll(processes, options = {}) {
    if (!processes || processes.length === 0) return null;

    const optQuantum = this.computeOptimalQuantum(processes);
    const userQuantum = Math.max(1, Number(options.timeQuantum) || optQuantum);
    const contextSwitchOverhead = options.contextSwitchOverhead || 0;
    const priorityMode = options.priorityMode || 'lower-is-higher';
    const profile = options.profile || 'balanced'; // 'balanced' | 'latency' | 'fairness' | 'throughput'

    // Algorithm runner definitions
    const runs = [
      { key: 'FCFS', name: 'First-Come, First-Served', fn: () => runFCFS(processes, { contextSwitchOverhead }) },
      { key: 'SJF', name: 'Shortest Job First (Non-Preemptive)', fn: () => runSJF(processes, { contextSwitchOverhead }) },
      { key: 'SRTF', name: 'Shortest Remaining Time First (Preemptive)', fn: () => runSRTF(processes, { contextSwitchOverhead }) },
      { key: 'RR', name: `Round Robin (q = ${userQuantum})`, fn: () => runRoundRobin(processes, { timeQuantum: userQuantum, contextSwitchOverhead }) },
      { key: 'Priority-NP', name: 'Priority (Non-Preemptive)', fn: () => runPriorityNonPreemptive(processes, { contextSwitchOverhead, priorityMode }) },
      { key: 'Priority-P', name: 'Priority (Preemptive)', fn: () => runPriorityPreemptive(processes, { contextSwitchOverhead, priorityMode }) },
      { key: 'HRRN', name: 'Highest Response Ratio Next', fn: () => runHRRN(processes, { contextSwitchOverhead }) },
      { key: 'MLQ', name: 'Multilevel Queue (Q0: RR, Q1: FCFS)', fn: () => runMLQ(processes, { timeQuantum: userQuantum, contextSwitchOverhead }) },
      { key: 'MLFQ', name: 'Multilevel Feedback Queue', fn: () => runMLFQ(processes, { q0Quantum: 2, q1Quantum: 4, contextSwitchOverhead }) }
    ];

    const results = [];
    for (const item of runs) {
      try {
        const rawRes = item.fn();
        const evalMetrics = SchedulerEvaluator.evaluate(rawRes);
        results.push({
          key: item.key,
          name: item.name,
          rawResult: rawRes,
          metrics: evalMetrics
        });
      } catch (err) {
        console.error(`Error running ${item.key}:`, err);
      }
    }

    if (results.length === 0) return null;

    // Multi-Criteria Scoring (MADM normalization), over completed runs only. A run stopped by
    // the safety limit has no final metrics, so it is listed after every completed run, has
    // no score and can never be recommended.
    const completedResults = results.filter(r => r.metrics.isComplete).map(r => ({ ...r, incomplete: false }));
    const incompleteResults = results.filter(r => !r.metrics.isComplete)
      .map(r => ({ ...r, incomplete: true, compositeScore: null, breakdown: null }));
    const scoredList = completedResults.length > 0 ? this.scoreAndRank(completedResults, profile) : [];
    const leaderboard = [...scoredList, ...incompleteResults];
    leaderboard.forEach((item, index) => { item.rank = index + 1; });
    const best = scoredList[0] || null;
    // The exact settings every algorithm above was run with. Apply and Race Top 3 reuse
    // these so the simulator reproduces the ranked results; recommendedQuantum is only a
    // separate suggestion and was not used for the ranking (unless no quantum was given).
    const config = { timeQuantum: userQuantum, contextSwitchOverhead, priorityMode };
    const diagnostic = best ? this.generateDiagnosticVerdict(best, scoredList, profile, optQuantum, config) : null;

    return {
      profile,
      config,
      recommendedQuantum: optQuantum,
      userQuantum,
      leaderboard,
      bestAlgorithm: best,            // null when no algorithm finished the workload
      incompleteKeys: incompleteResults.map(r => r.key),
      diagnostic
    };
  }

  /**
   * Scores and ranks algorithms based on chosen criteria profile
   */
  static scoreAndRank(results, profile = 'balanced') {
    // Determine weights based on optimization profile
    let weights = {
      awt: 0.30,   // Lower is better
      atat: 0.20,  // Lower is better
      art: 0.20,   // Lower is better
      fairness: 0.15, // Higher is better
      util: 0.05,  // Higher is better
      csPenalty: 0.10 // Lower context switch count is better
    };

    if (profile === 'latency') {
      weights = { awt: 0.35, atat: 0.15, art: 0.35, fairness: 0.05, util: 0.05, csPenalty: 0.05 };
    } else if (profile === 'fairness') {
      weights = { awt: 0.15, atat: 0.15, art: 0.10, fairness: 0.45, util: 0.05, csPenalty: 0.10 };
    } else if (profile === 'throughput') {
      weights = { awt: 0.20, atat: 0.25, art: 0.10, fairness: 0.05, util: 0.25, csPenalty: 0.15 };
    }

    // Find min and max for normalization
    const minAWT = Math.min(...results.map(r => r.metrics.avgWaitingTime));
    const maxAWT = Math.max(...results.map(r => r.metrics.avgWaitingTime)) || (minAWT + 1);

    const minATAT = Math.min(...results.map(r => r.metrics.avgTurnaroundTime));
    const maxATAT = Math.max(...results.map(r => r.metrics.avgTurnaroundTime)) || (minATAT + 1);

    const minART = Math.min(...results.map(r => r.metrics.avgResponseTime));
    const maxART = Math.max(...results.map(r => r.metrics.avgResponseTime)) || (minART + 1);

    const minFair = Math.min(...results.map(r => r.metrics.jainsFairnessIndex));
    const maxFair = Math.max(...results.map(r => r.metrics.jainsFairnessIndex)) || (minFair + 0.01);

    const minCS = Math.min(...results.map(r => r.metrics.contextSwitchCount));
    const maxCS = Math.max(...results.map(r => r.metrics.contextSwitchCount)) || (minCS + 1);

    const scored = results.map(item => {
      const m = item.metrics;

      // Invert metrics where lower is better -> scale 0 to 1
      const normAWT = maxAWT === minAWT ? 1.0 : (maxAWT - m.avgWaitingTime) / (maxAWT - minAWT);
      const normATAT = maxATAT === minATAT ? 1.0 : (maxATAT - m.avgTurnaroundTime) / (maxATAT - minATAT);
      const normART = maxART === minART ? 1.0 : (maxART - m.avgResponseTime) / (maxART - minART);
      const normFair = maxFair === minFair ? 1.0 : (m.jainsFairnessIndex - minFair) / (maxFair - minFair);
      const normCS = maxCS === minCS ? 1.0 : (maxCS - m.contextSwitchCount) / (maxCS - minCS);
      const normUtil = m.cpuUtilization / 100;

      // Penalty for starvation
      let starvationPenalty = 0;
      if (m.starvationRisk) {
        starvationPenalty = m.starvedProcesses.length * 0.08;
      }

      let compositeScore = (
        normAWT * weights.awt +
        normATAT * weights.atat +
        normART * weights.art +
        normFair * weights.fairness +
        normUtil * weights.util +
        normCS * weights.csPenalty
      ) - starvationPenalty;

      compositeScore = Math.max(0, Math.min(1, compositeScore));
      const scoreOutOf100 = Number((compositeScore * 100).toFixed(1));

      return {
        ...item,
        compositeScore: scoreOutOf100,
        breakdown: {
          normAWT: Number(normAWT.toFixed(2)),
          normATAT: Number(normATAT.toFixed(2)),
          normART: Number(normART.toFixed(2)),
          normFair: Number(normFair.toFixed(2)),
          normCS: Number(normCS.toFixed(2))
        }
      };
    });

    // Sort descending by compositeScore
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    scored.forEach((item, index) => {
      item.rank = index + 1;
    });

    return scored;
  }

  /**
   * Generates a detailed diagnostic verdict and OS explanation
   */
  static generateDiagnosticVerdict(best, allScored, profile, optQuantum, config) {
    const m = best.metrics;
    const runnerUp = allScored[1];
    const fcfs = allScored.find(r => r.key === 'FCFS');
    const srtf = allScored.find(r => r.key === 'SRTF');
    const rr = allScored.find(r => r.key === 'RR');
    const hrrn = allScored.find(r => r.key === 'HRRN');

    let reasoning = `<strong>${best.name}</strong> emerged as the optimal scheduling algorithm with an efficiency score of <strong>${best.compositeScore}/100</strong> under the <em>${profile.toUpperCase()}</em> profile.`;

    const highlights = [];

    // Comparison against FCFS
    if (fcfs && best.key !== 'FCFS') {
      const diffWT = fcfs.metrics.avgWaitingTime - m.avgWaitingTime;
      if (diffWT > 0) {
        const pct = ((diffWT / (fcfs.metrics.avgWaitingTime || 1)) * 100).toFixed(1);
        highlights.push(`Reduces Average Waiting Time by <strong>${diffWT.toFixed(1)} ms (${pct}%)</strong> compared to baseline FCFS.`);
      }
      if (fcfs.metrics.convoyEffectDetected) {
        highlights.push(`Successfully eliminates the <strong>Convoy Effect</strong> observed in FCFS (${fcfs.metrics.convoyDetails}).`);
      }
    }

    // High Risk Warnings & Deep Explanations
    if (m.hasHighRisk && m.risks && m.risks.length > 0) {
      m.risks.forEach(risk => {
        highlights.push(`⚠️ <strong>${risk.severity.toUpperCase()} ALERT (${risk.name}):</strong> ${risk.explanation} <br><span style="font-size:0.82rem; color:var(--text-muted);"><strong>OS Mitigation:</strong> ${risk.mitigation}</span>`);
      });
    } else if (m.starvationRisk) {
      highlights.push(`⚠️ <strong>HIGH RISK (Starvation):</strong> Potential starvation risk detected for ${m.starvedProcesses.map(p => p.id).join(', ')}. In algorithms prioritizing short or high-priority jobs, starvation occurs when waiting jobs are repeatedly bypassed. Consider <strong>${hrrn ? hrrn.name : 'HRRN / MLFQ'}</strong> with aging to prevent indefinite postponement.`);
    } else {
      highlights.push(`🛡️ <strong>Zero High Risk:</strong> Achieves a <strong>${m.fairnessPercent}% Jain's Fairness Index</strong> with zero detected process starvation or convoy blocking.`);
    }

    // Context switch insight
    if (m.contextSwitchCount > 0) {
      highlights.push(`Incurs <strong>${m.contextSwitchCount}</strong> context switches throughout execution.`);
    }

    // Round robin heuristic insight, kept separate from the configuration used for ranking
    if (rr) {
      highlights.push(`Ranked with <strong>q = ${config.timeQuantum}</strong> and <strong>${config.contextSwitchOverhead} ms</strong> context-switch overhead; Apply uses these exact settings. Separately, statistical 80th-percentile burst analysis suggests a Round Robin quantum of <strong>q = ${optQuantum}</strong> (try it with ✨ Auto-Suggest, then re-run the benchmark).`);
    }

    return {
      title: `Recommended Algorithm: ${best.name}`,
      score: best.compositeScore,
      summary: reasoning,
      highlights,
      runnerUpNote: runnerUp ? `Runner-up: <strong>${runnerUp.name}</strong> (Score: ${runnerUp.compositeScore}/100)` : ''
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecommendationEngine;
}
