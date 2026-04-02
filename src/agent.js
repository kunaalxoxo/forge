import { callProvider } from './providers/index.js';
import { TOOLS, executeTool } from './tools/index.js';
import { formatForPrompt, appendMemory } from './memory/index.js';
import { loadContext } from './memory/context.js';
import { spinner } from './ui/spinner.js';
import { colors } from './ui/colors.js';

const BASE_SYSTEM_PROMPT = `You are Forge, an expert AI coding agent.

## CRITICAL RULES — follow these on every single response:
1. ONLY perform actions the user explicitly asked for. Never make unrequested changes to files.
2. If asked to READ a file and report something, call read_file then answer in text. Do NOT call write_file or str_replace_editor unless the user asked you to change something.
3. Before calling write_file or str_replace_editor, state what you are about to change and why. If it was not requested, don't do it.
4. Never "improve", "fix", "update" or "refactor" anything that wasn't explicitly requested.

## Available tools:
- read_file: Read file contents
- write_file: Create new files only
- str_replace_editor: Edit existing files (surgical replacement)
- bash_execute: Run shell commands (asks approval first)
- list_files: List directory contents
- web_search: Search the web
- update_memory: Save facts to MEMORY.md

## Response style:
- Be concise. Answer the question directly after using tools.
- Show tool results inline, not as code blocks.
- Never explain what you're about to do — just do it.`;

export async function buildSystemPrompt() {
  const memory = await formatForPrompt();
  const context = await loadContext();
  
  return `${BASE_SYSTEM_PROMPT}

[MEMORY]
${memory}

[CONTEXT]
${context}`;
}

function trimHistoryForAPI(messages, maxMessages = 4) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');
  const recent = nonSystem.slice(-maxMessages);
  const combined = [...systemMessages, ...recent];
  
  // Estimate tokens (chars / 4)
  const charCount = JSON.stringify(combined).length;
  if (charCount / 4 > 8000) {
    process.stdout.write(colors.dim('\n⚠ Large context, using recent history only\n'));
  }
  
  return combined;
}

function truncateToolResult(result, maxChars = 2000) {
  if (typeof result === 'string' && result.length > maxChars) {
    return result.slice(0, maxChars) + '\n... [truncated, ' + result.length + ' total chars]';
  }
  return result;
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
    const lastMessage = messages[messages.length - 1];
    const providerOptions = { stream: true };
    if (lastMessage && lastMessage.role === 'tool') {
      providerOptions.stream = false;
    }

    const trimmedMessages = trimHistoryForAPI(messages);

    const result = await callProvider(trimmedMessages, planMode ? [] : TOOLS, (chunk) => {
      currentContent += chunk;
    }, providerOptions);

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

        const truncatedResult = truncateToolResult(toolResult);

        const toolResultMessage = {
          role: 'tool',
          tool_call_id: toolCall.id,
          name,
          content: typeof truncatedResult === 'string' ? truncatedResult : JSON.stringify(truncatedResult)
        };
        
        conversationHistory.push(toolResultMessage);
        messages.push(toolResultMessage);
        yield { type: 'tool_result', name, result: truncatedResult };
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
