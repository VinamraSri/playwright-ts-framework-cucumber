async function fetchTools() {
  const res = await fetch('/api/tools');
  return res.json();
}

function setOutput(text) {
  const el = document.getElementById('output');
  el.textContent = text;
}

async function runTool(name, tag) {
  setOutput('Running...');
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tag }),
  });
  const data = await res.json();
  setOutput(data.output || (data.success ? 'Completed' : 'Failed'));
}

async function init() {
  const container = document.getElementById('tools');
  const data = await fetchTools();
  const tools = data.tools || [];

  tools.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.name;
    btn.addEventListener('click', () => runTool(t.name));
    const row = document.createElement('div');
    row.className = 'tool';
    const desc = document.createElement('span');
    desc.textContent = t.description;
    row.appendChild(btn);
    row.appendChild(desc);
    container.appendChild(row);
  });

  document.getElementById('runByTag').addEventListener('click', () => {
    const tag = document.getElementById('tag').value.trim();
    if (!tag) return setOutput('Please enter a tag');
    runTool('run_tests_by_tag', tag);
  });
}

init().catch(err => setOutput(String(err)));
