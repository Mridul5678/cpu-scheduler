/**
 * tests/schedulers.test.js
 * Automated test script to verify correctness of all scheduling algorithms
 * and recommendation engine.
 */

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
  // Bursts [1, 3, 4] give q = 4, so a fallback to the default q = 2 would be visible.
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
  // (bursts [2, 3, 3, 24] -> q = round((24 + 3) / 2) = 14) is not the ranked q = 2, and
  // MLQ behaves differently at q = 14.
  const mlqAtSuggested = SchedulerEvaluator.evaluate(runMLQ(convoyWorkload, { timeQuantum: convoyReport.recommendedQuantum }));
  const mlqRanked = convoyReport.leaderboard.find(r => r.key === 'MLQ').metrics;
  if (convoyReport.recommendedQuantum !== 14 || mlqAtSuggested.avgWaitingTime === mlqRanked.avgWaitingTime) {
    throw new Error('Expected the suggested quantum (14) to differ from the ranked configuration in its MLQ result');
  }
  // With no quantum given, the suggestion itself is the ranked configuration
  const defaultReport = RecommendationEngine.benchmarkAll(convoyWorkload);
  if (defaultReport.config.timeQuantum !== defaultReport.recommendedQuantum) {
    throw new Error('Without a quantum option, the benchmark should rank with the suggested quantum');
  }
  console.log(`✓ Apply Consistency: all 9 leaderboard results reproduced from report.config (q = ${convoyReport.config.timeQuantum}); suggestion q* = ${convoyReport.recommendedQuantum} kept separate`);

  console.log('\n>>> ALL ALGORITHM CORRECTNESS, ANOMALY DETECTION, BENCHMARK, RISK EXPLANATION & GAME TESTS PASSED SUCCESSFULLY! <<<');
}

runTests();
