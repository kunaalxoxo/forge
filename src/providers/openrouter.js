export async function callOpenRouter(messages, tools, onChunk, apiKey, model) {
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
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let toolCalls = [];
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const chunkLines = chunk.split('\n');

    for (const line of chunkLines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') break;

        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices[0].delta;

          if (delta.content) {
            content += delta.content;
            if (onChunk) onChunk(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }

          if (data.usage) {
            usage = data.usage;
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  return { content, toolCalls: toolCalls.filter(Boolean), usage };
}
