export async function callOpenRouter(messages, tools, onChunk, apiKey, model, options = {}) {
  const isStreaming = options.stream !== false;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/kunaalxoxo/forge',
      'X-Title': 'Forge'
    },
    body: JSON.stringify({
      model: model || 'deepseek/deepseek-chat-v3-0324:free',
      messages,
      tools: tools?.length ? tools : undefined,
      stream: isStreaming
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
  }

  if (!isStreaming) {
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      toolCalls: data.choices[0].message.tool_calls,
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
          // If JSON is partial even within a line (unlikely with \n split but safe)
          buffer = line + '\n' + buffer;
        }
      }
    }
  }

  return { content, toolCalls: toolCalls.filter(Boolean), usage };
}
