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
    // The track fills the available width; it only scrolls once each time unit
    // would be narrower than 18px, so labels stay readable on long schedules.
    const minChartWidth = Math.ceil(totalTime * 18);

    let html = `
      <div class="gantt-wrapper">
        <div class="gantt-track" style="min-width: ${minChartWidth}px;">
    `;

    html += segments.map(seg => GanttChartVisualizer.segmentHtml(seg, totalTime, seg.isCurrent && showPlayhead)).join('');

    // Playhead line (the current time is also shown in the playback dock)
    if (showPlayhead) {
      html += `<div class="gantt-playhead" style="left: ${(playheadTime / totalTime) * 100}%;"></div>`;
    }

    html += `
        </div>
        <div class="gantt-axis" style="min-width: ${minChartWidth}px;">
          ${GanttChartVisualizer.axisHtml(totalTime)}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * One timeline block positioned as a percentage of totalTime.
   * Duration is exposed through the tooltip and accessible label rather than as text.
   */
  static segmentHtml(seg, totalTime, isRunningNow = false) {
    const end = seg.displayedEnd !== undefined ? seg.displayedEnd : seg.end;
    const duration = end - seg.start;
    const style = `left: ${(seg.start / totalTime) * 100}%; width: ${(duration / totalTime) * 100}%;`;
    const units = `${duration} time unit${duration === 1 ? '' : 's'}`;

    if (seg.type === 'PROCESS') {
      const label = `${seg.processId}: ${seg.start} to ${end} (${units})`;
      return `
        <div class="gantt-block gantt-process ${isRunningNow ? 'gantt-pulse-running' : ''}"
             data-pid="${seg.processId}" data-start="${seg.start}" data-end="${end}" data-duration="${duration}"
             style="${style} background: ${seg.color || '#6366f1'};"
             title="${label}" aria-label="${label}">
          <span class="gantt-label">${seg.processId}</span>
        </div>`;
    }
    if (seg.type === 'CONTEXT_SWITCH') {
      const label = `Context switch: ${seg.start} to ${end} (${units})`;
      return `
        <div class="gantt-block gantt-cs" style="${style}" title="${label}" aria-label="${label}">
          <span class="gantt-label-sm">CS</span>
        </div>`;
    }
    if (seg.type === 'IDLE') {
      const label = `CPU idle: ${seg.start} to ${end} (${units})`;
      return `
        <div class="gantt-block gantt-idle" style="${style}" title="${label}" aria-label="${label}">
          <span class="gantt-label-sm">Idle</span>
        </div>`;
    }
    return '';
  }

  /**
   * Tick marks from 0 to totalTime, thinned out for long schedules.
   */
  static axisHtml(totalTime) {
    let step = 1;
    if (totalTime > 60) step = 10;
    else if (totalTime > 30) step = 5;
    else if (totalTime > 20) step = 2;

    const ticks = [];
    for (let t = 0; t <= totalTime; t += step) ticks.push(t);
    // Always end on totalTime; drop a step tick that would sit right next to it
    if (ticks[ticks.length - 1] !== totalTime) {
      if (totalTime - ticks[ticks.length - 1] < step / 2) ticks.pop();
      ticks.push(totalTime);
    }

    return ticks.map((t, i) => {
      const edge = i === 0 ? 'tick-start' : (i === ticks.length - 1 ? 'tick-end' : '');
      return `
        <div class="gantt-tick-mark ${edge}" style="left: ${(t / totalTime) * 100}%;">
          <span class="gantt-tick-label">${t}</span>
        </div>`;
    }).join('');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GanttChartVisualizer;
}
