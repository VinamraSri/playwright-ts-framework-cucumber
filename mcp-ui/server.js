const express = require('express');
const { exec } = require('child_process');
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

app.get('/api/tools', (req, res) => res.json({ tools }));

app.post('/api/run', (req, res) => {
  const { name, tag } = req.body || {};
  let command;

  switch (name) {
    case 'run_smoke_tests':
      command = 'npx cucumber-js --tags "@smoke"';
      break;
    case 'run_regression_tests':
      command = 'npx cucumber-js --tags "@regression"';
      break;
    case 'run_tests_by_tag':
      if (!tag) return res.status(400).json({ success: false, output: 'Missing tag parameter' });
      command = `npx cucumber-js --tags "${tag}"`;
      break;
    case 'run_all_tests':
      command = 'npx cucumber-js';
      break;
    default:
      return res.status(400).json({ success: false, output: `Unknown tool: ${name}` });
  }

  const child = exec(command, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    const output = `${stdout || ''}\n${stderr || ''}`.trim();
    if (err) {
      return res.json({ success: false, output: output || err.message });
    }
    return res.json({ success: true, output: output || 'No output' });
  });

  // stream partial output via server-sent events is possible but keep simple for now
});

const port = process.env.PORT || 3333;
app.listen(port, () => {
  console.log(`[MCP UI] Listening on http://localhost:${port}`);
});
