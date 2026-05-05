const express = require('express');
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const tools = [
  { name: 'run_all_tests', description: 'Run all cucumber tests' },
  { name: 'run_smoke_tests', description: 'Run all @smoke tagged tests' },
  { name: 'run_regression_tests', description: 'Run all @regression tagged tests' },
  { name: 'run_tests_by_tag', description: 'Run tests by a specific tag' },
];

function getCommand(name, tag) {
  switch (name) {
    case 'run_smoke_tests':
      return { suite: 'smoke', tag: '' };
    case 'run_regression_tests':
      return { suite: 'regression', tag: '' };
    case 'run_tests_by_tag':
      if (!tag) return { error: 'Missing tag parameter' };
      return { suite: 'tag', tag };
    case 'run_all_tests':
      return { suite: 'all', tag: '' };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function getRepositoryFromRemote() {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
    return match ? `${match[1]}/${match[2]}` : '';
  } catch {
    return '';
  }
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'playwright.yml';
  const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_BRANCH || 'main';
  const repository = process.env.GITHUB_REPOSITORY || getRepositoryFromRemote();
  const [owner, repo] = repository.split('/');

  if (!token) {
    throw new Error('GITHUB_TOKEN or GH_TOKEN is required to trigger GitHub Actions.');
  }

  if (!owner || !repo) {
    throw new Error('Unable to determine GitHub repository. Set GITHUB_REPOSITORY=owner/repo.');
  }

  return { token, owner, repo, workflow, ref };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function githubHeaders(config, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'User-Agent': 'playwright-cucumber-mcp-ui',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

async function githubJson(config, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: githubHeaders(config, options.headers),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${details}`);
  }

  return response.json();
}

async function dispatchGitHubWorkflow(suite, tag = '') {
  const config = getGitHubConfig();
  const dispatchedAt = new Date();
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(config, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      ref: config.ref,
      inputs: { suite, tag },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub Actions dispatch failed (${response.status}): ${details}`);
  }

  return {
    message: [
      'GitHub Actions workflow dispatched.',
      `Repository: ${config.owner}/${config.repo}`,
      `Workflow: ${config.workflow}`,
      `Ref: ${config.ref}`,
      `Suite: ${suite}${tag ? ` (${tag})` : ''}`,
    ].join('\n'),
    runUrl: `https://github.com/${config.owner}/${config.repo}/actions/workflows/${config.workflow}`,
    config,
    dispatchedAt,
  };
}

async function findDispatchedRun(config, dispatchedAt) {
  const createdAfter = dispatchedAt.getTime() - 60_000;
  const branch = encodeURIComponent(config.ref);
  const runsUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/runs?event=workflow_dispatch&branch=${branch}&per_page=20`;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const data = await githubJson(config, runsUrl);
    const run = (data.workflow_runs || [])
      .filter(candidate => new Date(candidate.created_at).getTime() >= createdAfter)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (run) return run;
    await sleep(2500);
  }

  throw new Error('Workflow was dispatched, but no matching GitHub Actions run appeared within 60 seconds.');
}

async function waitForWorkflowRun(config, runId, send) {
  const runUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/actions/runs/${runId}`;
  let lastStatus = '';

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const run = await githubJson(config, runUrl);
    const statusText = run.status === 'completed'
      ? `completed (${run.conclusion || 'unknown'})`
      : run.status;

    if (statusText !== lastStatus) {
      send({ type: 'output', stream: 'stdout', text: `Workflow run #${run.run_number} is ${statusText}.\n` });
      lastStatus = statusText;
    }

    if (run.status === 'completed') return run;
    await sleep(5000);
  }

  throw new Error(`Workflow run ${runId} did not finish within 20 minutes.`);
}

function normalizeCucumberStatus(status) {
  if (status === 'passed') return 'passed';
  if (status === 'failed' || status === 'ambiguous' || status === 'undefined') return 'failed';
  if (status === 'skipped' || status === 'pending') return 'skipped';
  return 'pending';
}

