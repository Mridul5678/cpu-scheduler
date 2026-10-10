/**
 * ganttChart.js
 * High-performance, responsive live animated Gantt Chart renderer.
 */

class GanttChartVisualizer {
  /**
   * @param {HTMLElement|string} container - Container element or selector
   */
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.timeline = [];
    this.totalTime = 0;
    this.currentTick = 0;
    this.isLiveMode = true;
  }

  /**
   * Renders the Gantt chart up to currentTick
   * @param {Object} simulationResult - Result from algorithm run
   * @param {number} currentTick - Current time tick in playback
   */
  renderLive(simulationResult, currentTick) {
    if (!this.container || !simulationResult) return;
    this.timeline = simulationResult.timeline || [];
    this.totalTime = Math.max(1, simulationResult.totalTime);
    this.currentTick = currentTick;

    // Filter or clip segments that have started at or before currentTick
    const visibleSegments = [];
    for (const seg of this.timeline) {
      if (seg.start >= currentTick) break;
      const clippedEnd = Math.min(seg.end, currentTick);
      if (clippedEnd > seg.start) {
        visibleSegments.push({
          ...seg,
          displayedEnd: clippedEnd,
          displayedDuration: clippedEnd - seg.start,
          isCurrent: seg.start <= currentTick && currentTick <= seg.end
        });
      }
    }

    this.drawChart(visibleSegments, this.totalTime, currentTick, true);
  }

  /**
   * Renders static completed Gantt chart
   */
  renderStatic(simulationResult) {
    if (!this.container || !simulationResult) return;
    this.timeline = simulationResult.timeline || [];
    this.totalTime = Math.max(1, simulationResult.totalTime);
    const visibleSegments = this.timeline.map(seg => ({
      ...seg,
      displayedEnd: seg.end,
      displayedDuration: seg.duration,
      isCurrent: false
    }));
    this.drawChart(visibleSegments, this.totalTime, this.totalTime, false);
  }

  /**
   * Internal drawing routine
   */
  drawChart(segments, totalTime, playheadTime, showPlayhead) {
    // Determine minimum width per time unit for comfortable readability
    const minUnitWidth = Math.max(28, Math.min(60, 900 / Math.max(totalTime, 1)));
    const chartWidth = Math.max(totalTime * minUnitWidth, 600);

    let html = `
      <div class="gantt-wrapper" style="overflow-x: auto; position: relative;">
        <div class="gantt-track" style="width: ${chartWidth}px; min-height: 80px; position: relative;">
    `;

    // Render timeline segments
    segments.forEach(seg => {
      const leftPercent = (seg.start / totalTime) * 100;
      const widthPercent = (seg.displayedDuration / totalTime) * 100;

      if (seg.type === 'PROCESS') {
        const isRunningNow = seg.isCurrent && showPlayhead;
        const pulseClass = isRunningNow ? 'gantt-pulse-running' : '';
        html += `
          <div class="gantt-block gantt-process ${pulseClass}"
               data-pid="${seg.processId}"
               data-start="${seg.start}"
               data-end="${seg.displayedEnd}"
               data-duration="${seg.displayedDuration}"
               style="left: ${leftPercent}%; width: ${widthPercent}%; background: ${seg.color || '#6366f1'};"
               title="${seg.processId}: [${seg.start} - ${seg.displayedEnd}] (${seg.displayedDuration} units)">
            <span class="gantt-label">${seg.processId}</span>
            <span class="gantt-duration">${seg.displayedDuration > 1 ? seg.displayedDuration : ''}</span>
          </div>
        `;
      } else if (seg.type === 'CONTEXT_SWITCH') {
        html += `
          <div class="gantt-block gantt-cs"
               style="left: ${leftPercent}%; width: ${widthPercent}%;"
               title="Context Switch: [${seg.start} - ${seg.displayedEnd}]">
            <span class="gantt-cs-stripes"></span>
            <span class="gantt-label-sm">CS</span>
          </div>
        `;
      } else if (seg.type === 'IDLE') {
        html += `
          <div class="gantt-block gantt-idle"
               style="left: ${leftPercent}%; width: ${widthPercent}%;"
               title="CPU Idle: [${seg.start} - ${seg.displayedEnd}]">
            <span class="gantt-idle-pattern"></span>
            <span class="gantt-label-sm">Idle</span>
          </div>
        `;
      }
    });

    // Playhead line
    if (showPlayhead) {
      const playheadLeft = (playheadTime / totalTime) * 100;
      html += `
        <div class="gantt-playhead" style="left: ${playheadLeft}%;">
          <div class="gantt-playhead-badge">${playheadTime}</div>
        </div>
      `;
    }

    html += `
        </div>
        <!-- Time Axis -->
        <div class="gantt-axis" style="width: ${chartWidth}px; position: relative;">
    `;

    // Markers on axis
    // If totalTime is large, step markers by 2, 5, or 10
    let step = 1;
    if (totalTime > 60) step = 10;
    else if (totalTime > 30) step = 5;
    else if (totalTime > 20) step = 2;

    for (let t = 0; t <= totalTime; t += step) {
      const leftPos = (t / totalTime) * 100;
      html += `
        <div class="gantt-tick-mark" style="left: ${leftPos}%;">
          <span class="gantt-tick-label">${t}</span>
        </div>
      `;
    }

    // Ensure final time marker is present if not aligned with step
    if (totalTime % step !== 0) {
      html += `
        <div class="gantt-tick-mark" style="left: 100%;">
          <span class="gantt-tick-label">${totalTime}</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GanttChartVisualizer;
}
