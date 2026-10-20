/**
 * stateVisualizer.js
 * Visualizes dynamic CPU Core execution, Ready Queue pipeline, and process states.
 */

class StateVisualizer {
  constructor(options = {}) {
    this.cpuElement = document.querySelector(options.cpuSelector || '#cpuCoreDisplay');
    this.readyQueueElement = document.querySelector(options.readyQueueSelector || '#readyQueueDisplay');
    this.processTableBody = document.querySelector(options.processTableBodySelector || '#processTableBody');
    this.multilevelContainer = document.querySelector(options.multilevelSelector || '#multilevelQueuesDisplay');
  }

  /**
   * Updates visualizer state at current tick
   * @param {Object} tickData - Tick snapshot
   * @param {Array<Process>} originalProcesses - Original process definitions
   */
  update(tickData, originalProcesses = []) {
    if (!tickData) return;

    this.updateCPU(tickData, originalProcesses);
    this.updateReadyQueue(tickData, originalProcesses);
    this.updateProcessTable(tickData);
  }

  updateCPU(tickData, originalProcesses) {
    if (!this.cpuElement) return;

    const { runningProcessId, isContextSwitch, activeQueueLevel } = tickData;

    if (isContextSwitch) {
      this.cpuElement.innerHTML = `
        <div class="cpu-card cpu-context-switch">
          <span class="cpu-state-dot" aria-hidden="true"></span>
          <div class="cpu-info">
            <span class="cpu-proc-name"><strong class="text-danger">Context switch</strong> · saving and loading PCBs</span>
          </div>
        </div>
      `;
      return;
    }

    if (!runningProcessId) {
      this.cpuElement.innerHTML = `
        <div class="cpu-card cpu-idle">
          <span class="cpu-state-dot" aria-hidden="true"></span>
          <div class="cpu-info">
            <span class="cpu-proc-name"><strong>Idle</strong> · no process is running</span>
          </div>
        </div>
      `;
      return;
    }

    const procSnap = tickData.processesSnapshot.find(p => p.id === runningProcessId);
    const origProc = originalProcesses.find(p => p.id === runningProcessId) || {};
    const color = origProc.color || 'var(--chart-process-fallback)';
    const totalBurst = origProc.burstTime || 1;
    const remaining = procSnap ? procSnap.remainingTime : 0;
    const progressPercent = Math.min(100, Math.max(0, ((totalBurst - remaining) / totalBurst) * 100));

    this.cpuElement.innerHTML = `
      <div class="cpu-card cpu-active">
        <div class="cpu-chip-badge" style="background: ${color};">
          ${runningProcessId}
        </div>
        <div class="cpu-info">
          <div class="cpu-header-row">
            <span class="cpu-status-badge badge-success">Running</span>
            <span class="cpu-queue-tag">Queue Q${activeQueueLevel}</span>
          </div>
          <div class="cpu-progress-wrapper">
            <div class="cpu-progress-bar" style="width: ${progressPercent}%; background: ${color};"></div>
          </div>
          <div class="cpu-meta-row">
            <span>Remaining: <strong>${remaining}</strong> / ${totalBurst}</span>
            <span>Priority: <strong>${origProc.priority || 1}</strong></span>
          </div>
        </div>
      </div>
    `;
  }

  updateReadyQueue(tickData, originalProcesses) {
    if (!this.readyQueueElement) return;

    // Check if MLQ or MLFQ
    if (tickData.queue0 !== undefined && this.multilevelContainer) {
      this.multilevelContainer.style.display = 'block';
      this.renderMultiLevelQueues(tickData, originalProcesses);
    } else if (this.multilevelContainer) {
      this.multilevelContainer.style.display = 'none';
    }

    const queue = tickData.readyQueue || [];
    if (queue.length === 0) {
      this.readyQueueElement.innerHTML = `<div class="ready-queue-empty">Empty</div>`;
      return;
    }

    let html = '<div class="queue-list">';
    queue.forEach((pid, index) => {
      const orig = originalProcesses.find(p => p.id === pid) || {};
      const snap = tickData.processesSnapshot.find(p => p.id === pid) || {};
      const color = orig.color || 'var(--chart-process-fallback)';

      html += `
        <div class="queue-item" style="border-left: 4px solid ${color};">
          <div class="queue-item-header">
            <span class="queue-item-id" style="color: ${color}; font-weight: 700;">${pid}</span>
            <span class="queue-pos-badge">#${index + 1}</span>
          </div>
          <div class="queue-item-body">
            <span>Rem: <strong>${snap.remainingTime !== undefined ? snap.remainingTime : orig.burstTime}</strong></span>
            <span>Pri: <strong>${orig.priority || 1}</strong></span>
          </div>
        </div>
      `;
      if (index < queue.length - 1) {
        html += `<span class="queue-arrow">➔</span>`;
      }
    });
    html += '</div>';

    this.readyQueueElement.innerHTML = html;
  }

  renderMultiLevelQueues(tickData, originalProcesses) {
    if (!this.multilevelContainer) return;
    const q0 = tickData.queue0 || [];
    const q1 = tickData.queue1 || [];
    const q2 = tickData.queue2 || [];

    const renderQueueRow = (title, items, badge) => {
      let itemsHtml = items.length === 0 ? '<span class="text-muted text-sm">Empty</span>' : '';
      items.forEach(pid => {
        const orig = originalProcesses.find(p => p.id === pid) || {};
        itemsHtml += `<span class="badge badge-pill" style="background: ${orig.color || 'var(--chart-process-fallback)'}; color: var(--chart-label); margin-right: 6px;">${pid}</span>`;
      });
      return `
        <div class="ml-queue-row">
          <div class="ml-queue-label">
            <strong>${title}</strong> <small class="text-muted">(${badge})</small>
          </div>
          <div class="ml-queue-items">${itemsHtml}</div>
        </div>
      `;
    };

    let html = '';
    html += renderQueueRow('Queue 0 (Highest)', q0, 'RR');
    html += renderQueueRow('Queue 1 (Medium)', q1, tickData.queue2 !== undefined ? 'RR' : 'FCFS');
    if (tickData.queue2 !== undefined) {
      html += renderQueueRow('Queue 2 (Lowest)', q2, 'FCFS');
    }

    this.multilevelContainer.innerHTML = html;
  }

  updateProcessTable(tickData) {
    if (!this.processTableBody) return;
    const snapshots = tickData.processesSnapshot || [];

    snapshots.forEach(snap => {
      const row = this.processTableBody.querySelector(`tr[data-pid="${snap.id}"]`);
      if (row) {
        // Update remaining time cell
        const remCell = row.querySelector('.col-rem-time');
        if (remCell) remCell.textContent = snap.remainingTime;

        // Update state cell
        const stateCell = row.querySelector('.col-state');
        if (stateCell) {
          let badgeClass = 'badge-secondary';
          let label = snap.state;
          if (tickData.runningProcessId === snap.id) {
            badgeClass = 'badge-success animate-pulse';
            label = 'RUNNING';
          } else if (snap.state === 'READY' || (tickData.readyQueue && tickData.readyQueue.includes(snap.id))) {
            badgeClass = 'badge-warning';
            label = 'READY';
          } else if (snap.remainingTime === 0) {
            badgeClass = 'badge-info';
            label = 'COMPLETED';
          } else {
            badgeClass = 'badge-secondary';
            label = 'WAITING';
          }
          stateCell.innerHTML = `<span class="badge ${badgeClass}">${label}</span>`;
        }
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateVisualizer;
}
