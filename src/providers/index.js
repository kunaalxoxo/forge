import { callGroq } from './groq.js';
import { callOpenRouter } from './openrouter.js';
import { callTogether } from './together.js';
import { callMistral } from './mistral.js';
import { getConfig, getApiKey, setConfig } from '../config.js';
import { colors } from '../ui/colors.js';

const PROVIDERS = {
  groq: callGroq,
  openrouter: callOpenRouter,
  together: callTogether,
  mistral: callMistral
};

const FALLBACK_ORDER = ['groq', 'openrouter', 'together', 'mistral'];
const TOKEN_LIMITS = {
  groq: 8000,
  openrouter: 4000,
  together: 4000,
  mistral: 8000
};

let lastSuccessfulProvider = null;

export async function callProvider(messages, tools, onChunk, options) {
  const config = getConfig();
  const startProvider = lastSuccessfulProvider || config.provider;
  const startIndex = FALLBACK_ORDER.includes(startProvider) ? FALLBACK_ORDER.indexOf(startProvider) : 0;
  
  const providersToTry = [
    startProvider,
    ...FALLBACK_ORDER.slice(startIndex + 1),
    ...FALLBACK_ORDER.slice(0, startIndex)
  ].filter((p, i, self) => self && self.indexOf(p) === i);

  // Estimate tokens (chars / 4)
  const totalChars = JSON.stringify(messages).length + JSON.stringify(tools || []).length;
  const estimatedTokens = Math.ceil(totalChars / 4);

  for (const providerName of providersToTry) {
    const apiKey = getApiKey(providerName);
    if (!apiKey) continue;

    // Skip if request is too large for this provider
    if (estimatedTokens > (TOKEN_LIMITS[providerName] || 4000)) {
      console.warn(colors.error(`\n[${providerName}] request too large (~${estimatedTokens} tokens). Skipping...`));
      continue;
    }

    const fn = PROVIDERS[providerName];
    const model = config.providers[providerName]?.model;

    try {
      const result = await fn(messages, tools, onChunk, apiKey, model, options);
      lastSuccessfulProvider = providerName;
      return result;
    } catch (error) {
      console.warn(colors.error(`\n[${providerName}] error: ${error.message}. Trying fallback...`));
    }
  }

  throw new Error('All providers failed, request too large for all, or no API keys configured.');
}

export const listProviders = () => Object.keys(PROVIDERS);
export const setActiveProvider = (name) => setConfig('provider', name);
export const getActiveModel = () => {
  const config = getConfig();
  return config.providers[config.provider].model;
};
