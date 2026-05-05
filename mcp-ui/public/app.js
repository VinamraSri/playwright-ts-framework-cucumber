let executionHistory = [];
let currentRunning = null;
let lastMetrics = null;
const scenarioViewState = {
  filter: 'all',
  expanded: new Set(),
  manuallyChanged: new Set(),
  scenarios: [],
};

async function fetchTools() {
  const res = await fetch('/api/tools');
  return res.json();
}

function setOutput(text) {
  const el = document.getElementById('output');
  el.textContent = text;
  el.scrollTop = el.scrollHeight;
}

function appendOutput(text) {
  const el = document.getElementById('output');
  if (el.textContent === 'Dispatching GitHub Actions workflow...') {
    el.textContent = text;
  } else {
    el.textContent += text;
  }
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getScenarioKey(scenario, index) {
  return `${index}-${scenario.name || 'scenario'}`;
}

function normalizeScenarioStatus(status) {
  return status || 'pending';
}

function getStatusIcon(status) {
  switch(status) {
    case 'success': return '✓';
    case 'queued': return '⟳';
    case 'failed': return '✗';
    case 'running': return '⟳';
    default: return '○';
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateMetrics(metrics) {
  lastMetrics = metrics;

  // Update metric cards
  document.getElementById('passCount').textContent = metrics.passed;
  document.getElementById('failCount').textContent = metrics.failed;
  document.getElementById('skipCount').textContent = metrics.skipped;
  document.getElementById('confidence').textContent = metrics.confidence + '%';

  // Update confidence bar
  const confidenceFill = document.getElementById('confidenceFill');
  confidenceFill.style.width = metrics.confidence + '%';

  // Update color based on confidence
  if (metrics.confidence >= 80) {
    confidenceFill.style.background = 'linear-gradient(90deg, #10b981, #6366f1)';
  } else if (metrics.confidence >= 50) {
    confidenceFill.style.background = 'linear-gradient(90deg, #f59e0b, #6366f1)';
  } else {
    confidenceFill.style.background = 'linear-gradient(90deg, #ef4444, #6366f1)';
  }

  // Display scenarios
  displayScenarios(metrics.scenarios);
}

function resetProgress() {
  document.getElementById('progressSummary').textContent = 'Preparing test run';
  document.getElementById('progressFill').style.width = '0%';
  scenarioViewState.expanded.clear();
  scenarioViewState.manuallyChanged.clear();
}

function updateLiveProgress(progress) {
  if (!progress) return;

  const summary = document.getElementById('progressSummary');
  const fill = document.getElementById('progressFill');
  const totalSteps = progress.totalSteps || 0;
  const completedSteps = progress.completedSteps || 0;
  const percent = totalSteps === 0 ? 0 : progress.percent;

  summary.textContent = totalSteps === 0
    ? 'Discovering scenarios'
    : `${completedSteps}/${totalSteps} steps completed (${percent}%)`;
  fill.style.width = `${percent}%`;

  if (progress.failedSteps > 0) {
    fill.className = 'progress-fill failed';
  } else if (completedSteps > 0 && completedSteps === totalSteps) {
    fill.className = 'progress-fill complete';
  } else {
    fill.className = 'progress-fill';
  }

  displayScenarios(progress.scenarios);
}

function displayScenarios(scenarios) {
  const container = document.getElementById('scenariosContainer');
  const summary = document.getElementById('scenarioSummary');
  scenarioViewState.scenarios = scenarios || [];

  if (!scenarios || scenarios.length === 0) {
    container.innerHTML = '<p class="empty-state">No scenarios found</p>';
    if (summary) summary.textContent = 'No scenarios loaded';
    return;
  }

  const counts = scenarios.reduce((acc, scenario) => {
    const status = normalizeScenarioStatus(scenario.status);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const filteredScenarios = scenarios
    .map((scenario, index) => ({ scenario, index, key: getScenarioKey(scenario, index) }))
    .filter(({ scenario }) => {
      const status = normalizeScenarioStatus(scenario.status);
      return scenarioViewState.filter === 'all' || status === scenarioViewState.filter;
    });

  if (summary) {
    const visibleCount = filteredScenarios.length;
    const totalCount = scenarios.length;
    summary.textContent = `${visibleCount}/${totalCount} shown | ${counts.passed || 0} passed | ${counts.failed || 0} failed | ${counts.running || 0} running`;
  }

  if (filteredScenarios.length === 0) {
    container.innerHTML = '<p class="empty-state">No scenarios match this filter</p>';
    return;
  }

  container.innerHTML = filteredScenarios.map(({ scenario, index, key }) => {
    const status = normalizeScenarioStatus(scenario.status);
    const shouldAutoExpand = (status === 'running' || status === 'failed') && !scenarioViewState.manuallyChanged.has(key);
    const isExpanded = scenarioViewState.expanded.has(key) || shouldAutoExpand;
    const steps = Array.isArray(scenario.steps) ? scenario.steps : [];
    const stepCount = steps.length;
    const completedStepCount = steps.filter(step => ['passed', 'failed', 'skipped'].includes(step.status)).length;

    if (shouldAutoExpand) {
      scenarioViewState.expanded.add(key);
    }

    return `
    <article class="scenario-card ${escapeHtml(status)} ${isExpanded ? 'expanded' : ''}">
      <button class="scenario-row" type="button" data-scenario-key="${escapeHtml(key)}" aria-expanded="${isExpanded}">
        <span class="scenario-title-icon ${escapeHtml(status)}">${getScenarioIcon(status)}</span>
        <span class="scenario-title-text">${escapeHtml(scenario.name)}</span>
        <span class="scenario-step-count">${completedStepCount}/${stepCount} steps</span>
        <span class="scenario-status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>
        <span class="scenario-chevron" aria-hidden="true">${isExpanded ? '^' : 'v'}</span>
      </button>
      <div class="steps-list ${isExpanded ? '' : 'collapsed'}">
        ${stepCount > 0 ? steps.map((step, stepIndex) => `
          <div class="step-item ${escapeHtml(normalizeScenarioStatus(step.status))}">
            <span class="step-index">${stepIndex + 1}</span>
            <span class="step-type">${escapeHtml(step.type)}</span>
            <span class="step-text">${escapeHtml(step.text)}</span>
            <span class="step-status ${escapeHtml(normalizeScenarioStatus(step.status))}">${getStepIcon(step.status)}</span>
          </div>
        `).join('') : '<p class="empty-state compact">No steps extracted</p>'}
      </div>
    </article>
  `;
  }).join('');
}

function getScenarioIcon(status) {
  switch(status) {
    case 'passed': return '✓';
    case 'failed': return '✗';
    case 'running': return '⟳';
    case 'skipped': return '-';
    default: return '○';
  }
}

function getStepIcon(status) {
  switch(status) {
    case 'passed': return '✓';
    case 'failed': return '✗';
    case 'skipped': return '-';
    default: return '○';
  }
}

async function runToolStream(name, tag, onEvent) {
  const res = await fetch('/api/run-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tag }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ output: res.statusText }));
    throw new Error(error.output || error.message || 'Unable to start test run');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer));
  }
}

async function runTool(name, tag, cardElement) {
  if (currentRunning) {
    alert('A test is already running. Please wait for it to complete.');
    return;
  }

  currentRunning = name;
  const startTime = new Date();

  // Update UI
  setOutput('Dispatching GitHub Actions workflow...');
  resetProgress();
  if (cardElement) {
    cardElement.classList.add('running');
    const statusEl = cardElement.querySelector('.test-card-status');
    if (statusEl) {
      statusEl.textContent = '⟳ Running';
      statusEl.className = 'test-card-status running';
    }
  }

  try {
    let data = null;

    await runToolStream(name, tag, event => {
      if (event.type === 'meta' || event.type === 'progress') {
        updateLiveProgress(event.progress);
      }

      if (event.type === 'output') {
        appendOutput(event.text);
      }

      if (event.type === 'error') {
        throw new Error(event.message);
      }

      if (event.type === 'done') {
        data = event;
        updateLiveProgress(event.progress);
      }
    });

    if (!data) {
      throw new Error('Test run ended without a completion event');
    }

    // Update metrics if available
    if (data.metrics) {
      updateMetrics(data.metrics);
    }

    // Update status
    const status = data.success ? 'queued' : 'failed';

    if (cardElement) {
      cardElement.classList.remove('running');
      const statusEl = cardElement.querySelector('.test-card-status');
      if (statusEl) {
        statusEl.textContent = `${getStatusIcon(status)} ${status === 'queued' ? 'Queued' : 'Failed'}`;
        statusEl.className = `test-card-status ${status}`;
      }
    }

    // Add to history
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    const historyEntry = {
      name: name.replace(/_/g, ' ').replace(/run /i, '').toUpperCase(),
      status: status,
      time: formatTime(startTime),
      duration: `${duration}s`,
      tag: tag || '-'
    };

    if (lastMetrics) {
      historyEntry.passed = lastMetrics.passed;
      historyEntry.failed = lastMetrics.failed;
    }

    executionHistory.unshift(historyEntry);

    // Keep only last 10 items
    if (executionHistory.length > 10) {
      executionHistory.pop();
    }

    updateHistory();
    updateStats();

  } catch (err) {
    setOutput('Error: ' + String(err));
    if (cardElement) {
      cardElement.classList.remove('running');
      const statusEl = cardElement.querySelector('.test-card-status');
      if (statusEl) {
        statusEl.textContent = '✗ Error';
        statusEl.className = 'test-card-status failed';
      }
    }
  } finally {
    currentRunning = null;
  }
}

function updateHistory() {
  const historyList = document.getElementById('historyList');
  if (executionHistory.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No recent runs</p>';
    return;
  }

  historyList.innerHTML = executionHistory.map(run => `
    <div class="history-item ${run.status}">
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
          <span>${getStatusIcon(run.status)} ${run.name}</span>
          <span style="font-size: 11px; color: var(--text-secondary);">${run.duration}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary);">
          Tag: <strong>${run.tag}</strong> | ${run.time}
          ${run.passed !== undefined ? `| ✓ ${run.passed} | ✗ ${run.failed}` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  document.getElementById('totalRuns').textContent = executionHistory.length;

  const lastStatus = document.getElementById('lastStatus');
  if (executionHistory.length > 0) {
    const last = executionHistory[0];
    lastStatus.textContent = `${getStatusIcon(last.status)} ${last.status}`;
    lastStatus.style.color = last.status === 'queued' ? 'var(--primary)' : 'var(--danger)';
  } else {
    lastStatus.textContent = '-';
    lastStatus.style.color = 'var(--text-secondary)';
  }
}

async function init() {
  try {
    // Fetch and render tools as cards
    const container = document.getElementById('cardGrid');
    const data = await fetchTools();
    const tools = data.tools || [];

    container.innerHTML = tools.map(t => {
      const cardId = `card-${t.name}`;
      return `
        <div class="test-card" id="${cardId}" data-tool="${t.name}">
          <div class="test-card-title">🧪 ${t.name.replace(/_/g, ' ').toUpperCase()}</div>
          <div class="test-card-desc">${t.description}</div>
          <div class="test-card-status idle">○ Ready</div>
        </div>
      `;
    }).join('');

    // Add click listeners to cards
    tools.forEach(t => {
      const card = document.getElementById(`card-${t.name}`);
      if (card) {
        card.addEventListener('click', () => {
          runTool(t.name, null, card);
        });
      }
    });

    // Handle custom tag input
    document.getElementById('runByTag').addEventListener('click', () => {
      const tag = document.getElementById('tag').value.trim();
      if (!tag) {
        setOutput('Please enter a tag (e.g., @smoke)');
        return;
      }
      runTool('run_tests_by_tag', tag, null);
    });

    // Enter key on tag input
    document.getElementById('tag').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('runByTag').click();
      }
    });

    // Clear output button
    document.getElementById('clearOutput').addEventListener('click', () => {
      setOutput('');
    });

    // Download output button
    document.getElementById('downloadOutput').addEventListener('click', () => {
      const text = document.getElementById('output').textContent;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-output-${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    document.getElementById('scenarioFilters').addEventListener('click', event => {
      const filterButton = event.target.closest('[data-filter]');
      if (!filterButton) return;

      scenarioViewState.filter = filterButton.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach(button => {
        button.classList.toggle('active', button === filterButton);
      });
      displayScenarios(scenarioViewState.scenarios);
    });

    document.getElementById('expandScenarios').addEventListener('click', () => {
      scenarioViewState.scenarios.forEach((scenario, index) => {
        const key = getScenarioKey(scenario, index);
        scenarioViewState.expanded.add(key);
        scenarioViewState.manuallyChanged.add(key);
      });
      displayScenarios(scenarioViewState.scenarios);
    });

    document.getElementById('collapseScenarios').addEventListener('click', () => {
      scenarioViewState.scenarios.forEach((scenario, index) => {
        const key = getScenarioKey(scenario, index);
        scenarioViewState.expanded.delete(key);
        scenarioViewState.manuallyChanged.add(key);
      });
      displayScenarios(scenarioViewState.scenarios);
    });

    document.getElementById('scenariosContainer').addEventListener('click', event => {
      const row = event.target.closest('.scenario-row');
      if (!row) return;

      const key = row.dataset.scenarioKey;
      if (scenarioViewState.expanded.has(key)) {
        scenarioViewState.expanded.delete(key);
      } else {
        scenarioViewState.expanded.add(key);
      }
      scenarioViewState.manuallyChanged.add(key);
      displayScenarios(scenarioViewState.scenarios);
    });

    // Initial display
    setOutput('Welcome to Playwright Test Dashboard!\n\nSelect a test suite or enter a custom tag to trigger GitHub Actions.');
    updateStats();

  } catch (err) {
    setOutput('Error initializing dashboard: ' + String(err));
  }
}

init().catch(err => setOutput('Fatal error: ' + String(err)));
