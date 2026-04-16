#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import readline from 'readline/promises';
import { startREPL } from '../src/repl.js';
import { runAgent } from '../src/agent.js';
import { colors } from '../src/ui/colors.js';
import { getConfig, setConfig, setApiKey } from '../src/config.js';
import { daemonTick } from '../src/memory/index.js';

const program = new Command();

program
  .name('forge')
  .description('Lightweight AI coding CLI')
  .version('0.2.0')
  .argument('[prompt]', 'Single-shot prompt')
  .option('-f, --file <path>', 'Append file to prompt')
  .option('-m, --model <model>', 'Override active model')
  .option('-p, --provider <provider>', 'Override active provider')
  .option('--plan', 'Start in plan mode')
  .option('--offline', 'Use local Ollama')
  .action(async (prompt, opts) => {
    if (opts.provider) setConfig('provider', opts.provider);
    if (opts.model) {
      const provider = getConfig().provider;
      setConfig(`providers.${provider}.model`, opts.model);
    }
    if (opts.offline) {
      setConfig('offline', true);
      setConfig('provider', 'ollama');
    }

    if (!prompt) {
      startREPL({ planMode: Boolean(opts.plan) });
      return;
    }

    let finalPrompt = prompt;
    if (opts.file) {
      const content = await fs.readFile(opts.file, 'utf8');
      finalPrompt = `${prompt}\n\n[File ${opts.file}]\n${content}`;
    }

    const history = [];
    const stream = runAgent(finalPrompt, history, { planMode: Boolean(opts.plan) });
    for await (const event of stream) {
      if (event.type === 'text') process.stdout.write(event.content);
      if (event.type === 'tool') console.log(`\n${colors.tool('→')} ${event.name}`);
      if (event.type === 'git_commit') console.log(`\n${colors.success('git')} ${event.message}`);
    }
    process.stdout.write('\n');
  });

program
  .command('setup')
  .description('Store provider API keys')
  .action(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    for (const provider of ['groq', 'openrouter', 'together', 'mistral']) {
      const key = await rl.question(`API key for ${provider} (blank to skip): `);
      if (key.trim()) setApiKey(provider, key.trim());
    }
    rl.close();
    console.log(colors.success('Setup complete.'));
  });

program
  .command('daemon-run')
  .description('Internal: memory daemon loop')
  .action(async () => {
    while (true) {
      try { await daemonTick(); } catch {}
      await new Promise((r) => setTimeout(r, 120000));
    }
  });

program.parse();
