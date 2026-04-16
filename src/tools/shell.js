import { spawn } from 'child_process';
import readline from 'readline/promises';
import { getConfig } from '../config.js';

export async function bash_execute({ command, description = '' }) {
  const config = getConfig();
  if (config.approveShell) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`Run shell command? ${command}\n${description}\n[y/N]: `);
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') return { approved: false, stdout: '', stderr: 'Cancelled', exitCode: 130 };
  }

  const isWin = process.platform === 'win32';
  const child = isWin
    ? spawn('cmd', ['/c', command], { stdio: ['ignore', 'pipe', 'pipe'] })
    : spawn('bash', ['-lc', command], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
  child.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });

  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(124);
    }, 120000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

  return { approved: true, stdout, stderr, exitCode };
}
