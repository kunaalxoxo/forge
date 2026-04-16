import readline from 'readline';
import { colors } from './ui/colors.js';
import { spinner } from './ui/spinner.js';
import { runAgent } from './agent.js';
import {
  getConfig,
  setConfig,
  getActiveModel,
  setActiveProvider,
  applyStudentMode
} from './config.js';
import { getProviderStatus, listProviders } from './providers/index.js';
import { readMemory, autoDream, startDaemon, stopDaemon, daemonStatus } from './memory/index.js';
import { saveSession, listSessions, loadSession, undoLast, getSessionStats } from './session/index.js';
import fs from 'fs/promises';

let conversationHistory = [];
let planMode = false;
let architectMode = false;
let addedFiles = [];

const HELP_TEXT = `
/help
/clear
/model [name]
/provider [name]
/provider status
/memory
/sleep
/plan
/architect
/add <file>
/daemon [start|stop]
/offline
/student
/session [list|load <id>|save]
/cost
/undo
`;

async function handleSlash(input, rl) {
  const [cmd, ...args] = input.trim().split(' ');

  switch (cmd) {
    case '/help':
      console.log(HELP_TEXT);
      return;
    case '/clear':
      conversationHistory = [];
      console.log(colors.success('History cleared.'));
      return;
    case '/model':
      if (!args[0]) {
        console.log(`Model: ${getActiveModel()}`);
      } else {
        const provider = getConfig().provider;
        setConfig(`providers.${provider}.model`, args[0]);
        console.log(colors.success(`Model updated: ${args[0]}`));
      }
      return;
    case '/provider':
      if (args[0] === 'status') {
        for (const row of getProviderStatus()) {
          console.log(`${row.name}${row.active ? ' (active)' : ''} - ${row.hasKey ? 'ready' : 'missing key'} - ${row.model}`);
        }
      } else if (args[0] && listProviders().includes(args[0])) {
        setActiveProvider(args[0]);
        console.log(colors.success(`Provider set: ${args[0]}`));
      } else {
        console.log(`Provider: ${getConfig().provider}`);
      }
      return;
    case '/memory': {
      const mem = await readMemory();
      mem.forEach((m) => console.log(`[${m.category}] ${m.content}`));
      return;
    }
    case '/sleep':
      spinner.start('autoDream...');
      await autoDream();
      spinner.succeed('Memory consolidated.');
      return;
    case '/plan':
      planMode = !planMode;
      console.log(colors.tool(`Plan mode ${planMode ? 'ON' : 'OFF'}`));
      return;
    case '/architect':
      architectMode = !architectMode;
      setConfig('architectMode', architectMode);
      console.log(colors.tool(`Architect mode ${architectMode ? 'ON' : 'OFF'}`));
      return;
    case '/add':
      if (!args[0]) {
        console.log(colors.error('Usage: /add <file>'));
        return;
      }
      addedFiles.push(args[0]);
      console.log(colors.success(`Added context file: ${args[0]}`));
      return;
    case '/daemon':
      if (args[0] === 'start') console.log(await startDaemon());
      else if (args[0] === 'stop') console.log(await stopDaemon());
      else console.log(await daemonStatus());
      return;
    case '/offline': {
      const next = !getConfig().offline;
      setConfig('offline', next);
      if (next) setActiveProvider('ollama');
      console.log(colors.tool(`Offline mode ${next ? 'ON' : 'OFF'}`));
      return;
    }
    case '/student': {
      const enabled = !getConfig().studentMode;
      applyStudentMode(enabled);
      console.log(colors.tool(`Student mode ${enabled ? 'ON' : 'OFF'}`));
      return;
    }
    case '/session':
      if (args[0] === 'load' && args[1]) {
        const session = await loadSession(args[1]);
        conversationHistory = session.messages || [];
        console.log(colors.success(`Loaded session ${args[1]}`));
      } else if (args[0] === 'save') {
        const id = await saveSession(conversationHistory);
        console.log(colors.success(`Saved session ${id}`));
      } else {
        const sessions = await listSessions();
        sessions.forEach((s) => console.log(`${s.id} | ${s.timestamp} | ${s.turns} turns`));
      }
      return;
    case '/cost': {
      const stats = getSessionStats(conversationHistory);
      console.log(`Turns: ${stats.turns}, Tool calls: ${stats.toolCalls}, Cost: $${stats.costUsd.toFixed(2)}`);
      return;
    }
    case '/undo': {
      const result = await undoLast(conversationHistory);
      conversationHistory = result.restored;
      console.log(colors.success(result.note));
      return;
    }
    default:
      console.log(colors.error(`Unknown command: ${cmd}`));
      return;
  }
}

export function startREPL({ planMode: initialPlan = false } = {}) {
  planMode = initialPlan;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const refreshPrompt = () => {
    const cfg = getConfig();
    const tag = [planMode ? 'PLAN' : '', architectMode ? 'ARCH' : '', cfg.studentMode ? 'STUDENT' : ''].filter(Boolean).join('|');
    rl.setPrompt(`${colors.prompt(`forge${tag ? `:${tag}` : ''} (${cfg.provider}) ❯ `)}`);
    rl.prompt();
  };

  console.log(colors.banner('\n⚒ Forge CLI\n'));
  console.log(colors.dim('Type /help for commands.\n'));
  refreshPrompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) return refreshPrompt();

    if (input.startsWith('/')) {
      await handleSlash(input, rl);
      return refreshPrompt();
    }

    let prompt = input;
    for (const file of addedFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        prompt += `\n\n[Added File: ${file}]\n${content}`;
      } catch {
        console.log(colors.error(`Failed to read added file: ${file}`));
      }
    }

    spinner.start('Thinking...');
    try {
      const stream = runAgent(prompt, conversationHistory, { planMode, architectMode });
      let textStarted = false;
      for await (const event of stream) {
        if (event.type === 'text') {
          if (!textStarted) {
            spinner.stop();
            textStarted = true;
          }
          process.stdout.write(event.content);
        } else if (event.type === 'tool') {
          spinner.stop();
          console.log(`\n${colors.tool('→')} ${event.name}`);
        } else if (event.type === 'git_commit') {
          console.log(`\n${colors.success('git')} ${event.message}`);
        } else if (event.type === 'validation') {
          console.log(`\n${colors.dim('validator results:')} ${JSON.stringify(event.result)}`);
        }
      }
      console.log('\n');
    } catch (error) {
      spinner.fail(error.message);
    } finally {
      spinner.stop();
    }

    refreshPrompt();
  });

  rl.on('close', () => {
    console.log(colors.success('\nbye'));
    process.exit(0);
  });
}
