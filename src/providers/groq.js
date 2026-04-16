const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function parseToolArgs(raw = '{}') {
  try { return JSON.parse(raw); } catch { return {}; }
}

async function parseSSE(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCalls = [];
  let usage = null;

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
      if (parsed.usage) usage = parsed.usage;
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
    usage,
    toolCalls: toolCalls
      .filter(Boolean)
      .map((tc) => ({ id: tc.id, name: tc.name, args: parseToolArgs(tc.arguments) }))
  };
}

export async function callGroq(messages, tools, onChunk, apiKey, model, options = {}) {
  const stream = options.stream !== false;
  const body = {
    model: model || 'llama-3.1-8b-instant',
    messages,
    stream,
    tool_choice: tools?.length ? 'auto' : undefined,
    tools: tools?.length ? tools : undefined,
    max_tokens: options.maxTokens || 4096
  };

  const response = options.__directResponse || await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`STATUS_${response.status}: ${await response.text()}`);
  }

  if (!stream) {
    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    return {
      content: message.content || '',
      usage: data.usage,
      toolCalls: (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        args: parseToolArgs(tc.function?.arguments)
      }))
    };
  }

  return parseSSE(response, onChunk);
}