function parseCucumberJsonReport(reportJson, duration = '0s') {
  const features = JSON.parse(reportJson);
  const scenarios = [];
  const metrics = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    scenarios,
    duration,
    confidence: 0,
  };

  for (const feature of features) {
    for (const element of feature.elements || []) {
      if (element.type && element.type !== 'scenario') continue;

      const steps = (element.steps || [])
        .filter(step => step.keyword && step.name)
        .map(step => {
          const status = normalizeCucumberStatus(step.result?.status);
          if (status === 'passed') metrics.passed += 1;
          if (status === 'failed') metrics.failed += 1;
          if (status === 'skipped') metrics.skipped += 1;
          if (['passed', 'failed', 'skipped'].includes(status)) metrics.total += 1;

          return {
            type: step.keyword.trim(),
            text: step.name,
            status,
          };
        });

      const scenarioStatus = steps.some(step => step.status === 'failed')
        ? 'failed'
        : steps.length > 0 && steps.every(step => step.status === 'passed')
          ? 'passed'
          : steps.some(step => step.status === 'skipped')
            ? 'skipped'
            : 'pending';

      scenarios.push({
        name: element.name || 'Unnamed scenario',
        steps,
        status: scenarioStatus,
      });
    }
  }

  metrics.confidence = metrics.total === 0
    ? 0
    : Math.round((metrics.passed / metrics.total) * 100);

  return metrics;
}

function progressFromMetrics(metrics) {
  const completedSteps = metrics.passed + metrics.failed + metrics.skipped;
  const totalSteps = metrics.total;

  return {
    completedSteps,
    totalSteps,
    failedSteps: metrics.failed,
    skippedSteps: metrics.skipped,
    percent: totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
    scenarios: metrics.scenarios,
  };
}

async function downloadCucumberMetrics(config, runId, duration) {
  const artifactsUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/actions/runs/${runId}/artifacts`;
  let artifact = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const artifacts = await githubJson(config, artifactsUrl);
    artifact = (artifacts.artifacts || []).find(item => item.name === 'cucumber-report');
    if (artifact) break;
    await sleep(2500);
  }

  if (!artifact) {
    throw new Error('Workflow completed, but the cucumber-report artifact was not found.');
  }

  const archiveResponse = await fetch(artifact.archive_download_url, {
    headers: githubHeaders(config),
  });

  if (!archiveResponse.ok) {
    const details = await archiveResponse.text();
    throw new Error(`Unable to download cucumber-report artifact (${archiveResponse.status}): ${details}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cucumber-report-'));
  const zipPath = path.join(tempDir, 'artifact.zip');

  try {
    fs.writeFileSync(zipPath, Buffer.from(await archiveResponse.arrayBuffer()));
    const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const jsonEntry = entries.find(entry => entry.endsWith('cucumber-report.json'));

    if (!jsonEntry) {
      throw new Error('cucumber-report artifact did not contain cucumber-report.json.');
    }

    const reportJson = execFileSync('unzip', ['-p', zipPath, jsonEntry], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    return parseCucumberJsonReport(reportJson, duration);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseTagExpression(tagExpression) {
  if (!tagExpression) return () => true;

  const tag = tagExpression.trim();
  if (!tag) return () => true;

  // Covers the simple dashboard use cases: @tag, not @tag, @a and @b, @a or @b.
  if (/^not\s+@\w[\w-]*$/i.test(tag)) {
    const excluded = tag.match(/@\w[\w-]*/)[0];
    return tags => !tags.includes(excluded);
  }

  if (/\s+and\s+/i.test(tag)) {
    const required = tag.match(/@\w[\w-]*/g) || [];
    return tags => required.every(requiredTag => tags.includes(requiredTag));
  }

  if (/\s+or\s+/i.test(tag)) {
    const allowed = tag.match(/@\w[\w-]*/g) || [];
    return tags => allowed.some(allowedTag => tags.includes(allowedTag));
  }

  const simpleTag = tag.match(/@\w[\w-]*/);
  return tags => simpleTag ? tags.includes(simpleTag[0]) : true;
}

function parseFeatureScenarios(tagExpression) {
  const featuresDir = path.join(__dirname, '..', 'features');
  const matchesTag = parseTagExpression(tagExpression);
  if (!fs.existsSync(featuresDir)) return [];

  return fs.readdirSync(featuresDir)
    .filter(file => file.endsWith('.feature'))
    .flatMap(file => {
      const content = fs.readFileSync(path.join(featuresDir, file), 'utf8');
      const lines = content.split(/\r?\n/);
      const scenarios = [];
      let pendingTags = [];
      let current = null;

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('@')) {
          pendingTags = trimmed.match(/@\w[\w-]*/g) || [];
          return;
        }

        const scenarioMatch = trimmed.match(/^Scenario(?: Outline)?:\s+(.+)$/);
        if (scenarioMatch) {
          if (current) scenarios.push(current);
          current = {
            name: scenarioMatch[1].trim(),
            tags: pendingTags,
            steps: [],
            status: 'pending',
          };
          pendingTags = [];
          return;
        }

        const stepMatch = trimmed.match(/^(Given|When|Then|And|But)\s+(.+)$/);
        if (stepMatch && current) {
          current.steps.push({
            type: stepMatch[1],
            text: stepMatch[2],
            status: 'pending',
          });
        }
      });

      if (current) scenarios.push(current);
      return scenarios;
    })
    .filter(scenario => matchesTag(scenario.tags));
}

