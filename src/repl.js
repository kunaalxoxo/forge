import readline from 'readline';
import { colors } from './ui/colors.js';
import { spinner } from './ui/spinner.js';
import { runAgent } from './agent.js';
import { getConfig, setConfig, setApiKey, getActiveModel } from './config.js';
import { listProviders, setActiveProvider, callProvider } from './providers/index.js';
import { readMemory, consolidate } from './memory/index.js';
import { saveSession, listSessions, loadSession, getSessionStats } from './session/index.js';

let conversationHistory = [];
let planMode = false;

const HELP_TEXT = `
  ${colors.bold('Available Commands:')}
  /help           - Show this help
  /clear          - Reset conversation history
  /model [name]   - Show or set current model
  /provider [name]- Show or switch provider
  /memory         - Display MEMORY.md
  /memory clear   - Wipe MEMORY.md
  /plan           - Toggle plan mode
  /session        - List recent sessions
  /session load   - Restore a session
  /cost           - Show session stats
  /sleep          - Consolidate memory (autoDream)
  /exit           - Exit Forge
`;

async function handleSlashCommand(command, rl) {
  const [name, ...args] = command.split(' ');
  
  switch (name) {
    case '/help':
      console.log(HELP_TEXT);
      break;
    case '/clear':
      conversationHistory = [];
      console.log(colors.success('Conversation reset.'));
      break;
    case '/model':
      if (args[0]) {
        const provider = getConfig().provider;
        setConfig(`providers.${provider}.model`, args[0]);
        console.log(colors.success(`Model set to ${args[0]}`));
      } else {
        console.log(`Current model: ${getActiveModel()}`);
      }
      break;
    case '/provider':
      if (args[0]) {
        if (listProviders().includes(args[0])) {
          setActiveProvider(args[0]);
          console.log(colors.success(`Active provider: ${args[0]}`));
        } else {
          console.log(colors.error(`Invalid provider. Choose from: ${listProviders().join(', ')}`));
        }
      } else {
        console.log(`Current provider: ${getConfig().provider}`);
      }
      break;
    case '/memory':
      if (args[0] === 'clear') {
        // Implementation for clearing memory file
      } else {
        const memory = await readMemory();
        console.log(colors.memory('\n[MEMORY]'));
        memory.forEach(m => console.log(`[${m.category}] ${m.content}`));
      }
      break;
    case '/plan':
      planMode = !planMode;
      console.log(colors.tool(`Plan mode: ${planMode ? 'ON' : 'OFF'}`));
      break;
    case '/session':
      if (args[0] === 'load') {
        const id = args[1];
        if (id) {
          const session = await loadSession(id);
          conversationHistory = session.messages;
          console.log(colors.success(`Session ${id} loaded.`));
        } else {
          console.log(colors.error('Please specify session ID.'));
        }
      } else {
        const sessions = await listSessions();
        sessions.forEach(s => console.log(`- ${s.id} (${s.messagesCount} msgs)`));
      }
      break;
    case '/cost':
      const stats = getSessionStats(conversationHistory);
      console.log(colors.dim(`Turns: ${stats.turns}, Tool Calls: ${stats.toolCalls}`));
      break;
    case '/sleep':
      spinner.start('Consolidating memory...');
      await consolidate(callProvider);
      spinner.succeed('Memory consolidated.');
      break;
    case '/exit':
      rl.close();
      break;
    default:
      console.log(colors.error(`Unknown command: ${name}`));
  }
}

export function startREPL() {
  const config = getConfig();
  console.log(`\n${colors.banner('⚒  Forge v1.0.0')}`);
  console.log(`${colors.dim(`Provider: ${config.provider} | Model: ${getActiveModel()}`)}`);
  console.log(`${colors.dim('Type /help for commands')}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const updatePrompt = () => {
    const provider = getConfig().provider;
    const mode = planMode ? colors.tool('[PLAN]') : '';
    rl.setPrompt(`${colors.prompt(`⚒  ${provider}${mode} ❯ `)}`);
    rl.prompt();
  };

  updatePrompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      updatePrompt();
      return;
    }

    if (input.startsWith('/')) {
      await handleSlashCommand(input, rl);
      updatePrompt();
      return;
    }

    // Run Agent
    spinner.start('Forge is thinking...');
    
    try {
      const agentStream = runAgent(input, conversationHistory, { planMode });
      
      for await (const event of agentStream) {
        if (event.type === 'text') {
          spinner.stop();
          process.stdout.write(event.content);
        } else if (event.type === 'tool') {
          console.log(`\n${colors.tool('→')} ${colors.bold(event.name)}`);
        } else if (event.type === 'tool_result') {
          // Result handled by agent internally
        } else if (event.type === 'error') {
          spinner.fail(event.content);
        } else if (event.type === 'done') {
          console.log('\n');
          // stats display
          const stats = getSessionStats(conversationHistory);
          process.stdout.write(colors.dim(`[Session: ${stats.turns} turns, ${stats.toolCalls} tools]`));
          console.log('\n');
          await saveSession(conversationHistory);
        }
      }
    } catch (e) {
      spinner.fail(e.message);
    }

    updatePrompt();
  });

  rl.on('close', () => {
    console.log(`\n${colors.success('Goodbye!')}`);
    process.exit(0);
  });
}
