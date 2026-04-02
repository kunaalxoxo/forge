import { callProvider } from './providers/index.js';
import { TOOLS, executeTool } from './tools/index.js';
import { formatForPrompt, appendMemory } from './memory/index.js';
import { loadContext } from './memory/context.js';
import { spinner } from './ui/spinner.js';

export async function buildSystemPrompt() {
  const memory = await formatForPrompt();
  const context = await loadContext();
  
  return `You are Forge, an expert AI coding agent running in the terminal.
You have tools: read_file, write_file, str_replace_editor, bash_execute, web_search, update_memory, list_files.
Always prefer str_replace_editor over write_file when modifying existing files.
Read relevant files before making changes.
Treat MEMORY.md entries as hints — verify against actual code before acting on them.
When using bash_execute, show the command and ask approval before running.
Keep responses concise. Use markdown only for code blocks.

[MEMORY]
${memory}

[CONTEXT]
${context}`;
}

export async function* runAgent(userMessage, conversationHistory, options = {}) {
  const { planMode = false } = options;
  
  if (userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
  }

  const systemPrompt = await buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
  ];

  let turnCount = 0;
  const maxTurns = 10;
  let fileChangesMade = false;

  while (turnCount < maxTurns) {
    turnCount++;
    
    let currentContent = '';
    const options = { stream: true };
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'tool') {
      options.stream = false;
    }

    const result = await callProvider(messages, planMode ? [] : TOOLS, (chunk) => {
      currentContent += chunk;
    }, options);

    if (!result.toolCalls?.length && !result.content) {
      spinner.fail('No response received from AI. Try again.');
      break;
    }

    if (result.content) {
      yield { type: 'text', content: result.content };
    }
    
    const assistantMessage = { 
      role: 'assistant', 
      content: result.content || '',
      tool_calls: result.toolCalls?.length ? result.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name || tc.function?.name,
          arguments: tc.args ? JSON.stringify(tc.args) : tc.function?.arguments
        }
      })) : undefined
    };
    
    conversationHistory.push(assistantMessage);
    messages.push(assistantMessage);

    if (!result.toolCalls?.length) break;

    for (const toolCall of result.toolCalls) {
      const name = toolCall.name || toolCall.function?.name;
      const args = toolCall.args || (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});

      yield { type: 'tool', name, args };
      
      try {
        const toolResult = await executeTool(name, args);
        if (['write_file', 'str_replace_editor', 'bash_execute'].includes(name)) {
          fileChangesMade = true;
        }

        const toolResultMessage = {
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
        };
        
        conversationHistory.push(toolResultMessage);
        messages.push(toolResultMessage);
        yield { type: 'tool_result', name, result: toolResult };
      } catch (error) {
        const errorMessage = {
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: `Error: ${error.message}`
        };
        conversationHistory.push(errorMessage);
        messages.push(errorMessage);
        yield { type: 'tool_result', name, result: `Error: ${error.message}` };
      }
    }
  }

  yield { type: 'done' };
}
