# ScheduleX Pro

**A browser-based CPU scheduling simulator for learning and comparing scheduling policies: animated Gantt charts, a lockstep scheduler race, a configurable multi-criteria recommendation, and a human-vs-scheduler game.**

ScheduleX Pro simulates nine classic CPU scheduling algorithm variants on a workload you define, animates each schedule one time unit at a time, and explains how the policies compare on that workload. It is plain HTML, CSS and JavaScript with no build step and no runtime dependencies.

ScheduleX Pro models scheduling behaviour on a single simulated CPU for teaching and experimentation. It is not an operating-system kernel and does not schedule real processes.

![Simulate view with the live Gantt chart](docs/screenshots/single-scheduler.png)

> The screenshots in this README were taken from an earlier version of the interface. The layout, colours and some labels have changed since (for example, "AI Recommendation" is now "Recommend", and times are now shown in time units).

---

## Contents

- [Why ScheduleX Pro](#why-schedulex-pro)
- [Features](#features)
- [Scheduling algorithms](#scheduling-algorithms)
- [Recommendation methodology](#recommendation-methodology)
- [Contribution and comparison](#contribution-and-comparison)
- [Metrics and formulas](#metrics-and-formulas)
- [Getting started](#getting-started)
- [Running the tests](#running-the-tests)
- [Architecture and project structure](#architecture-and-project-structure)
- [Known limitations](#known-limitations)
- [References](#references)

---

## Why ScheduleX Pro

Scheduling exercises usually stop at one Gantt chart and a table of averages for one algorithm. That leaves the questions students find hardest unanswered: why a policy behaves the way it does on a particular workload, what the trade-offs between waiting time, response time, fairness and switching cost look like, and which policy suits a given goal.

ScheduleX Pro brings those questions together in one tool. You can step through a single schedule, race several policies on the same clock, rank all nine against a chosen goal with the reasoning shown, and try scheduling the workload yourself.

---

## Features

### Simulate
- **Animated Gantt chart** that grows one time unit at a time, with a playhead, context-switch blocks and idle gaps.
- **CPU and ready-queue panels**, plus the contents of each queue level for MLQ and MLFQ.
- **Playback controls**: play/pause, step back, step forward, jump to end, reset, and speed from 0.25× to 3×.
- **Process timing table** (start, completion, turnaround, waiting and response time) with CSV export.
- **Scheduling diagnostics** for starvation, the convoy effect, context-switch thrashing and low utilisation, each with an explanation and a suggested mitigation (see [Diagnostics](#diagnostics)).
- **Kernel-style event log**, formatted like Linux `/dev/kmsg` output: arrivals, dispatches, preemptions, context switches, idle periods and process exits, with copy and clear.
- **About this algorithm** panel: selection rule, preemption type, main advantage, key pitfall and typical uses.

### Compare
- **Recommend** runs all nine variants on the same workload and settings and ranks them with a weighted multi-criteria score for a chosen goal (see [Recommendation methodology](#recommendation-methodology)). *Apply in Simulate* loads the winner with the exact settings it was ranked with, and *Race top 3* races the three best-ranked variants.
- **Race** runs any selection of the nine variants side by side on one shared clock and time scale, with step and speed controls.

### Learn and practise
- **Play** puts you in the dispatcher's seat: you choose which ready process runs in each time unit. Your schedule is then compared with SRTF on average waiting time, with an efficiency rating, a rank and achievements.
- **Learn** lists the metric formulas and the HRRN and time-quantum rules.
- **Tour** is a guided walkthrough with a short demo script.

### Workload
- Editable process table (arrival time, burst time, priority, queue level), four presets (Standard Mix, Convoy Pitfall, Priority Starvation, Interactive Bursts), a random 5-process generator, and JSON import/export.
- Validated input: at most 50 processes, with whole-number arrival times from 0 to 100 and burst times from 1 to 100. Invalid manual values are flagged and not applied. An invalid JSON file is rejected as a whole, with a list of the problems, including unsafe process IDs or colours.
- Configurable time quantum for Round Robin and MLQ (with a suggested value), context-switch cost, and priority order.

---

## Scheduling algorithms

| Algorithm | Preemptive | Selection rule | Notes |
|---|---|---|---|
| FCFS (First-Come, First-Served) | No | Earliest arrival | Baseline; convoy-effect detection |
| SJF (Shortest Job First) | No | Shortest burst | Burst times are assumed to be known in advance |
| SRTF (Shortest Remaining Time First) | Yes | Shortest remaining time, re-checked every time unit | Minimises average waiting time when burst times are known and switching is free |
| Round Robin | Yes | First in, first out, with a time slice of *q* | Configurable *q*; processes arriving when a slice ends queue ahead of the preempted process |
| Priority | No | Highest priority | Lower number = higher priority by default; the order is configurable |
| Priority | Yes | Highest priority, re-checked every time unit | No aging, so low-priority processes can starve |
| HRRN (Highest Response Ratio Next) | No | Highest response ratio $(W + S) / S$ | A waiting process's ratio keeps rising, so long-waiting processes are eventually selected |
| MLQ (Multilevel Queue) | Yes, between queues | Q0 (Round Robin, quantum *q*) always before Q1 (FCFS) | Each process stays in its assigned queue; Q1 can starve while Q0 is busy |
| MLFQ (Multilevel Feedback Queue) | Yes | Q0 (RR, *q* = 2), then Q1 (RR, *q* = 4), then Q2 (FCFS) | New processes start in Q0 and are demoted when they use up a quantum; aging promotes a process one level after it waits 12 time units (switch overhead excluded) |

Ties are broken by arrival time, then by process ID.

A **context switch** is counted whenever the CPU starts a different process from the one it last ran, including after an idle period. The first dispatch is not a switch. With a non-zero switch cost, each switch adds that many time units to the schedule.

---

## Recommendation methodology

The recommendation is a **weighted-sum multi-criteria decision method** with hand-chosen weights. It is not a trained or machine-learning model.

1. All nine variants run on the current workload with the same settings: the configured quantum *q* (used by Round Robin and MLQ), switch cost and priority order. MLFQ always uses *q* = 2 and 4.
2. For every run that finished, five criteria are min–max normalised across the finished runs, so the best value on this workload scores 1 and the worst scores 0 (if all runs tie, each scores 1). CPU utilisation is used directly as a fraction (utilisation ÷ 100).
3. The normalised values are combined with the weights of the selected goal. The engine subtracts 0.08 for each process flagged as starved, limits the result to the range 0–1, and reports it out of 100.
4. A run that did not finish within the 10,000-step safety limit is not scored and is listed after every finished run, so it can never be recommended. If no run finishes, no recommendation is made.

| Criterion | Better when | Balanced desktop | Low latency / interactive | Maximum fairness | High-throughput batch |
|---|---|---|---|---|---|
| Average waiting time | Lower | 0.30 | 0.35 | 0.15 | 0.20 |
| Average turnaround time | Lower | 0.20 | 0.15 | 0.15 | 0.25 |
| Average response time | Lower | 0.20 | 0.35 | 0.10 | 0.10 |
| Jain's fairness index | Higher | 0.15 | 0.05 | 0.45 | 0.05 |
| CPU utilisation | Higher | 0.05 | 0.05 | 0.05 | 0.25 |
| Context-switch count | Lower | 0.10 | 0.05 | 0.10 | 0.15 |

The verdict card shows the winner's margin over the runner-up, its average waiting time compared with FCFS, its own metrics and diagnostics, and its normalised standing on each criterion. Runs that did not finish are named.

![Recommendation leaderboard (earlier interface)](docs/screenshots/recommendation-engine.png)

**Time-quantum suggestion.** The suggested Round Robin quantum *q\** is the 80th percentile of the burst times using the nearest-rank method: sort the burst times and take the one at position ⌈0.8 × n⌉, so at least 80% of CPU bursts finish within one quantum. For example, bursts `[1, 2, 3, 4, 100]` give *q\** = 4. The suggestion is shown separately; the ranking uses the quantum in the settings, which is also what *Apply* restores.

**Limitations of the method**
- The weights are a teaching heuristic. They have not been tuned or validated against real systems.
- Scores are relative to the nine candidates on one workload, so they cannot be compared across workloads.
- Throughput is not a separate criterion. Convoy and thrashing diagnostics are reported but do not change the score; only starvation does.

---

## Contribution and comparison

**Contribution statement.** ScheduleX Pro's contribution is an *integrated* learning environment rather than any single new capability. In one dependency-free browser application it combines:
- workload-based recommendations across nine algorithm variants, with configurable goals, a transparent score breakdown and diagnostics;
- a lockstep race of any selection of those variants;
- a human-vs-scheduler game benchmarked against SRTF;
- process-state visualisation and a kernel-style event log.

Other simulators already offer several scheduling algorithms, interactive Gantt charts, performance metrics, side-by-side comparisons, context-switch costs and, in one case, an algorithm recommendation. ScheduleX Pro does not claim that any of these individual features is unique, nor that the project is a research contribution. Its differentiation is the combination above, which we did not find together in the projects reviewed below.

**Limited public-feature comparison.** The table compares publicly documented features only (project pages and READMEs, reviewed October 2026). It is not a comprehensive or scientific novelty study. "Not established" means the feature was not found in the reviewed documentation, not that it is absent.

| Capability | [ABC Tools simulator][abc] | [Deepanshu Mehta's visualizer][dm] | [Arpit817's simulator][arpit] | ScheduleX Pro |
|---|---|---|---|---|
| Algorithms documented | FCFS, SJF, SRTF, RR, Priority (P/NP), HRRN, MLFQ | FCFS, SJF, SRTF, RR, Priority (P/NP, with aging), HRRN, MLFQ | FCFS, SJF, SRTF, RR, Priority (P/NP) | FCFS, SJF, SRTF, RR, Priority (P/NP), HRRN, MLQ, MLFQ |
| Animated or interactive Gantt chart | Yes (step-through) | Yes (zoom and pan timeline) | Yes (animated) | Yes (tick-by-tick playback) |
| Context-switch cost | Yes | Overhead analysis documented | Not established | Yes (configurable) |
| Side-by-side algorithm comparison | Yes | Yes | Yes (comparison chart) | Yes (leaderboard and race) |
| Lockstep race on a shared clock | Not established | Not established | Not established | Yes |
| Best-algorithm recommendation | Not established | Not established | Yes ("Smart Algorithm Suggestion") | Yes |
| Configurable recommendation goals | Not established | Not established | Not established | Yes (four goals) |
| Time-quantum suggestion | Not established | Not established | Not established | Yes |
| Fairness metric (Jain's index) | Not established | Not established | Not established | Yes |
| Ready queue or process-state view | Ready queue | Ready/I/O queues and process states | Not established | CPU, ready queue and MLQ/MLFQ levels |
| Event or execution log | Not established | Not established | Yes | Yes (kernel-style) |
| Human-vs-scheduler game | Not established | Not established | Not established | Yes |
| Starvation, convoy and thrashing diagnostics | Not established | Not established | Not established | Yes |
| Import/export | Paste input | JSON and PDF export | CSV and PDF export | JSON import/export, CSV export |

Where the reviewed projects go further: Deepanshu Mehta's visualizer documents an I/O queue, the full process state machine and priority aging. Both GitHub projects document PDF export. The ABC Tools simulator accepts problems pasted straight from a textbook.

![Race view (earlier interface)](docs/screenshots/multi-race.png)

[abc]: https://abc.tools/sim/cpu-scheduling/
[dm]: https://github.com/Deepanshu-Mehta/CPU_Scheduling_Visualizer
[arpit]: https://github.com/Arpit817/CPU-Scheduler-Simulator

---

## Metrics and formulas

All times are abstract **scheduling time units** (ticks), not milliseconds. The kernel-style log prints Linux-like `ms` labels for flavour only. *Total time* is the elapsed time from 0 until the last process finishes, including idle gaps and switch overhead.

| Metric | Formula |
|---|---|
| Turnaround time | $\text{TAT} = \text{Completion} - \text{Arrival}$ |
| Waiting time | $\text{WT} = \text{TAT} - \text{Burst}$ |
| Response time | $\text{RT} = \text{First CPU run} - \text{Arrival}$ |
| CPU utilisation | $\dfrac{\text{Process execution time}}{\text{Total time}} \times 100\%$ (useful work only) |
| Switch overhead | $\dfrac{\text{Context switches} \times \text{switch cost}}{\text{Total time}} \times 100\%$ |
| Idle | $\dfrac{\text{Idle time}}{\text{Total time}} \times 100\%$; utilisation + overhead + idle = 100% |
| Throughput | $\dfrac{N}{\text{Total time}}$ processes per time unit |
| HRRN response ratio | $R = \dfrac{W + S}{S} = 1 + \dfrac{W}{S}$, where $W$ is the time spent waiting so far and $S$ is the burst time |

**Jain's fairness index**, computed on normalised turnaround penalties $x_i = \text{TAT}_i / \text{BT}_i$:

$$J(x) = \frac{\left(\sum_{i=1}^{n} x_i\right)^2}{n \sum_{i=1}^{n} x_i^2}, \quad \frac{1}{n} \le J \le 1$$

Averages, throughput and fairness are only reported for schedules in which every process finished. A run stopped by the safety limit shows them as unavailable and marks the unfinished processes.

### Diagnostics

| Diagnostic | Flagged when | Checked for |
|---|---|---|
| Starvation (high) | A process waits at least max(30, half the total burst time) **and** either at least 3× the average wait or at least 5× its own burst | SJF, SRTF, both Priority variants, MLQ |
| Convoy effect (high) | At least 3 processes; the first to arrive has a burst ≥ 20 and ≥ 4× the average of the others; at least 2 short processes wait ≥ 60% of its burst | FCFS, Priority (non-preemptive) |
| Context-switch thrashing (high) | Switch cost > 0 and switch overhead ≥ 20% of total time | All |
| Low utilisation (moderate) | Utilisation < 40% and idle time ≥ 30% of total time | All |
| Incomplete schedule (high) | The run stopped at the 10,000-step safety limit | All |

These are heuristic thresholds for teaching, not formal guarantees.

---

## Getting started

No installation is needed.

**Option 1: open the file.** Double-click `index.html`, or open it in any modern browser.

**Option 2: run a local server** (needs [Node.js](https://nodejs.org)):

```bash
npm start
```

This serves the project at <http://localhost:8080> and opens it in your browser. `npm start` runs [`http-server`](https://www.npmjs.com/package/http-server) through `npx`, which downloads it on first use. The project itself has no npm dependencies.

---

## Running the tests

The test suite (35 checks, Node.js 14 or later) covers:
- each algorithm's results on reference workloads;
- context-switch counting;
- the time accounting identity (execution + overhead + idle = total);
- the quantum rule;
- convoy, starvation and thrashing detection;
- the recommendation engine and *Apply* consistency;
- Race, the game engine and the kernel log;
- empty workloads and incomplete runs;
- workload validation, including unsafe IDs and colours.

```bash
npm test
# or
node tests/schedulers.test.js
```

---

## Architecture and project structure

**Tech stack:** HTML5, CSS3 and vanilla JavaScript (ES6+), with no frameworks, build step or runtime dependencies. Node.js is used only for the test suite and the optional local server. The fonts load from Google Fonts; without a connection, the browser falls back to system fonts.

**Data flow:**
1. A runner in `algorithms/` turns a workload into a result: a timeline of process, context-switch and idle blocks, per-tick snapshots, and per-process times.
2. `evaluator.js` turns that result into metrics and diagnostics.
3. The views (`simulator.js` for playback, the visualizers, `recommendationEngine.js`, `kernelSyslog.js`) read those results; `app.js` wires them to the page.

```
.
├── index.html                      # App shell and all UI markup
├── package.json                    # npm start / npm test scripts (no dependencies)
├── src/
│   ├── css/
│   │   ├── style.css               # Design tokens, layout, header, forms
│   │   ├── components.css          # Metrics, tables, recommendation, race, modals, log, toasts
│   │   ├── gantt.css               # Gantt chart tracks, blocks and axis
│   │   └── game.css                # Play view
│   └── js/
│       ├── models/
│       │   └── Process.js          # Process model, ID generation and workload validation
│       ├── algorithms/
│       │   ├── fcfs.js             # First-Come, First-Served
│       │   ├── sjf.js              # Shortest Job First (non-preemptive)
│       │   ├── srtf.js             # Shortest Remaining Time First (preemptive)
│       │   ├── roundRobin.js       # Round Robin with quantum and switch overhead
│       │   ├── priority.js         # Priority (non-preemptive and preemptive)
│       │   ├── hrrn.js             # Highest Response Ratio Next
│       │   ├── mlq.js              # Multilevel Queue
│       │   └── mlfq.js             # Multilevel Feedback Queue with aging
│       ├── engine/
│       │   ├── simulator.js        # Step-by-step playback controller
│       │   ├── evaluator.js        # Metrics, time breakdown, fairness and diagnostics
│       │   ├── recommendationEngine.js  # Multi-criteria scoring and quantum suggestion
│       │   ├── kernelSyslog.js     # Kernel-style event log builder
│       │   └── gameEngine.js       # Play (human vs scheduler) state machine
│       ├── visualizers/
│       │   ├── ganttChart.js       # Gantt chart renderer
│       │   ├── stateVisualizer.js  # CPU, ready-queue and multilevel-queue panels
│       │   └── multiRace.js        # Race lanes on a shared clock
│       └── app.js                  # UI controller: events, presets, validation, views
├── tests/
│   └── schedulers.test.js          # Automated verification suite
└── docs/
    └── screenshots/                # Images used in this README
```

**How the scripts fit together:** `index.html` loads the files in dependency order with plain `<script>` tags: model, then algorithms, engine, visualizers, and finally `app.js`. Each module also exports itself through `module.exports` when it runs in Node, so the same files work in the browser and in the test suite.

---

## Known limitations

- **Simplified model:** a single CPU with CPU bursts only (no I/O or blocking), and burst times known in advance. This matches textbook exercises rather than a real operating system.
- **Fixed parameters:** MLFQ's quanta (2 and 4) and aging threshold (12 time units of waiting, excluding switch overhead) are fixed. The context-switch cost is a whole number of time units per switch.
- **Heuristic recommendation and diagnostics:** the weights and thresholds are reasonable for teaching, not empirically validated (see [Limitations of the method](#recommendation-methodology)).
- **Workload size:** limited to 50 processes and burst and arrival times of at most 100. Each run also has a 10,000-step safety limit; workloads within the input limits always finish well inside it. Runs that hit it (possible only when calling the code directly) are marked incomplete and never recommended.
- **Validation scope:** priority values are not range-checked.
- **Units:** the kernel-style log uses Linux-like `ms` labels, although all times are abstract time units.
- **Screenshots:** they show an earlier version of the interface.

---

## References

- A. Silberschatz, P. B. Galvin and G. Gagne, *Operating System Concepts*, 10th ed., Wiley, 2018. CPU scheduling algorithms, Round Robin quantum selection and multilevel feedback queues.
- R. Jain, D. Chiu and W. Hawe, *A Quantitative Measure of Fairness and Discrimination for Resource Allocation in Shared Computer Systems*, DEC Research Report TR-301, 1984. Jain's fairness index.
- Comparison projects (public documentation reviewed October 2026): [ABC Tools CPU Scheduling Simulator][abc], [Deepanshu Mehta's CPU Scheduling Visualizer][dm], [Arpit817's CPU Scheduler Simulator][arpit].
