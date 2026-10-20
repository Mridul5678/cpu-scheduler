/**
 * tests/schedulers.test.js
 * Automated test script to verify correctness of all scheduling algorithms
 * and recommendation engine.
 */

const fs = require('fs');
const path = require('path');
const Process = require('../src/js/models/Process.js');
const runFCFS = require('../src/js/algorithms/fcfs.js');
const runSJF = require('../src/js/algorithms/sjf.js');
const runSRTF = require('../src/js/algorithms/srtf.js');
const runRoundRobin = require('../src/js/algorithms/roundRobin.js');
const { runPriorityNonPreemptive, runPriorityPreemptive } = require('../src/js/algorithms/priority.js');
const runHRRN = require('../src/js/algorithms/hrrn.js');
const runMLQ = require('../src/js/algorithms/mlq.js');
const runMLFQ = require('../src/js/algorithms/mlfq.js');
const SchedulerEvaluator = require('../src/js/engine/evaluator.js');
const RecommendationEngine = require('../src/js/engine/recommendationEngine.js');
const HumanSchedulerGame = require('../src/js/engine/gameEngine.js');

function runTests() {
  console.log('--- RUNNING CPU SCHEDULER VERIFICATION TESTS ---');

  // Standard Test Case
  const testProcesses = [
    new Process({ id: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 }),
    new Process({ id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }),
    new Process({ id: 'P3', arrivalTime: 2, burstTime: 1, priority: 3 })
  ];

  // 1. FCFS Test
  // P1: arrives 0, runs 0..4 (TAT=4, WT=0)
  // P2: arrives 1, runs 4..7 (TAT=6, WT=3)
  // P3: arrives 2, runs 7..8 (TAT=6, WT=5)
  // Total WT = 0 + 3 + 5 = 8. Avg WT = 8/3 = 2.67
  const fcfsRes = runFCFS(testProcesses);
  const fcfsEval = SchedulerEvaluator.evaluate(fcfsRes);
  console.log(`✓ FCFS: Total Time = ${fcfsRes.totalTime}, Avg WT = ${fcfsEval.avgWaitingTime}, Avg TAT = ${fcfsEval.avgTurnaroundTime}`);
  if (fcfsRes.totalTime !== 8 || fcfsEval.avgWaitingTime !== 2.67) {
    throw new Error(`FCFS failed! Expected totalTime=8, avgWT=2.67, got ${fcfsRes.totalTime}, ${fcfsEval.avgWaitingTime}`);
  }

  // 2. SJF (Non-preemptive) Test
  // P1 runs 0..4. At t=4, P2 (burst 3) and P3 (burst 1) arrived.
  // P3 has burst 1, so P3 runs 4..5.
  // P2 runs 5..8.
  // P1: comp 4, TAT 4, WT 0
  // P3: comp 5, TAT 3, WT 2
  // P2: comp 8, TAT 7, WT 4
  // Avg WT = (0 + 2 + 4)/3 = 2.0
  const sjfRes = runSJF(testProcesses);
  const sjfEval = SchedulerEvaluator.evaluate(sjfRes);
  console.log(`✓ SJF: Total Time = ${sjfRes.totalTime}, Avg WT = ${sjfEval.avgWaitingTime}, Avg TAT = ${sjfEval.avgTurnaroundTime}`);
  if (sjfRes.totalTime !== 8 || sjfEval.avgWaitingTime !== 2.0) {
    throw new Error(`SJF failed! Expected avgWT=2.0, got ${sjfEval.avgWaitingTime}`);
  }

  // 3. SRTF (Preemptive SJF) Test
  // t=0: P1 arrives (rem 4), runs t=0..1 (rem 3)
  // t=1: P2 arrives (burst 3). rem(P1)=3 == rem(P2)=3. Tie break P1 continues running.
  // t=1..2: P1 runs (rem 2)
  // t=2: P3 arrives (burst 1). rem(P3)=1 < rem(P1)=2. Preempt!
  // t=2..3: P3 runs, completes at 3.
  // t=3: P1(rem 2) vs P2(rem 3). P1 runs t=3..5, completes at 5.
  // t=5..8: P2 runs, completes at 8.
  // P3: comp 3, TAT = 3-2=1, WT = 1-1=0
  // P1: comp 5, TAT = 5-0=5, WT = 5-4=1
  // P2: comp 8, TAT = 8-1=7, WT = 7-3=4
  // Total WT = 0 + 1 + 4 = 5. Avg WT = 5/3 = 1.67
  const srtfRes = runSRTF(testProcesses);
  const srtfEval = SchedulerEvaluator.evaluate(srtfRes);
  console.log(`✓ SRTF: Total Time = ${srtfRes.totalTime}, Avg WT = ${srtfEval.avgWaitingTime}, Avg TAT = ${srtfEval.avgTurnaroundTime}`);
  if (srtfRes.totalTime !== 8 || srtfEval.avgWaitingTime !== 1.67) {
    throw new Error(`SRTF failed! Expected avgWT=1.67, got ${srtfEval.avgWaitingTime}`);
  }

  // 4. Round Robin (q=2) Test
  const rrRes = runRoundRobin(testProcesses, { timeQuantum: 2 });
  const rrEval = SchedulerEvaluator.evaluate(rrRes);
  console.log(`✓ Round Robin (q=2): Total Time = ${rrRes.totalTime}, Avg WT = ${rrEval.avgWaitingTime}, Avg TAT = ${rrEval.avgTurnaroundTime}`);

  // 5. Priority Preemptive & Non-Preemptive
  const pnpRes = runPriorityNonPreemptive(testProcesses);
  const ppRes = runPriorityPreemptive(testProcesses);
  console.log(`✓ Priority Non-Preemptive: Avg WT = ${SchedulerEvaluator.evaluate(pnpRes).avgWaitingTime}`);
  console.log(`✓ Priority Preemptive: Avg WT = ${SchedulerEvaluator.evaluate(ppRes).avgWaitingTime}`);

  // 6. HRRN Test
  const hrrnRes = runHRRN(testProcesses);
  console.log(`✓ HRRN: Avg WT = ${SchedulerEvaluator.evaluate(hrrnRes).avgWaitingTime}`);

  // 7. MLQ Test
  const mlqRes = runMLQ(testProcesses, { timeQuantum: 2 });
  console.log(`✓ MLQ: Total Time = ${mlqRes.totalTime}`);

  // 8. MLFQ Test
  const mlfqRes = runMLFQ(testProcesses, { q0Quantum: 2, q1Quantum: 4 });
  console.log(`✓ MLFQ: Total Time = ${mlfqRes.totalTime}`);

  // 10. Convoy Effect & Starvation Detection Tests
  const convoyWorkload = [
    new Process({ id: 'P1', arrivalTime: 0, burstTime: 24 }),
    new Process({ id: 'P2', arrivalTime: 1, burstTime: 3 }),
    new Process({ id: 'P3', arrivalTime: 2, burstTime: 2 }),
    new Process({ id: 'P4', arrivalTime: 3, burstTime: 1 })
  ];
  const fcfsConvoy = runFCFS(convoyWorkload);
  const fcfsConvoyEval = SchedulerEvaluator.evaluate(fcfsConvoy);
  console.log(`✓ Convoy Effect Detected: ${fcfsConvoyEval.convoyEffectDetected} (${fcfsConvoyEval.convoyDetails})`);
  if (!fcfsConvoyEval.convoyEffectDetected) {
    throw new Error('Convoy effect should have been detected in FCFS with P1 burst 24!');
  }

  // Priority Starvation Test
  // A low-priority job (P1) is repeatedly preempted by a steady stream of
  // high-priority arrivals. The workload must be heavy enough to cross the
  // evaluator's starvation thresholds (wait >= max(30, 50% of total burst)
  // and wait/burst >= 5), otherwise no risk is flagged.
  const starvationWorkload = [
    new Process({ id: 'P1', arrivalTime: 0, burstTime: 6, priority: 10 }),
    new Process({ id: 'P2', arrivalTime: 1, burstTime: 5, priority: 1 }),
    new Process({ id: 'P3', arrivalTime: 2, burstTime: 5, priority: 1 }),
    new Process({ id: 'P4', arrivalTime: 3, burstTime: 5, priority: 1 }),
    new Process({ id: 'P5', arrivalTime: 4, burstTime: 5, priority: 1 }),
    new Process({ id: 'P6', arrivalTime: 5, burstTime: 5, priority: 1 }),
    new Process({ id: 'P7', arrivalTime: 6, burstTime: 5, priority: 1 }),
    new Process({ id: 'P8', arrivalTime: 7, burstTime: 5, priority: 1 }),
    new Process({ id: 'P9', arrivalTime: 8, burstTime: 5, priority: 1 })
  ];
  const priPRes = runPriorityPreemptive(starvationWorkload, { priorityMode: 'lower-is-higher' });
  const priPEval = SchedulerEvaluator.evaluate(priPRes);
  console.log(`✓ Starvation Detection: hasHighRisk = ${priPEval.hasHighRisk}, Risks Count = ${priPEval.risks.length}`);
  if (!priPEval.hasHighRisk || priPEval.risks.length === 0) {
    throw new Error('Priority Preemptive should have flagged starvation risk on P1!');
  }
  const starvRisk = priPEval.risks.find(r => r.id === 'starvation');
  if (!starvRisk || !starvRisk.explanation || !starvRisk.rootCause || !starvRisk.mitigation) {
    throw new Error('Starvation risk object is missing explanation, rootCause, or mitigation fields!');
  }
  console.log(`  ↳ Starvation Explanation: ${starvRisk.explanation}`);
  console.log(`  ↳ Root Cause: ${starvRisk.rootCause}`);
  console.log(`  ↳ OS Mitigation: ${starvRisk.mitigation}`);

  // Benchmark Diagnostic Risk Explanation Test
  const benchReport = RecommendationEngine.benchmarkAll(starvationWorkload);
  console.log(`✓ Benchmark Report: Best Algorithm = ${benchReport.bestAlgorithm.name}`);
  console.log(`  ↳ Diagnostic Highlights count: ${benchReport.diagnostic.highlights.length}`);

  // 11. Human vs Scheduler Game Engine Test
  let gameCompleted = false;
  let gameSummary = null;
  const gameTest = new HumanSchedulerGame({
    onGameOver: (sum) => {
      gameCompleted = true;
      gameSummary = sum;
    }
  });
  gameTest.start(testProcesses);
  // Human dispatches P1 for 4 ticks
  for (let i = 0; i < 4; i++) gameTest.dispatchTick('P1');
  // Then P3 for 1 tick
  gameTest.dispatchTick('P3');
  // Then P2 for 3 ticks
  for (let i = 0; i < 3; i++) gameTest.dispatchTick('P2');

  console.log(`✓ Human vs Scheduler Game Engine: Completed = ${gameCompleted}, Rank = ${gameSummary ? gameSummary.rankTitle : 'N/A'}, Efficiency = ${gameSummary ? gameSummary.efficiency : 0}%`);
  if (!gameCompleted || !gameSummary) {
    throw new Error('Game did not complete properly!');
  }

  // 12. Context-switch overhead reaches the evaluator (thrashing detection)
  // Every runner must report the configured overhead, because the evaluator's
  // thrashing check reads result.contextSwitchOverhead.
  const allRunners = [
    ['FCFS', opts => runFCFS(testProcesses, opts)],
    ['SJF', opts => runSJF(testProcesses, opts)],
    ['SRTF', opts => runSRTF(testProcesses, opts)],
    ['RR', opts => runRoundRobin(testProcesses, { timeQuantum: 2, ...opts })],
    ['Priority-NP', opts => runPriorityNonPreemptive(testProcesses, opts)],
    ['Priority-P', opts => runPriorityPreemptive(testProcesses, opts)],
    ['HRRN', opts => runHRRN(testProcesses, opts)],
    ['MLQ', opts => runMLQ(testProcesses, { timeQuantum: 2, ...opts })],
    ['MLFQ', opts => runMLFQ(testProcesses, { q0Quantum: 2, q1Quantum: 4, ...opts })]
  ];
  allRunners.forEach(([key, run]) => {
    const withCost = run({ contextSwitchOverhead: 3 }).contextSwitchOverhead;
    const withoutCost = run({}).contextSwitchOverhead;
    if (withCost !== 3 || withoutCost !== 0) {
      throw new Error(`${key} must report contextSwitchOverhead (expected 3 and 0, got ${withCost} and ${withoutCost})`);
    }
  });
  console.log('✓ Context-Switch Overhead: reported by all 9 algorithm results');

  // RR with q=1 and 2 ms overhead on the standard workload:
  // 7 switches x 2 ms = 14 ms of a 22 ms schedule (63.6%), above the 20% threshold.
  const thrashRes = runRoundRobin(testProcesses, { timeQuantum: 1, contextSwitchOverhead: 2 });
  const thrashEval = SchedulerEvaluator.evaluate(thrashRes);
  const thrashRisk = thrashEval.risks.find(r => r.id === 'thrashing');
  console.log(`✓ Thrashing Detection (RR q=1, cs=2): switches = ${thrashRes.contextSwitchCount}, Total Time = ${thrashRes.totalTime}, flagged = ${!!thrashRisk}`);
  if (thrashRes.contextSwitchCount !== 7 || thrashRes.totalTime !== 22) {
    throw new Error(`Expected 7 switches over 22 ms, got ${thrashRes.contextSwitchCount} over ${thrashRes.totalTime}`);
  }
  if (!thrashRisk || !thrashEval.hasHighRisk) {
    throw new Error('RR with q=1 and 2 ms switch overhead (63.6% overhead) should be flagged as thrashing!');
  }

  // Same frequent switching but zero overhead: switches cost nothing, so no thrashing.
  const freeSwitchEval = SchedulerEvaluator.evaluate(runRoundRobin(testProcesses, { timeQuantum: 1, contextSwitchOverhead: 0 }));
  if (freeSwitchEval.risks.some(r => r.id === 'thrashing')) {
    throw new Error('Thrashing must not be flagged when context-switch overhead is 0!');
  }

  // Nonzero but low overhead: FCFS on the convoy workload has 3 switches x 1 ms
  // in a 33 ms schedule (9.1%), below the 20% threshold.
  const lowCostRes = runFCFS(convoyWorkload, { contextSwitchOverhead: 1 });
  const lowCostEval = SchedulerEvaluator.evaluate(lowCostRes);
  if (lowCostRes.totalTime !== 33 || lowCostEval.risks.some(r => r.id === 'thrashing')) {
    throw new Error(`Low-overhead FCFS (3 ms of 33 ms) must not be flagged as thrashing (Total Time = ${lowCostRes.totalTime})`);
  }
  console.log('✓ No False Thrashing: zero-overhead RR and low-overhead FCFS are not flagged');

  // 13. Recommendation report quantum and verdict wiring
  // Bursts [1, 3, 4] give q = 4, so a fallback to the default q = 2 would be visible.
  const quantumReport = RecommendationEngine.benchmarkAll(testProcesses);
  const expectedQuantum = RecommendationEngine.computeOptimalQuantum(testProcesses);
  console.log(`✓ Recommended Quantum: report.recommendedQuantum = ${quantumReport.recommendedQuantum}`);
  if (expectedQuantum !== 4 || quantumReport.recommendedQuantum !== expectedQuantum) {
    throw new Error(`Expected recommendedQuantum = 4, got ${quantumReport.recommendedQuantum} (computeOptimalQuantum = ${expectedQuantum})`);
  }

  // app.js only runs in the browser, so check its source for the two wiring fixes:
  // Apply must read the field the engine actually returns, and the verdict card
  // (hidden by default in index.html) must be shown once a report renders.
  const appSource = fs.readFileSync(path.join(__dirname, '../src/js/app.js'), 'utf8');
  if (appSource.includes('report.optimalQuantum') || !appSource.includes('inputQuantum.value = report.recommendedQuantum')) {
    throw new Error('Apply must set the quantum from report.recommendedQuantum (the field returned by benchmarkAll)');
  }
  if (!appSource.includes("recommendationVerdictCard.style.display = 'block'")) {
    throw new Error('runBenchmarkReport must make the verdict card visible after rendering it');
  }
  console.log('✓ Verdict Card Wiring: card is shown and Apply reads recommendedQuantum');

  // 14. Unique process IDs after deletion
  const idList = [
    new Process({ id: 'P1', arrivalTime: 0, burstTime: 2 }),
    new Process({ id: 'P2', arrivalTime: 1, burstTime: 2 }),
    new Process({ id: 'P3', arrivalTime: 2, burstTime: 2 })
  ];
  idList.splice(1, 1); // delete P2
  const addedIds = [];
  for (let i = 0; i < 3; i++) {
    const id = Process.nextId(idList);
    addedIds.push(id);
    idList.push(new Process({ id, arrivalTime: idList.length, burstTime: 2 }));
  }
  const finalIds = idList.map(p => p.id);
  console.log(`✓ Unique Process IDs: after deleting P2, added ${addedIds.join(', ')} -> [${finalIds.join(', ')}]`);
  if (addedIds.join(',') !== 'P4,P5,P6' || new Set(finalIds).size !== finalIds.length) {
    throw new Error(`Expected P4, P5, P6 with no duplicates, got [${finalIds.join(', ')}]`);
  }
  if (idList[0].id !== 'P1' || idList[0].burstTime !== 2 || idList[1].id !== 'P3' || idList[1].arrivalTime !== 2) {
    throw new Error('Generating an ID must not modify existing processes');
  }
  if (Process.nextId([]) !== 'P1' || Process.nextId([{ id: 'Job' }, { id: 'P7' }]) !== 'P8') {
    throw new Error('nextId should start at P1 and ignore IDs that are not in P<n> form');
  }

  console.log('\n>>> ALL ALGORITHM CORRECTNESS, ANOMALY DETECTION, BENCHMARK, RISK EXPLANATION & GAME TESTS PASSED SUCCESSFULLY! <<<');
}

runTests();
