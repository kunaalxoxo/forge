const OLLAMA_ENDPOINT = 'http://localhost:11434/v1/chat/completions';

function parseArgs(raw = '{}') {
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function callOllama(messages, tools, onChunk, _apiKey, model, options = {}) {
  const stream = options.stream !== false;
  const response = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.1:8b-instruct-q4_K_M',
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      stream
    })
  });

  if (!response.ok) {
    throw new Error(`STATUS_${response.status}: ${await response.text()}`);
  }

  if (!stream) {
    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    return {
      content: message.content || '',
      toolCalls: (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        args: parseArgs(tc.function?.arguments)
      })),
      usage: data.usage
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCalls = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (buffer.includes('\n\n')) {
      const idx = buffer.indexOf('\n\n');
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let parsed;
      try { parsed = JSON.parse(payload); } catch { continue; }
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        onChunk?.(delta.content);
      }
      for (const tc of delta.tool_calls || []) {
        const i = tc.index ?? 0;
        if (!toolCalls[i]) toolCalls[i] = { id: tc.id || '', name: '', arguments: '' };
        if (tc.id) toolCalls[i].id = tc.id;
        if (tc.function?.name) toolCalls[i].name += tc.function.name;
        if (tc.function?.arguments) toolCalls[i].arguments += tc.function.arguments;
      }
    }
  }

  return {
    content,
    usage: null,
    toolCalls: toolCalls.filter(Boolean).map((tc) => ({ id: tc.id, name: tc.name, args: parseArgs(tc.arguments) }))
  };
}
