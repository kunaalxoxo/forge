#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import { startREPL } from '../src/repl.js';
import { runAgent } from '../src/agent.js';
import { getApiKey, setApiKey, setConfig, getConfig } from '../src/config.js';
import { colors } from '../src/ui/colors.js';
import { spinner } from '../src/ui/spinner.js';
import readline from 'readline/promises';

const program = new Command();

program
  .name('forge')
  .description('AI coding agent for the terminal')
  .version('1.0.0');

program
  .argument('[prompt]', 'Single-shot prompt to run')
  .option('-f, --file <path>', 'Prepend file contents to prompt')
  .option('-m, --model <name>', 'Override model')
  .option('-p, --provider <name>', 'Override provider')
  .option('--plan', 'Start in plan mode')
  .option('--no-approve', 'Disable shell approval gate')
  .action(async (prompt, options) => {
    // Check if API keys exist
    const config = getConfig();
    const hasAnyKey = ['groq', 'openrouter', 'together', 'mistral'].some(p => getApiKey(p));
    
    if (!hasAnyKey) {
      await runSetup();
    }

    if (options.model) setConfig('model', options.model);
    if (options.provider) setConfig('provider', options.provider);
    if (options.noApprove === false) setConfig('approveShell', false);

    if (!prompt) {
      startREPL({ planMode: options.plan });
    } else {
      let fullPrompt = prompt;
      if (options.file) {
        const fileContent = await fs.readFile(options.file, 'utf-8');
        fullPrompt = `File: ${options.file}\nContent:\n${fileContent}\n\nTask: ${prompt}`;
      }
      
      const history = [];
      const agentStream = runAgent(fullPrompt, history, { planMode: options.plan });
      for await (const event of agentStream) {
        if (event.type === 'text') process.stdout.write(event.content);
        if (event.type === 'tool') console.log(`\n${colors.tool('→')} ${event.name}`);
        if (event.type === 'error') console.error(colors.error(event.content));
      }
      process.exit(0);
    }
  });

program
  .command('setup')
  .description('Run the API key setup wizard')
  .action(runSetup);

async function runSetup() {
  console.log(`\n${colors.banner('⚒  Forge Setup')}\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const askKey = async (provider, url) => {
    const key = await rl.question(`${colors.prompt(`Enter ${provider} API key`)} (${colors.dim(url)}): `);
    if (key.trim()) {
      setApiKey(provider, key.trim());
      console.log(colors.success(`Saved ${provider} key.`));
    }
  };

  await askKey('groq', 'console.groq.com');
  await askKey('openrouter', 'openrouter.ai/keys');
  await askKey('together', 'api.together.xyz');
  await askKey('mistral', 'console.mistral.ai');

  rl.close();
  console.log(`\n${colors.success('Setup complete! Run `forge` to start.')}\n`);
}

program.parse();
