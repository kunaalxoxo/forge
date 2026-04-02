import { getConfig, getApiKey } from '../config.js';

export async function callGroq(messages, tools, onChunk, apiKey, model, options = {}) {
  const config = getConfig();
  const actualApiKey = apiKey || getApiKey('groq');
  const actualModel = model || config.providers?.groq?.model || 'llama-3.3-70b-versatile';
  const isStreaming = options.stream !== false;

  const body = {
    model: actualModel,
    messages,
    stream: isStreaming,
    max_tokens: 4096
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${actualApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    const retryMatch = errText.match(/try again in ([\d.]+)s/);
    if (response.status === 429 && retryMatch) {
      const waitMs = (parseFloat(retryMatch[1]) + 1) * 1000;
      console.error(`Rate limited. Waiting ${Math.ceil(waitMs/1000)}s...`);
      await new Promise(r => setTimeout(r, waitMs));
      
      // Retry once
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${actualApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const finalErr = await response.text();
        throw new Error(`Groq API error ${response.status} (after retry): ${finalErr}`);
      }
    } else {
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }
  }

  if (!isStreaming) {
    const data = await response.json();
    const message = data.choices[0].message;
    
    const parsedToolCalls = (message.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments || '{}')
    }));

    return {
      content: message.content || '',
      toolCalls: parsedToolCalls,
      usage: data.usage
    };
  }

  // SSE parsing — the correct way
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let toolCalls = [];
  let usage = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '') continue;
      if (!trimmed.startsWith('data:')) continue;
      
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        
        // Handle usage
        if (parsed.usage) usage = parsed.usage;

        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Handle text content
        if (delta.content) {
          fullContent += delta.content;
          if (onChunk) onChunk(delta.content);
        }

        // Handle tool calls - accumulate across chunks
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { 
                id: tc.id || '', 
                type: 'function',
                function: { name: '', arguments: '' } 
              }
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      } catch (e) {
        // Skip malformed chunks silently
      }
    }
  }

  // Parse tool call arguments from JSON strings
  const parsedToolCalls = toolCalls
    .filter(tc => tc?.function?.name)
    .map(tc => {
      try {
        return {
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || '{}')
        }
      } catch {
        return { id: tc.id, name: tc.function.name, args: {} }
      }
    });

  return {
    content: fullContent,
    toolCalls: parsedToolCalls,
    usage
  }
}