function createProgressState(name, tag) {
  const tagExpression = name === 'run_tests_by_tag' ? tag
    : name === 'run_smoke_tests' ? '@smoke'
      : name === 'run_regression_tests' ? '@regression'
        : '';
  const scenarios = parseFeatureScenarios(tagExpression);
  const flatSteps = scenarios.flatMap((scenario, scenarioIndex) =>
    scenario.steps.map((step, stepIndex) => ({ scenarioIndex, stepIndex, step }))
  );

  return {
    scenarios,
    totalSteps: flatSteps.length,
    completedSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    flatSteps,
  };
}

function statusFromProgressChar(char) {
  if (char === '.') return 'passed';
  if (char === '-') return 'skipped';
  if (['F', 'U', 'P', 'A', '?'].includes(char)) return 'failed';
  return null;
}

function applyProgressOutput(state, chunk) {
  let changed = false;

  for (const char of chunk) {
    const status = statusFromProgressChar(char);
    if (!status || state.completedSteps >= state.totalSteps) continue;

    const current = state.flatSteps[state.completedSteps];
    current.step.status = status;
    state.completedSteps += 1;

    if (status === 'failed') state.failedSteps += 1;
    if (status === 'skipped') state.skippedSteps += 1;

    const scenario = state.scenarios[current.scenarioIndex];
    const scenarioSteps = scenario.steps;
    if (scenarioSteps.some(step => step.status === 'failed')) {
      scenario.status = 'failed';
    } else if (scenarioSteps.every(step => step.status === 'passed')) {
      scenario.status = 'passed';
    } else if (scenarioSteps.some(step => step.status === 'skipped')) {
      scenario.status = 'skipped';
    } else {
      scenario.status = 'running';
    }

    const nextStep = state.flatSteps[state.completedSteps];
    if (nextStep) {
      state.scenarios[nextStep.scenarioIndex].status = 'running';
    }

    changed = true;
  }

  return changed;
}

function toProgressPayload(state) {
  const percent = state.totalSteps === 0
    ? 0
    : Math.round((state.completedSteps / state.totalSteps) * 100);

  return {
    completedSteps: state.completedSteps,
    totalSteps: state.totalSteps,
    failedSteps: state.failedSteps,
    skippedSteps: state.skippedSteps,
    percent,
    scenarios: state.scenarios,
  };
}

