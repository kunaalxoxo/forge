import { spawn } from 'child_process';

function run(command) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = isWin
      ? spawn('cmd', ['/c', command], { stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('bash', ['-lc', command], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ command, exitCode: code ?? 1, stdout, stderr }));
  });
}

async function hasScript(scriptName) {
  try {
    const pkg = JSON.parse(await (await import('fs/promises')).readFile('package.json', 'utf8'));
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
}

export async function run_validators() {
  const checks = [];
  if (await hasScript('lint')) checks.push(await run('npm run -s lint'));
  if (await hasScript('test')) checks.push(await run('npm run -s test'));
  return checks;
}
