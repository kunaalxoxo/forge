import { callGroq } from './groq.js';
import { callOpenRouter } from './openrouter.js';
import { callTogether } from './together.js';
import { callMistral } from './mistral.js';
import { callOllama } from './ollama.js';
import { getConfig, getApiKey, setActiveProvider } from '../config.js';

const REGISTRY = {
  groq: callGroq,
  openrouter: callOpenRouter,
  together: callTogether,
  mistral: callMistral,
  ollama: callOllama
};

const FALLBACK_ORDER = ['groq', 'openrouter', 'together', 'mistral', 'ollama'];

let lastProvider = null;

export function listProviders() {
  return Object.keys(REGISTRY);
}

export function getProviderStatus() {
  const config = getConfig();
  return FALLBACK_ORDER.map((name) => ({
    name,
    active: config.provider === name,
    hasKey: name === 'ollama' ? true : Boolean(getApiKey(name)),
    model: config.providers?.[name]?.model || ''
  }));
}

export async function callProvider(messages, tools = [], onChunk, options = {}) {
  const config = getConfig();
  const primary = config.offline ? 'ollama' : (lastProvider || config.provider || 'groq');
  const order = [primary, ...FALLBACK_ORDER.filter((p) => p !== primary)];
  const maxTokens = config.tokenBudget || 4000;

  let lastError = null;

  for (const name of order) {
    if (!REGISTRY[name]) continue;
    if (name !== 'ollama' && !getApiKey(name)) continue;

    try {
      const model = config.providers?.[name]?.model;
      const result = await REGISTRY[name](messages, tools, onChunk, getApiKey(name), model, { ...options, maxTokens });
      lastProvider = name;
      if (config.provider !== name && !config.offline) setActiveProvider(name);
      return { ...result, provider: name };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No provider available. Configure API keys or run /offline for Ollama.');
}