// Parse cucumber output to extract metrics
function parseTestOutput(output) {
  const metrics = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    scenarios: [],
    duration: '0s',
  };

  // Prefer the Cucumber step summary so the metric cards match the progress bar.
  const stepsSummary = output.match(/\d+\s+steps?\s+\(([^)]+)\)/i);
  const countSource = stepsSummary ? stepsSummary[1] : output;
  const passMatch = countSource.match(/(\d+)\s+pass/i);
  const failMatch = countSource.match(/(\d+)\s+fail/i);
  const skipMatch = countSource.match(/(\d+)\s+skip/i);
  const durationMatch = output.match(/(\d+\.\d+)s/);

  if (passMatch) metrics.passed = parseInt(passMatch[1]);
  if (failMatch) metrics.failed = parseInt(failMatch[1]);
  if (skipMatch) metrics.skipped = parseInt(skipMatch[1]);
  if (durationMatch) metrics.duration = durationMatch[1] + 's';

  metrics.total = metrics.passed + metrics.failed + metrics.skipped;

  // Extract scenario details
  const scenarioPattern = /Scenario:\s+([^\n]+)/g;
  let match;
  const scenarios = [];

  while ((match = scenarioPattern.exec(output)) !== null) {
    const scenarioName = match[1];
    const scenarioStart = match.index;

    // Extract steps for this scenario (next few lines)
    const scenarioSection = output.substring(scenarioStart, scenarioStart + 500);
    const stepPattern = /(Given|When|Then|And|But)\s+([^\n]+)/g;
    const steps = [];
    let stepMatch;

    while ((stepMatch = stepPattern.exec(scenarioSection)) !== null) {
      steps.push({
        type: stepMatch[1],
        text: stepMatch[2],
        status: scenarioSection.includes('✓') ? 'passed' : 'pending'
      });
    }

    scenarios.push({
      name: scenarioName.trim(),
      steps: steps.length > 0 ? steps : []
    });
  }

  metrics.scenarios = scenarios.slice(0, 20); // Limit to first 20 scenarios

  // Calculate release confidence (0-100%)
  if (metrics.total === 0) {
    metrics.confidence = 0;
  } else {
    metrics.confidence = Math.round((metrics.passed / metrics.total) * 100);
  }

  return metrics;
}

app.get('/api/tools', (req, res) => res.json({ tools }));

app.post('/api/run', async (req, res) => {
  const { name, tag } = req.body || {};
  const commandConfig = getCommand(name, tag);
  if (commandConfig.error) {
    return res.status(400).json({ success: false, output: commandConfig.error });
  }

  try {
    const dispatch = await dispatchGitHubWorkflow(commandConfig.suite, commandConfig.tag);
    res.json({ success: true, output: `${dispatch.message}\nRuns: ${dispatch.runUrl}`, runUrl: dispatch.runUrl });
  } catch (error) {
    res.status(500).json({ success: false, output: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/run-stream', async (req, res) => {
  const { name, tag } = req.body || {};
  const commandConfig = getCommand(name, tag);
  if (commandConfig.error) {
    return res.status(400).json({ success: false, output: commandConfig.error });
  }

  const state = createProgressState(name, tag);
  const outputChunks = [];
  const send = event => res.write(`${JSON.stringify(event)}\n`);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  send({ type: 'meta', progress: toProgressPayload(state) });

  try {
    send({ type: 'output', stream: 'stdout', text: 'Dispatching GitHub Actions workflow...\n' });
    const dispatch = await dispatchGitHubWorkflow(commandConfig.suite, commandConfig.tag);
    const output = `${dispatch.message}\nRuns: ${dispatch.runUrl}`;
    outputChunks.push(output);
    send({ type: 'output', stream: 'stdout', text: `${output}\n` });

    send({ type: 'output', stream: 'stdout', text: 'Waiting for GitHub Actions run to appear...\n' });
    const run = await findDispatchedRun(dispatch.config, dispatch.dispatchedAt);
    send({
      type: 'output',
      stream: 'stdout',
      text: `Tracking run #${run.run_number}: ${run.html_url}\n`,
    });

    const completedRun = await waitForWorkflowRun(dispatch.config, run.id, send);
    const started = completedRun.run_started_at ? new Date(completedRun.run_started_at).getTime() : 0;
    const updated = completedRun.updated_at ? new Date(completedRun.updated_at).getTime() : 0;
    const duration = started && updated && updated >= started
      ? `${Math.round((updated - started) / 1000)}s`
      : 'completed';

    send({ type: 'output', stream: 'stdout', text: 'Downloading cucumber-report artifact...\n' });
    const metrics = await downloadCucumberMetrics(dispatch.config, completedRun.id, duration);
    const progress = progressFromMetrics(metrics);
    send({ type: 'progress', progress });

    send({
      type: 'done',
      success: completedRun.conclusion === 'success',
      output: [
        output,
        `Run: ${completedRun.html_url}`,
        `Conclusion: ${completedRun.conclusion || 'unknown'}`,
        `Passed: ${metrics.passed}`,
        `Failed: ${metrics.failed}`,
        `Skipped: ${metrics.skipped}`,
      ].join('\n'),
      runUrl: completedRun.html_url,
      metrics,
      progress,
    });
    res.end();
  } catch (error) {
    send({ type: 'error', message: error.message });
    res.end();
  }
});

const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`[MCP UI] Listening on http://localhost:${port}`);
});
