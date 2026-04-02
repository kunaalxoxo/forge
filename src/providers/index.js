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

export async function callProvider(messages, tools, onChunk, options) {
  const config = getConfig();
  const startProvider = config.provider;
  const startIndex = FALLBACK_ORDER.indexOf(startProvider);
  
  const providersToTry = [
    startProvider,
    ...FALLBACK_ORDER.slice(startIndex + 1),
    ...FALLBACK_ORDER.slice(0, startIndex)
  ].filter((p, i, self) => self.indexOf(p) === i);

  for (const providerName of providersToTry) {
    const apiKey = getApiKey(providerName);
    if (!apiKey) continue;

    const fn = PROVIDERS[providerName];
    const model = config.providers[providerName].model;

    try {
      return await fn(messages, tools, onChunk, apiKey, model, options);
    } catch (error) {
      console.warn(colors.error(`\n[${providerName}] error: ${error.message}. Trying fallback...`));
    }
  }

  throw new Error('All providers failed or no API keys configured.');
}

export const listProviders = () => Object.keys(PROVIDERS);
export const setActiveProvider = (name) => setConfig('provider', name);
export const getActiveModel = () => {
  const config = getConfig();
  return config.providers[config.provider].model;
};
