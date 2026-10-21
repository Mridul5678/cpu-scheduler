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
const SimulationController = require('../src/js/engine/simulator.js');
const buildKernelSyslog = require('../src/js/engine/kernelSyslog.js');
const MultiSchedulerRace = require('../src/js/visualizers/multiRace.js');

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

  // 13. Recommendation report exposes the suggested quantum
  // Bursts [1, 3, 4]: nearest-rank 80th percentile, rank ceil(0.8 * 3) = 3 -> q = 4,
  // so a fallback to the default q = 2 would be visible.
  const quantumReport = RecommendationEngine.benchmarkAll(testProcesses);
  const expectedQuantum = RecommendationEngine.computeOptimalQuantum(testProcesses);
  console.log(`✓ Recommended Quantum: report.recommendedQuantum = ${quantumReport.recommendedQuantum}`);
  if (expectedQuantum !== 4 || quantumReport.recommendedQuantum !== expectedQuantum) {
    throw new Error(`Expected recommendedQuantum = 4, got ${quantumReport.recommendedQuantum} (computeOptimalQuantum = ${expectedQuantum})`);
  }


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

  // 15. Kernel syslog reads the real timeline segment fields
  // FCFS, 1 ms switch cost, both processes arrive at t=2:
  // timeline = IDLE [0,2], P1 [2,4], CONTEXT_SWITCH P1->P2 [4,5], P2 [5,6]
  const syslogWorkload = [
    new Process({ id: 'P1', arrivalTime: 2, burstTime: 2 }),
    new Process({ id: 'P2', arrivalTime: 2, burstTime: 1 })
  ];
  const syslog = buildKernelSyslog(runFCFS(syslogWorkload, { contextSwitchOverhead: 1 }), syslogWorkload,
    { algorithm: 'FCFS', timeQuantum: 2, contextSwitchOverhead: 1 });
  const syslogShape = syslog.map(e => `${e.time}:${e.tag}`).join(' ');
  const expectedShape = '0:BOOT 0:IDLE 2:ARRIVAL 2:ARRIVAL 2:DISPATCH 4:COMPLETE 4:CSWITCH 5:DISPATCH 6:COMPLETE 6:COMPLETE';
  console.log(`✓ Kernel Syslog Events: ${syslogShape}`);
  if (syslogShape !== expectedShape) {
    throw new Error(`Syslog events wrong.\n  expected: ${expectedShape}\n  got:      ${syslogShape}`);
  }
  const msgAt = (time, tag) => syslog.find(e => e.time === time && e.tag === tag).msg;
  if (!msgAt(0, 'IDLE').includes('[0ms - 2ms]') ||
      !msgAt(2, 'DISPATCH').includes('PID P1') || !msgAt(2, 'DISPATCH').includes('[2ms -> 4ms]') ||
      !msgAt(4, 'CSWITCH').includes('PID P1 -> PID P2 (1ms) [4ms -> 5ms]') ||
      !msgAt(5, 'DISPATCH').includes('[5ms -> 6ms]') ||
      !msgAt(4, 'COMPLETE').includes('PID P1')) {
    throw new Error('Syslog messages must use the segment start/end, duration and from/to fields');
  }
  if (syslog.some(e => e.msg.includes('PID null') || e.msg.includes('undefined') || !Number.isFinite(e.time))) {
    throw new Error('Syslog must not log idle time as a dispatch of PID null, or contain undefined fields/timestamps');
  }
  if (syslog.some(e => e.tag === 'PREEMPT')) {
    throw new Error('P1 finished at t=4 before the switch to P2, so no preemption may be logged');
  }

  // SRTF (no switch cost): P1 [0,2], P3 [2,3], P1 [3,5], P2 [5,8].
  // Only P1 -> P3 at t=2 is a preemption; the other changes follow a completion.
  const srtfPreempts = buildKernelSyslog(runSRTF(testProcesses), testProcesses).filter(e => e.tag === 'PREEMPT');
  if (srtfPreempts.length !== 1 || srtfPreempts[0].time !== 2 || !srtfPreempts[0].msg.includes('PID P1 preempted/demoted -> PID P3')) {
    throw new Error(`SRTF should log exactly one preemption (P1 -> P3 at t=2), got ${srtfPreempts.map(e => `${e.time}: ${e.msg}`).join('; ')}`);
  }

  // RR q=1 with 2 ms switches (7 switches, traced above): 5 of them interrupt an
  // unfinished process (P1->P2, P2->P1, P1->P3, P2->P1, P1->P2); P3->P2 at t=10 and
  // P2->P1 at t=19 follow a completion. Each preemption is logged just before its switch.
  const rrSyslog = buildKernelSyslog(thrashRes, testProcesses);
  const rrSwitches = rrSyslog.filter(e => e.tag === 'CSWITCH');
  const rrPreemptIdx = rrSyslog.map((e, i) => (e.tag === 'PREEMPT' ? i : -1)).filter(i => i >= 0);
  if (rrSwitches.length !== 7 || rrPreemptIdx.length !== 5 ||
      rrPreemptIdx.some(i => rrSyslog[i + 1].tag !== 'CSWITCH' || rrSyslog[i + 1].time !== rrSyslog[i].time)) {
    throw new Error(`RR q=1 cs=2 should log 7 switches and 5 preemptions, each directly before its switch (got ${rrSwitches.length} and ${rrPreemptIdx.length})`);
  }
  console.log('✓ Kernel Syslog Preemptions: SRTF logs 1 (P1 -> P3 at t=2); RR q=1, cs=2 logs 5 alongside 7 switches');

  // 16. Empty workload handling
  if (SchedulerEvaluator.evaluate(runFCFS([])) !== null || RecommendationEngine.benchmarkAll([]) !== null) {
    throw new Error('Evaluator and benchmark must return null for an empty workload');
  }
  if (buildKernelSyslog(null, []).length !== 0) {
    throw new Error('Syslog builder must return no events when there is no result');
  }

  // Simulator: switching to an empty workload must drop the previous run
  const sim = new SimulationController();
  let emptyTickEvents = 0;
  sim.setProcesses(testProcesses.map(p => p.clone()));
  if (!sim.simulationResult || !sim.evaluation) {
    throw new Error('Simulator should have a result for a non-empty workload');
  }
  sim.on('tick', () => { emptyTickEvents++; });
  sim.setProcesses([]);
  sim.play(); sim.stepForward(); sim.stepBackward(); sim.jumpToEnd();
  if (sim.simulationResult !== null || sim.evaluation !== null || sim.isPlaying || emptyTickEvents !== 0) {
    throw new Error('Simulator must clear the previous result (and emit no ticks) for an empty workload');
  }

  // Game: an empty workload starts inactive and ignores dispatches
  const emptyStates = [];
  let emptyGameOver = false;
  const emptyGame = new HumanSchedulerGame({ onStateChange: s => emptyStates.push(s), onGameOver: () => { emptyGameOver = true; } });
  emptyGame.start([]);
  emptyGame.dispatchTick(null);
  emptyGame.dispatchTick('P1');
  const lastEmptyState = emptyStates[emptyStates.length - 1];
  if (lastEmptyState.hasWorkload !== false || emptyGame.isGameActive || emptyGame.aiEvaluation !== null ||
      emptyGame.currentTick !== 0 || emptyGameOver) {
    throw new Error('Game must stay inactive for an empty workload (no AI target, no ticks, no game over)');
  }
  emptyGame.start(testProcesses);
  if (!emptyGame.isGameActive || !emptyGame.aiEvaluation || emptyStates[emptyStates.length - 1].hasWorkload !== true) {
    throw new Error('Game must start normally after an empty workload is replaced');
  }

  // Race: an empty workload gives no tracks instead of evaluating null metrics
  const emptyRace = new MultiSchedulerRace(null);
  emptyRace.setup([], ['FCFS', 'SRTF'], { timeQuantum: 2 });
  if (emptyRace.results.length !== 0) {
    throw new Error('Race must have no tracks for an empty workload');
  }
  console.log('✓ Empty Workload: simulator clears stale results; game, race, benchmark and syslog handle it safely');

  // 17. Race Top 3 covers every algorithm the benchmark can rank
  const raceConfig = { timeQuantum: 2, contextSwitchOverhead: 1, priorityMode: 'lower-is-higher' };
  const raceReport = RecommendationEngine.benchmarkAll(convoyWorkload, { profile: 'balanced', ...raceConfig });
  const raceKeys = MultiSchedulerRace.ALGORITHMS.map(a => a.key);
  const unraceable = raceReport.leaderboard.map(r => r.key).filter(k => !raceKeys.includes(k));
  if (raceReport.leaderboard.length !== 9 || unraceable.length > 0) {
    throw new Error(`Every benchmarked algorithm must be raceable; missing: ${unraceable.join(', ')}`);
  }

  // A top-three selection containing MLQ and Priority-NP must race exactly those
  // algorithms, with the same results the leaderboard ranked.
  const raceWithReportConfig = selection => {
    const race = new MultiSchedulerRace(null);
    race.setup(convoyWorkload, selection, raceReport.config);
    return race;
  };
  const sameMetrics = (a, b) => a.avgWaitingTime === b.avgWaitingTime && a.avgTurnaroundTime === b.avgTurnaroundTime &&
    a.avgResponseTime === b.avgResponseTime && a.contextSwitchCount === b.contextSwitchCount && a.totalTime === b.totalTime;
  const checkRace = selection => {
    const race = raceWithReportConfig(selection);
    const raced = race.results.map(r => r.result.algorithm);
    if (raced.join(',') !== selection.join(',')) {
      throw new Error(`Race for [${selection.join(', ')}] ran [${raced.join(', ')}]`);
    }
    race.results.forEach(r => {
      const ranked = raceReport.leaderboard.find(l => l.key === r.key);
      if (!sameMetrics(r.metrics, ranked.metrics)) {
        throw new Error(`Raced ${r.key} differs from its leaderboard result (WT ${r.metrics.avgWaitingTime} vs ${ranked.metrics.avgWaitingTime})`);
      }
    });
  };
  checkRace(['MLQ', 'Priority-NP', 'SRTF']);
  const realTop3 = raceReport.leaderboard.slice(0, 3).map(r => r.key);
  checkRace(realTop3);

  let unknownRejected = false;
  try { raceWithReportConfig(['NOT-AN-ALGORITHM']); } catch (e) { unknownRejected = true; }
  if (!unknownRejected) {
    throw new Error('An unknown race selection must be rejected, not replaced by FCFS');
  }
  console.log(`✓ Race Top 3: all 9 algorithms raceable; [MLQ, Priority-NP, SRTF] and real top 3 [${realTop3.join(', ')}] race as ranked`);

  // 18. Apply reproduces the configuration the benchmark ranked with
  // Apply sets the winner's algorithm plus report.config in the simulator, so re-running
  // any leaderboard entry through the simulator with that config must give the same result.
  const checkApplyConsistency = (workload, options) => {
    const report = RecommendationEngine.benchmarkAll(workload, options);
    const expectedConfig = {
      timeQuantum: options.timeQuantum,
      contextSwitchOverhead: options.contextSwitchOverhead,
      priorityMode: options.priorityMode
    };
    if (JSON.stringify(report.config) !== JSON.stringify(expectedConfig)) {
      throw new Error(`report.config ${JSON.stringify(report.config)} should equal the options used ${JSON.stringify(expectedConfig)}`);
    }
    report.leaderboard.forEach(entry => {
      const applied = new SimulationController();
      applied.setOptions(report.config);
      applied.setAlgorithm(entry.key);
      applied.setProcesses(workload.map(p => p.clone()));
      if (!sameMetrics(applied.evaluation, entry.metrics)) {
        throw new Error(`Applying ${entry.key} with report.config gave WT ${applied.evaluation.avgWaitingTime}, leaderboard says ${entry.metrics.avgWaitingTime}`);
      }
    });
    return report;
  };
  const convoyReport = checkApplyConsistency(convoyWorkload, { profile: 'balanced', timeQuantum: 2, contextSwitchOverhead: 0, priorityMode: 'lower-is-higher' });
  checkApplyConsistency(starvationWorkload, { profile: 'fairness', timeQuantum: 3, contextSwitchOverhead: 1, priorityMode: 'higher-is-higher' });

  // Why Apply must not swap in recommendedQuantum: for the convoy workload the suggestion
  // (bursts [2, 3, 3, 24] -> rank ceil(0.8 * 4) = 4 -> q = 24) is not the ranked q = 2, and
  // MLQ behaves differently at q = 24.
  const mlqAtSuggested = SchedulerEvaluator.evaluate(runMLQ(convoyWorkload, { timeQuantum: convoyReport.recommendedQuantum }));
  const mlqRanked = convoyReport.leaderboard.find(r => r.key === 'MLQ').metrics;
  if (convoyReport.recommendedQuantum !== 24 || mlqAtSuggested.avgWaitingTime === mlqRanked.avgWaitingTime) {
    throw new Error(`Expected the suggested quantum (24) to differ from the ranked configuration in its MLQ result (got q* = ${convoyReport.recommendedQuantum})`);
  }
  // With no quantum given, the suggestion itself is the ranked configuration
  const defaultReport = RecommendationEngine.benchmarkAll(convoyWorkload);
  if (defaultReport.config.timeQuantum !== defaultReport.recommendedQuantum) {
    throw new Error('Without a quantum option, the benchmark should rank with the suggested quantum');
  }
  console.log(`✓ Apply Consistency: all 9 leaderboard results reproduced from report.config (q = ${convoyReport.config.timeQuantum}); suggestion q* = ${convoyReport.recommendedQuantum} kept separate`);

  // 19. Suggested quantum = nearest-rank 80th percentile of the burst times
  // rank = ceil(0.8 * n); q = the burst at that 1-based position after sorting.
  const quantumFor = bursts => RecommendationEngine.computeOptimalQuantum(
    bursts.map((b, i) => new Process({ id: `P${i + 1}`, arrivalTime: 0, burstTime: b }))
  );
  const quantumCases = [
    // [description, bursts (any order), expected q, derivation]
    ['odd n', [100, 3, 1, 4, 2], 4, 'sorted [1,2,3,4,100], rank ceil(4.0) = 4'],
    ['even n = 10', [7, 2, 9, 4, 10, 1, 6, 3, 8, 5], 8, 'sorted 1..10, rank ceil(8.0) = 8'],
    ['even n = 6', [6, 1, 5, 2, 4, 3], 5, 'sorted 1..6, rank ceil(4.8) = 5'],
    ['even n = 4 (Convoy preset)', [24, 3, 3, 2], 24, 'sorted [2,3,3,24], rank ceil(3.2) = 4'],
    ['single process', [7], 7, 'rank ceil(0.8) = 1'],
    ['identical bursts', [5, 5, 5, 5], 5, 'every rank holds 5'],
    // Invalid bursts follow the Process model's validation: non-numbers and values <= 0 become 1
    ['zero, negative and non-numeric bursts', [0, -3, 'abc', 6, 6], 6, 'clamped to [1,1,1,6,6], rank ceil(4.0) = 4'],
    ['only invalid bursts', [0, -1], 1, 'clamped to [1,1], rank ceil(1.6) = 2']
  ];
  quantumCases.forEach(([desc, bursts, expected, why]) => {
    const q = quantumFor(bursts);
    if (q !== expected) {
      throw new Error(`Quantum for ${desc} ${JSON.stringify(bursts)}: expected ${expected} (${why}), got ${q}`);
    }
  });
  if (RecommendationEngine.computeOptimalQuantum([]) !== 2 || RecommendationEngine.benchmarkAll([]) !== null) {
    throw new Error('Empty workload: the suggestion keeps its default q = 2 and the benchmark returns null');
  }

  // The benchmark report and the Suggest button use the same function, so they agree
  const q80Workload = [1, 2, 3, 4, 100].map((b, i) => new Process({ id: `P${i + 1}`, arrivalTime: i, burstTime: b }));
  if (RecommendationEngine.benchmarkAll(q80Workload).recommendedQuantum !== 4) {
    throw new Error('benchmarkAll should report recommendedQuantum = 4 for bursts [1, 2, 3, 4, 100]');
  }

  // Definition check on generated workloads: q is one of the bursts, at least 80% of
  // bursts are <= q, and fewer than 80% are < q (q is the smallest value with that property).
  // Seeded Park-Miller generator so the workloads are the same on every run
  let seed = 12345;
  const nextRandom = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let trial = 0; trial < 200; trial++) {
    const n = 1 + Math.floor(nextRandom() * 12);
    const bursts = Array.from({ length: n }, () => 1 + Math.floor(nextRandom() * 30));
    const q = quantumFor(bursts);
    const atMost = bursts.filter(b => b <= q).length;
    const below = bursts.filter(b => b < q).length;
    if (!bursts.includes(q) || atMost * 5 < 4 * n || below * 5 >= 4 * n) {
      throw new Error(`Nearest-rank property failed for ${JSON.stringify(bursts)}: q = ${q}`);
    }
  }
  console.log(`✓ Quantum Rule: nearest-rank 80th percentile; [1, 2, 3, 4, 100] -> ${quantumFor([1, 2, 3, 4, 100])}; ${quantumCases.length} edge cases and 200 generated workloads`);

  // 20. A recommended quantum above 20 is accepted end to end
  // Convoy bursts [24, 3, 3, 2] suggest q = 24 (section 19). Applying it must not be capped.
  const largeQ = RecommendationEngine.computeOptimalQuantum(convoyWorkload);
  const largeQReport = RecommendationEngine.benchmarkAll(convoyWorkload, { timeQuantum: largeQ });
  const largeQSim = new SimulationController();
  largeQSim.setOptions({ timeQuantum: largeQ });
  largeQSim.setAlgorithm('RR');
  largeQSim.setProcesses(convoyWorkload.map(p => p.clone()));
  // With q = 24 >= every burst, each process runs to completion in one slice: P1 [0,24], P2 [24,27], ...
  const firstSlice = largeQSim.simulationResult.timeline.find(s => s.type === 'PROCESS');
  if (largeQ !== 24 || largeQReport.config.timeQuantum !== 24 || runRoundRobin(convoyWorkload, { timeQuantum: largeQ }).quantum !== 24 ||
      largeQSim.simulationResult.quantum !== 24 || firstSlice.processId !== 'P1' || firstSlice.end !== 24) {
    throw new Error(`Quantum 24 must be used unchanged (suggested ${largeQ}, report ${largeQReport.config.timeQuantum}, simulator ${largeQSim.simulationResult.quantum}, first slice ends at ${firstSlice.end})`);
  }

  // The quantum input in index.html must allow it: positive whole numbers with no upper cap
  const quantumInputTag = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(/<input[^>]*id="inputQuantum"[^>]*>/)[0];
  const attr = name => (quantumInputTag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
  if (attr('type') !== 'number' || attr('min') !== '1' || attr('step') !== '1' || attr('max') !== undefined) {
    throw new Error(`Quantum input should be type="number" min="1" step="1" with no max, found: ${quantumInputTag}`);
  }
  console.log(`✓ Large Quantum: q = ${largeQ} applied unchanged by benchmark, RR and simulator; quantum input has min="1" and no max`);

  // 21. Context-switch counting and CPU utilization accounting
  // A context switch = the CPU starts a different process from the one it last ran (also after
  // an idle gap); the first dispatch is not one. The count does not depend on the switch cost.
  const runAlgo = {
    FCFS: (w, o) => runFCFS(w, o),
    SJF: (w, o) => runSJF(w, o),
    SRTF: (w, o) => runSRTF(w, o),
    RR: (w, o) => runRoundRobin(w, { timeQuantum: 2, ...o }),
    'Priority-NP': (w, o) => runPriorityNonPreemptive(w, o),
    'Priority-P': (w, o) => runPriorityPreemptive(w, o),
    HRRN: (w, o) => runHRRN(w, o),
    MLQ: (w, o) => runMLQ(w, { timeQuantum: 2, ...o }),
    MLFQ: (w, o) => runMLFQ(w, { q0Quantum: 2, q1Quantum: 4, ...o })
  };
  // Standard workload P1(0,4,pri 2), P2(1,3,pri 1), P3(2,1,pri 3); dispatch order by hand:
  const expectedSwitches = {
    FCFS: 2,          // P1 P2 P3
    SJF: 2,           // P1 P3 P2
    SRTF: 3,          // P1 P3 P1 P2
    RR: 4,            // q=2: P1 P2 P3 P1 P2
    'Priority-NP': 2, // P1 P2 P3
    'Priority-P': 3,  // P1 P2 P1 P3 (P2 has higher priority and preempts P1 at t=1)
    HRRN: 2,          // P1 P3 P2 (at t=4 P3's ratio 3 beats P2's 2)
    MLQ: 4,           // all in Q0 with q=2, same as RR
    MLFQ: 4           // P1 P2 P3 (Q0, q=2), then P1 P2 (Q1)
  };
  Object.entries(runAlgo).forEach(([key, run]) => {
    const free = run(testProcesses, { contextSwitchOverhead: 0 }).contextSwitchCount;
    const costly = run(testProcesses, { contextSwitchOverhead: 2 }).contextSwitchCount;
    if (free !== expectedSwitches[key] || costly !== expectedSwitches[key]) {
      throw new Error(`${key}: expected ${expectedSwitches[key]} context switches at cost 0 and 2, got ${free} and ${costly}`);
    }
  });

  // First dispatch is not a switch; a change after an idle gap is.
  const loneProcess = [new Process({ id: 'P1', arrivalTime: 3, burstTime: 4 })];               // idle [0,3], P1 [3,7]
  const gapWorkload = [new Process({ id: 'P1', arrivalTime: 0, burstTime: 2 }),
                       new Process({ id: 'P2', arrivalTime: 5, burstTime: 3 })];               // P1 [0,2], idle [2,5], P2 [5,8]
  Object.entries(runAlgo).forEach(([key, run]) => {
    const lone = run(loneProcess, { contextSwitchOverhead: 2 });
    const gapFree = run(gapWorkload, { contextSwitchOverhead: 0 });
    const gapCostly = run(gapWorkload, { contextSwitchOverhead: 2 });
    if (lone.contextSwitchCount !== 0 || lone.totalTime !== 7) {
      throw new Error(`${key}: a single process must not count a switch (got ${lone.contextSwitchCount}, total ${lone.totalTime})`);
    }
    // After the gap the switch to P2 costs 2: P2 then runs [7,10]
    if (gapFree.contextSwitchCount !== 1 || gapCostly.contextSwitchCount !== 1 || gapFree.totalTime !== 8 || gapCostly.totalTime !== 10) {
      throw new Error(`${key}: the change to P2 after the idle gap must count once (got ${gapFree.contextSwitchCount}/${gapCostly.contextSwitchCount}, totals ${gapFree.totalTime}/${gapCostly.totalTime})`);
    }
  });
  console.log('✓ Context Switches: all 9 algorithms count process changes at cost 0 and 2; first dispatch excluded; change after idle counted');

  // Play view: playing exactly the SRTF schedule gives the same switch count as the SRTF benchmark
  let srtfReplay = null;
  const replayGame = new HumanSchedulerGame({ onGameOver: s => { srtfReplay = s; } });
  replayGame.start(testProcesses);
  ['P1', 'P1', 'P3', 'P1', 'P1', 'P2', 'P2', 'P2'].forEach(pid => replayGame.dispatchTick(pid));
  if (!srtfReplay || srtfReplay.humanMetrics.contextSwitchCount !== 3 || srtfReplay.aiMetrics.contextSwitchCount !== 3) {
    throw new Error(`Play and SRTF should both count 3 switches for the same schedule, got ${srtfReplay && srtfReplay.humanMetrics.contextSwitchCount} and ${srtfReplay && srtfReplay.aiMetrics.contextSwitchCount}`);
  }
  console.log('✓ Play vs SRTF: same schedule, same switch count (3)');

  // RR q=2 with switch cost 2: 8 units of execution + 4 switches x 2 = 8 units of overhead, total 16
  const rrCostly = runRoundRobin(testProcesses, { timeQuantum: 2, contextSwitchOverhead: 2 });
  const rrCostlyEval = SchedulerEvaluator.evaluate(rrCostly);
  if (rrCostly.totalTime !== 16 || rrCostlyEval.executionTime !== 8 || rrCostlyEval.switchOverheadTime !== 8 ||
      rrCostlyEval.cpuUtilization !== 50 || rrCostlyEval.switchOverheadPercent !== 50 || rrCostlyEval.idlePercent !== 0) {
    throw new Error(`RR q=2, cost 2: expected 8 + 8 = 16 units, 50% utilization and 50% overhead; got ${JSON.stringify({
      total: rrCostly.totalTime, exec: rrCostlyEval.executionTime, overhead: rrCostlyEval.switchOverheadTime,
      util: rrCostlyEval.cpuUtilization, overheadPct: rrCostlyEval.switchOverheadPercent, idlePct: rrCostlyEval.idlePercent })}`);
  }
  // The kernel log reports the same definition
  const rrLogSummary = buildKernelSyslog(rrCostly, testProcesses).slice(-1)[0].msg;
  if (!rrLogSummary.includes('CPU Util: 50.0%') || !rrLogSummary.includes('Switch overhead: 50.0%')) {
    throw new Error(`Kernel log summary should report 50% utilization and 50% overhead: ${rrLogSummary}`);
  }
  console.log(`✓ Utilization: RR q=2 cost 2 -> 8 exec + 8 overhead = 16; ${rrCostlyEval.cpuUtilization}% useful, ${rrCostlyEval.switchOverheadPercent}% overhead (log agrees)`);

  // Execution + overhead + idle = total elapsed time for every algorithm, workload and cost
  [testProcesses, gapWorkload, loneProcess, convoyWorkload].forEach(w => [0, 1, 2].forEach(cost => {
    Object.entries(runAlgo).forEach(([key, run]) => {
      const r = run(w, { contextSwitchOverhead: cost });
      const ev = SchedulerEvaluator.evaluate(r);
      const burstSum = w.reduce((a, p) => a + p.burstTime, 0);
      const pctSum = ev.cpuUtilization + ev.switchOverheadPercent + ev.idlePercent;
      if (ev.executionTime + ev.switchOverheadTime + ev.idleTime !== r.totalTime || ev.executionTime !== burstSum ||
          ev.switchOverheadTime !== r.contextSwitchCount * cost || Math.abs(pctSum - 100) > 0.2) {
        throw new Error(`${key} (cost ${cost}): ${ev.executionTime} + ${ev.switchOverheadTime} + ${ev.idleTime} should equal ${r.totalTime}, percentages sum to ${pctSum}`);
      }
    });
  }));

  // Single process: 4 units of work in 7 (3 idle) -> 57.1% useful, 0% overhead, 42.9% idle
  const loneEval = SchedulerEvaluator.evaluate(runFCFS(loneProcess, { contextSwitchOverhead: 2 }));
  if (loneEval.cpuUtilization !== 57.1 || loneEval.switchOverheadPercent !== 0 || loneEval.idlePercent !== 42.9 || loneEval.contextSwitchCount !== 0) {
    throw new Error(`Single process: expected 57.1% / 0% / 42.9% and 0 switches, got ${loneEval.cpuUtilization} / ${loneEval.switchOverheadPercent} / ${loneEval.idlePercent}, ${loneEval.contextSwitchCount}`);
  }
  // Empty workload: no metrics, and the time breakdown is all zeros rather than NaN
  const emptyBreakdown = SchedulerEvaluator.timeBreakdown(runFCFS([]));
  if (SchedulerEvaluator.evaluate(runFCFS([])) !== null ||
      [emptyBreakdown.cpuUtilization, emptyBreakdown.switchOverheadPercent, emptyBreakdown.idlePercent].some(v => v !== 0)) {
    throw new Error(`Empty workload: evaluate should return null and the breakdown should be 0% everywhere, got ${JSON.stringify(emptyBreakdown)}`);
  }
  console.log('✓ Time Accounting: execution + overhead + idle = total for 9 algorithms x 4 workloads x 3 costs; single-process and empty cases safe');

  // 22. Incomplete schedules (10,000-step safety limit) and workload limits
  // The largest valid workload (50 processes, burst 100, arrivals 0..98) finishes in every algorithm.
  const largestValid = Array.from({ length: 50 }, (_, i) => new Process({ id: `P${i + 1}`, arrivalTime: i * 2, burstTime: 100 }));
  Object.entries(runAlgo).forEach(([key, run]) => {
    const r = run(largestValid, { contextSwitchOverhead: 2 });
    const ev = SchedulerEvaluator.evaluate(r);
    if (!r.isComplete || r.unfinishedProcessIds.length !== 0 || !ev.isComplete || ev.avgWaitingTime === null) {
      throw new Error(`${key}: the largest valid workload must finish within the safety limit (unfinished: ${r.unfinishedProcessIds})`);
    }
  });

  // Beyond the UI limits (runner API only): P1 needs 12,000 units, more steps than the limit allows
  // for per-time-unit algorithms such as SRTF, while FCFS needs only 2 dispatches.
  const overLimit = [new Process({ id: 'P1', arrivalTime: 0, burstTime: 12000 }), new Process({ id: 'P2', arrivalTime: 1, burstTime: 5 })];
  const cutSrtf = runSRTF(overLimit);
  const fullFcfs = runFCFS(overLimit);
  if (cutSrtf.isComplete !== false || cutSrtf.unfinishedProcessIds.join() !== 'P1' || cutSrtf.stepLimit !== 10000 ||
      fullFcfs.isComplete !== true || fullFcfs.unfinishedProcessIds.length !== 0) {
    throw new Error(`SRTF must be marked incomplete with P1 unfinished, FCFS complete (got ${cutSrtf.isComplete}/${cutSrtf.unfinishedProcessIds}, ${fullFcfs.isComplete})`);
  }

  // The evaluator reports unavailable metrics as null, never as zeros, and no usual risk verdicts
  const cutEval = SchedulerEvaluator.evaluate(cutSrtf);
  const cutP1 = cutEval.processes.find(p => p.id === 'P1');
  const cutP2 = cutEval.processes.find(p => p.id === 'P2');
  if (cutEval.isComplete !== false || cutEval.unfinishedProcesses.join() !== 'P1' ||
      [cutEval.avgWaitingTime, cutEval.avgTurnaroundTime, cutEval.avgResponseTime, cutEval.throughput, cutEval.fairnessPercent].some(v => v !== null) ||
      cutEval.risks.map(r => r.id).join() !== 'incomplete' || !cutEval.hasHighRisk) {
    throw new Error(`Incomplete run must have null averages/throughput/fairness and only the "incomplete" risk: ${JSON.stringify(cutEval.risks.map(r => r.id))}`);
  }
  if (cutP1.finished !== false || cutP1.completionTime !== -1 || cutP1.turnaroundTime !== null || cutP1.waitingTime !== null ||
      cutP2.finished !== true || cutP2.completionTime !== 6 || cutP2.turnaroundTime !== 5) {
    throw new Error(`Unfinished P1 must have no final timings; finished P2 keeps its own (P1 ${JSON.stringify(cutP1)}, P2 ${JSON.stringify(cutP2)})`);
  }
  const cutLog = buildKernelSyslog(cutSrtf, overLimit).slice(-1)[0];
  if (cutLog.msg.includes('All workloads processed') || cutLog.tag !== 'WARN' || !cutLog.msg.includes('Unfinished: PID P1')) {
    throw new Error(`Kernel log must report the early stop and unfinished P1: ${cutLog.tag} ${cutLog.msg}`);
  }
  // A process arriving after the stop time was never reached: no arrival is logged for it and
  // the stop message stays the last event
  const lateArrival = [...overLimit, new Process({ id: 'P3', arrivalTime: 10050, burstTime: 1 })];
  const lateLog = buildKernelSyslog(runSRTF(lateArrival), lateArrival);
  if (lateLog.some(e => e.msg.includes('PID P3 arrived')) || lateLog.slice(-1)[0].tag !== 'WARN' ||
      !lateLog.slice(-1)[0].msg.includes('PID P3 (1 of 1ms left)')) {
    throw new Error(`Log must not show arrivals after the stop and must end with the stop message: ${lateLog.slice(-1)[0].msg}`);
  }
  const completeEval = SchedulerEvaluator.evaluate(fullFcfs);
  if (!completeEval.isComplete || completeEval.avgWaitingTime !== 5999.5 || completeEval.processes.some(p => !p.finished)) {
    throw new Error('A completed run must keep its ordinary metrics');
  }
  console.log(`✓ Incomplete Runs: SRTF stopped at t=${cutSrtf.totalTime} is flagged (P1 unfinished, averages null, log warns); largest valid workload completes in all 9`);

  // Recommend: an incomplete run never wins and is listed after every completed run
  const limitReport = RecommendationEngine.benchmarkAll(overLimit, { timeQuantum: 2 });
  const firstIncompleteRank = Math.min(...limitReport.leaderboard.filter(e => e.incomplete).map(e => e.rank));
  const lastCompleteRank = Math.max(...limitReport.leaderboard.filter(e => !e.incomplete).map(e => e.rank));
  if (!limitReport.bestAlgorithm || limitReport.bestAlgorithm.incomplete || !limitReport.bestAlgorithm.metrics.isComplete ||
      limitReport.incompleteKeys.length === 0 || firstIncompleteRank < lastCompleteRank ||
      limitReport.leaderboard.some(e => e.incomplete && e.compositeScore !== null)) {
    throw new Error(`Incomplete runs must rank after completed ones without a score (winner ${limitReport.bestAlgorithm && limitReport.bestAlgorithm.key}, incomplete ${limitReport.incompleteKeys})`);
  }

  // If every candidate is incomplete there is no winner. No valid UI workload can make all nine
  // stop early, so each runner is temporarily replaced by a real truncated SRTF run.
  const runnerNames = ['runFCFS', 'runSJF', 'runSRTF', 'runRoundRobin', 'runPriorityNonPreemptive', 'runPriorityPreemptive', 'runHRRN', 'runMLQ', 'runMLFQ'];
  const savedRunners = runnerNames.map(name => global[name]);
  const realSrtf = global.runSRTF;
  let allIncompleteReport;
  try {
    runnerNames.forEach(name => { global[name] = (w, o) => realSrtf(w, o); });
    allIncompleteReport = RecommendationEngine.benchmarkAll(overLimit, { timeQuantum: 2 });
  } finally {
    runnerNames.forEach((name, i) => { global[name] = savedRunners[i]; });
  }
  if (allIncompleteReport.bestAlgorithm !== null || allIncompleteReport.diagnostic !== null ||
      allIncompleteReport.leaderboard.length !== 9 || !allIncompleteReport.leaderboard.every(e => e.incomplete && e.compositeScore === null)) {
    throw new Error('When no algorithm finishes, the report must have no winner and every entry marked incomplete');
  }
  console.log(`✓ Recommend: winner ${limitReport.bestAlgorithm.key} (complete); ${limitReport.incompleteKeys.length} incomplete runs ranked last without scores; no winner when all are incomplete`);

  // Race: an incomplete lane is identifiable from its metrics
  const limitRace = new MultiSchedulerRace(null);
  limitRace.setup(overLimit, ['FCFS', 'SRTF'], { timeQuantum: 2 });
  const laneState = limitRace.results.map(r => `${r.key}:${r.metrics.isComplete}`).join();
  if (laneState !== 'FCFS:true,SRTF:false' || limitRace.results[1].metrics.unfinishedProcesses.join() !== 'P1') {
    throw new Error(`Race lanes should be FCFS complete, SRTF incomplete (P1), got ${laneState}`);
  }
  console.log('✓ Race: incomplete SRTF lane is marked (unfinished P1); FCFS lane complete');

  // Workload limits: at most 50 processes, burst 1-100, arrival 0-100, whole numbers
  const rows = (n, arrival, burst) => Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, arrivalTime: arrival, burstTime: burst }));
  const rejected = {
    '51 processes': rows(51, 0, 5),
    'burst 0': rows(1, 0, 0),
    'burst 101': rows(1, 0, 101),
    'burst 2.5': rows(1, 0, 2.5),
    'burst missing': [{ id: 'P1', arrivalTime: 0 }],
    'arrival -1': rows(1, -1, 5),
    'arrival 101': rows(1, 101, 5),
    'arrival "abc"': rows(1, 'abc', 5),
    'duplicate IDs': [{ id: 'P1', arrivalTime: 0, burstTime: 5 }, { id: 'P1', arrivalTime: 1, burstTime: 5 }],
    'not an array': { id: 'P1', arrivalTime: 0, burstTime: 5 }
  };
  Object.entries(rejected).forEach(([why, data]) => {
    const check = Process.validateWorkload(data);
    if (check.ok || check.processes.length !== 0 || check.errors.length === 0) {
      throw new Error(`Import with ${why} must be rejected with an error message`);
    }
  });
  const tooMany = Process.validateWorkload(rows(51, 0, 5)).errors[0];
  if (!tooMany.includes('51') || !tooMany.includes('50')) {
    throw new Error(`The error should state the count and the maximum: ${tooMany}`);
  }

  const boundary = Process.validateWorkload([
    { id: 'P1', arrivalTime: 0, burstTime: 1 },
    { id: 'P2', arrivalTime: 100, burstTime: 100 },
    ...rows(48, 50, 50).map((p, i) => ({ ...p, id: `P${i + 3}` }))
  ]);
  if (!boundary.ok || boundary.processes.length !== 50 || boundary.processes[0].burstTime !== 1 ||
      boundary.processes[1].arrivalTime !== 100 || boundary.processes[1].burstTime !== 100) {
    throw new Error(`Boundary values and exactly 50 processes must be accepted: ${boundary.errors.join(' | ')}`);
  }
  // Processes without IDs get unique ones that do not clash with the given IDs
  const generated = Process.validateWorkload([{ arrivalTime: 0, burstTime: 3 }, { id: 'P2', arrivalTime: 1, burstTime: 2 }, { arrivalTime: 2, burstTime: 1 }]);
  const generatedIds = generated.processes.map(p => p.id);
  if (!generated.ok || new Set(generatedIds).size !== 3 || !generatedIds.includes('P2')) {
    throw new Error(`Missing IDs must be filled with unique IDs: ${generatedIds}`);
  }

  // Process IDs: letters, digits, hyphens and underscores only, 1-12 characters, unique ignoring case.
  // Anything else is rejected (the whole import), never cleaned up.
  const withIds = ids => ids.map((id, i) => ({ id, arrivalTime: i, burstTime: 2 }));
  const badIds = {
    'HTML tag': ['<img src=x onerror=alert(1)>'],
    'HTML in an otherwise valid workload': ['P1', '<b>P2</b>'],
    'double quote': ['P"2'],
    'single quote': ["P'3"],
    '13 characters': ['abcdefghijklm'],
    'leading space (not trimmed)': [' P1'],
    'inner space': ['P 1'],
    'non-ASCII letter': ['Pé1'],
    'boolean ID': [true],
    'object ID': [{ id: 'P1' }],
    'case-insensitive duplicate': ['P1', 'p1'],
    'case-insensitive duplicate (words)': ['Job_A', 'JOB_a']
  };
  Object.entries(badIds).forEach(([why, ids]) => {
    const check = Process.validateWorkload(withIds(ids));
    if (check.ok || check.processes.length !== 0) {
      throw new Error(`Import with an invalid ID (${why}) must be rejected as a whole`);
    }
  });
  const htmlError = Process.validateWorkload(withIds(['<img src=x>'])).errors[0];
  const caseError = Process.validateWorkload(withIds(['P1', 'p1'])).errors[0];
  if (!htmlError.includes('letters, digits, hyphens and underscores') || !caseError.includes('"p1"') || !caseError.includes('"P1"')) {
    throw new Error(`ID errors should explain the rule and name both clashing IDs: ${htmlError} | ${caseError}`);
  }

  const goodIds = ['P1', 'job-7', 'Task_01', 'A', 'abcDEF123456', 7];
  const goodCheck = Process.validateWorkload(withIds(goodIds));
  if (!goodCheck.ok || goodCheck.processes.map(p => p.id).join() !== 'P1,job-7,Task_01,A,abcDEF123456,7') {
    throw new Error(`Valid IDs (incl. exactly 12 characters and a numeric ID) must be kept exactly: ${goodCheck.errors.join(' | ')}`);
  }
  // A generated ID never clashes with a given ID that differs only in case
  const caseGenerated = Process.validateWorkload([{ id: 'p7', arrivalTime: 0, burstTime: 2 }, { arrivalTime: 1, burstTime: 2 }]);
  if (!caseGenerated.ok || caseGenerated.processes[1].id !== 'P8' || Process.nextId([{ id: 'p7' }]) !== 'P8') {
    throw new Error(`Generated IDs must skip "p7" (got ${caseGenerated.processes.map(p => p.id)})`);
  }
  // Colors: only exact #RRGGBB is accepted; a missing color keeps the default from the ID
  const withColor = color => [{ id: 'P1', arrivalTime: 0, burstTime: 2, color }, { id: 'P2', arrivalTime: 1, burstTime: 3 }];
  const goodColors = ['#4f97e8', '#ABCDEF', '#00ff7F'];
  goodColors.forEach(color => {
    const check = Process.validateWorkload(withColor(color));
    if (!check.ok || check.processes[0].color !== color) throw new Error(`Valid color ${color} must be kept exactly`);
  });
  const badColors = {
    'attribute break-out': 'red"><img src=x onerror="window.__injected=1">',
    'style injection': '#4f97e8; background-image: url(x)',
    'named color': 'red',
    'three digits': '#abc',
    'eight digits': '#4f97e8ff',
    'missing #': '4f97e8',
    'non-hex digit': '#4f97eg',
    'rgb()': 'rgb(1,2,3)',
    'surrounding spaces': ' #4f97e8 ',
    'empty string': '',
    'number': 123456
  };
  Object.entries(badColors).forEach(([why, color]) => {
    const check = Process.validateWorkload(withColor(color));
    // Atomic: P2 is valid, but nothing at all is accepted
    if (check.ok || check.processes.length !== 0 || !check.errors.some(e => e.includes('six-digit hex color'))) {
      throw new Error(`Import with an invalid color (${why}) must be rejected as a whole with a color error`);
    }
  });
  const defaultColor = Process.validateWorkload([{ id: 'P1', arrivalTime: 0, burstTime: 2 }, { id: 'P2', arrivalTime: 1, burstTime: 3, color: null }]);
  if (!defaultColor.ok || defaultColor.processes[0].color !== Process.generateColor('P1') || defaultColor.processes[1].color !== Process.generateColor('P2')) {
    throw new Error('A missing or null color must use the default color generated from the ID');
  }
  // JSON exported by the app (Export JSON serializes the Process objects) imports unchanged
  const exported = JSON.parse(JSON.stringify(testProcesses.concat(new Process({ id: 'P4', arrivalTime: 3, burstTime: 2, color: '#ABCDEF' }))));
  const reimported = Process.validateWorkload(exported);
  if (!reimported.ok || reimported.processes.map(p => `${p.id}:${p.arrivalTime}:${p.burstTime}:${p.priority}:${p.color}`).join() !==
      exported.map(p => `${p.id}:${p.arrivalTime}:${p.burstTime}:${p.priority}:${p.color}`).join()) {
    throw new Error(`An exported workload must import unchanged: ${reimported.errors.join(' | ')}`);
  }
  console.log(`✓ Process Colors: ${goodColors.length} #RRGGBB colors kept; ${Object.keys(badColors).length} invalid colors rejected atomically; default color when missing; export round-trip`);

  console.log(`✓ Process IDs: ${Object.keys(badIds).length} invalid ID cases rejected (HTML, quotes, too long, spaces, case-insensitive duplicates); ${goodIds.length} valid IDs kept`);

  // Manual entry uses the same field rules (the table inputs call Process.validateField)
  const fieldCases = [
    ['burstTime', '1', true], ['burstTime', '100', true], ['burstTime', '0', false], ['burstTime', '101', false],
    ['burstTime', '2.5', false], ['burstTime', '', false], ['burstTime', '-3', false],
    ['arrivalTime', '0', true], ['arrivalTime', '100', true], ['arrivalTime', '-1', false], ['arrivalTime', '101', false]
  ];
  fieldCases.forEach(([field, value, ok]) => {
    const check = Process.validateField(field, value);
    if (check.ok !== ok || (ok && check.value !== Number(value)) || (!ok && !check.error)) {
      throw new Error(`${field} "${value}" should be ${ok ? 'accepted' : 'rejected with a message'}`);
    }
  });
  console.log(`✓ Workload Limits: ${Object.keys(rejected).length} invalid imports rejected; boundaries (burst 1/100, arrival 0/100, 50 processes) accepted; ${fieldCases.length} manual-entry cases`);

  console.log('\n>>> ALL ALGORITHM CORRECTNESS, ANOMALY DETECTION, BENCHMARK, RISK EXPLANATION & GAME TESTS PASSED SUCCESSFULLY! <<<');
}

runTests();
