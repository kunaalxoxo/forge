import { exec, spawn } from 'child_process';
import { colors } from '../ui/colors.js';
import { getConfig } from '../config.js';
import readline from 'readline/promises';

export async function bash_execute({ command, description }) {
  console.log(`${colors.tool('⚡ Shell:')} ${colors.bold(command)}`);
  if (description) console.log(`${colors.dim(description)}`);

  const config = getConfig();
  if (config.approveShell) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(colors.prompt('Run? (y/n) '));
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      return 'Command cancelled by user.';
    }
  }

  const isWin = process.platform === 'win32';
  const fullCommand = isWin ? `cmd /c ${command}` : command;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    
    // Using spawn to stream results
    const child = isWin 
      ? spawn('cmd', ['/c', command]) 
      : spawn('bash', ['-c', command]);

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    // 30s timeout
    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: 1, error: 'Timeout' });
    }, 30000);
  });
}
