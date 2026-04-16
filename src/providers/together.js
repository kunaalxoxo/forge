import { callGroq } from './groq.js';

export async function callTogether(messages, tools, onChunk, apiKey, model, options = {}) {
  const endpoint = 'https://api.together.xyz/v1/chat/completions';
  const stream = options.stream !== false;
  const body = {
    model: model || 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
    messages,
    stream,
    tool_choice: tools?.length ? 'auto' : undefined,
    tools: tools?.length ? tools : undefined,
    max_tokens: options.maxTokens || 4096
  };

  const response = await fetch(endpoint, {
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
        args: JSON.parse(tc.function?.arguments || '{}')
      }))
    };
  }

  return callGroq(messages, tools, onChunk, apiKey, body.model, { ...options, __directResponse: response });
}
