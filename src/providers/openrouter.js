// Known Free Models:
// meta-llama/llama-3.3-70b-instruct:free
// google/gemma-3-27b-it:free
// microsoft/phi-4:free
// qwen/qwen3-235b-a22b:free

export async function callOpenRouter(messages, tools, onChunk, apiKey, model, options = {}) {
  const isStreaming = options.stream !== false;

  const body = {
    model: model || 'meta-llama/llama-3.3-70b-instruct:free',
    messages,
    tools: tools?.length ? tools : undefined,
    stream: isStreaming
  };

  let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/kunaalxoxo/forge',
      'X-Title': 'Forge'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.error(`[OpenRouter] Rate limited. Waiting 2s before retry...`);
      await new Promise(r => setTimeout(r, 2000));
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/kunaalxoxo/forge',
          'X-Title': 'Forge'
        },
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `API error: ${response.status}`;
      throw new Error(`STATUS_${response.status}: ${message}`);
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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let toolCalls = [];
  let usage = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep partial line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

      if (trimmedLine.startsWith('data: ')) {
        const dataStr = trimmedLine.slice(6);
        try {
          const data = JSON.parse(dataStr);
          if (!data.choices?.length) {
            if (data.usage) usage = data.usage;
            continue;
          }
          
          const delta = data.choices[0].delta;

          if (delta.content !== null && delta.content !== undefined) {
            content += delta.content;
            if (onChunk) onChunk(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }

          if (data.usage) {
            usage = data.usage;
          }
        } catch (e) {
          buffer = line + '\n' + buffer;
        }
      }
    }
  }

  const parsedToolCalls = toolCalls
    .filter(tc => tc?.function?.name)
    .map(tc => {
      try {
        return {
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || '{}')
        };
      } catch {
        return { id: tc.id, name: tc.function.name, args: {} };
      }
    });

  return { content, toolCalls: parsedToolCalls, usage };
}
