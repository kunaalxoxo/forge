export async function callTogether(messages, tools, onChunk, apiKey, model, options = {}) {
  const isStreaming = options.stream !== false;

  const body = {
    model: model || 'meta-llama/Llama-3-70b-chat-hf',
    messages,
    tools: tools?.length ? tools : undefined,
    stream: isStreaming
  };

  let response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.error(`[Together] Rate limited. Waiting 2s before retry...`);
      await new Promise(r => setTimeout(r, 2000));
      response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
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
