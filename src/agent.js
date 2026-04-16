import simpleGit from 'simple-git';
import { callProvider } from './providers/index.js';
import { TOOLS, executeTool } from './tools/index.js';
import { build_repo_map } from './tools/repomap.js';
import { run_validators } from './tools/validator.js';
import { formatForPrompt } from './memory/index.js';
import { loadContextHierarchy } from './memory/context.js';
import { getConfig } from './config.js';
import { createCheckpoint } from './session/index.js';

const SYSTEM_PROMPT = `You are Forge, an expert AI coding agent running in the terminal.
You have tools: read_file, write_file, str_replace_editor, edit_file, bash_execute, web_search, update_memory, list_files, repo_map, run_validators.
Always prefer str_replace_editor over write_file when modifying existing files.
Read relevant files before making changes.
Treat MEMORY.md entries as hints and verify against files.
When using bash_execute, show the command and ask approval before running.
Keep responses concise. Use markdown only for code blocks.`;

function trimHistory(history, config) {
  const turns = config.studentMode ? Math.max(2, config.maxHistoryTurns || 3) : 10;
  const nonSystem = history.filter((m) => m.role !== 'system');
  return nonSystem.slice(-turns * 2);
}

function collectEditedFiles(toolName, args, set) {
  if (!['write_file', 'str_replace_editor', 'edit_file'].includes(toolName)) return;
  const filePath = args.path || args.file_path;
  if (filePath) set.add(filePath);
}

async function autoCommit(files, userMessage) {
  if (!files.size) return null;
  const git = simpleGit(process.cwd());
  const status = await git.status();
  if (!status.files.length) return null;
  await git.add(['-A']);
  const subject = (userMessage || 'apply requested edits').slice(0, 64).replace(/\s+/g, ' ');
  const msg = `forge: ${subject}`;
  await git.commit(msg);
  return msg;
}

export async function* runAgent(userMessage, history, options = {}) {
  const config = getConfig();
  const memory = await formatForPrompt();
  const context = await loadContextHierarchy();
  const repoMap = config.studentMode ? '' : JSON.stringify(await build_repo_map({ includeSignatures: true, maxFiles: 80 }));

  if (userMessage) history.push({ role: 'user', content: userMessage });

  const editedFiles = new Set();
  const working = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n[MEMORY]\n${memory}\n\n[CONTEXT]\n${context || 'None'}\n\n[REPO_MAP]\n${repoMap || 'disabled in student mode'}` },
    ...trimHistory(history, config)
  ];

  const maxLoops = 10;
  for (let loop = 0; loop < maxLoops; loop++) {
    const providerResult = await callProvider(
      working,
      options.planMode ? [] : TOOLS,
      (chunk) => { if (!options.silent) history.__stream = (history.__stream || '') + chunk; },
      { stream: true }
    );

    if (providerResult.content) {
      yield { type: 'text', content: providerResult.content };
      working.push({ role: 'assistant', content: providerResult.content });
      history.push({ role: 'assistant', content: providerResult.content });
    }

    const toolCalls = providerResult.toolCalls || [];
    if (!toolCalls.length) break;

    const assistantWithTools = {
      role: 'assistant',
      content: providerResult.content || '',
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id || `call_${Date.now()}`,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) }
      }))
    };
    working.push(assistantWithTools);
    history.push(assistantWithTools);

    for (const tc of toolCalls) {
      const name = tc.name || tc.function?.name;
      const args = tc.args || {};
      yield { type: 'tool', name, args };
      let result;
      try {
        result = await executeTool(name, args);
        collectEditedFiles(name, args, editedFiles);
      } catch (error) {
        result = `Error: ${error.message}`;
      }

      const toolMessage = {
        role: 'tool',
        tool_call_id: tc.id || `call_${Date.now()}`,
        name,
        content: typeof result === 'string' ? result : JSON.stringify(result)
      };
      working.push(toolMessage);
      history.push(toolMessage);
      yield { type: 'tool_result', name, result };
    }
  }

  if (editedFiles.size && !options.planMode) {
    const checks = await run_validators();
    if (checks.length) yield { type: 'validation', result: checks };
    const commitMsg = await autoCommit(editedFiles, userMessage);
    if (commitMsg) yield { type: 'git_commit', message: commitMsg };
  }

  await createCheckpoint(history);
  yield { type: 'done' };
}
