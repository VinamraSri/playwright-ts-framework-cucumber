const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
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

async function dispatchGitHubWorkflow(suite, tag = '') {
  const config = getGitHubConfig();
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'playwright-cucumber-mcp-ui',
      'X-GitHub-Api-Version': '2022-11-28',
    },
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
  };
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
    send({
      type: 'done',
      success: true,
      output,
      runUrl: dispatch.runUrl,
      metrics: {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        scenarios: state.scenarios,
        duration: 'queued',
        confidence: 0,
      },
      progress: toProgressPayload(state),
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
