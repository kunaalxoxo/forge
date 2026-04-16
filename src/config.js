import Conf from 'conf';
import os from 'os';
import path from 'path';

const DEFAULTS = {
  provider: 'groq',
  offline: false,
  studentMode: true,
  tokenBudget: 4000,
  maxHistoryTurns: 3,
  approveShell: true,
  architectMode: false,
  providers: {
    groq: { apiKey: '', model: 'llama-3.1-8b-instant' },
    openrouter: { apiKey: '', model: 'deepseek/deepseek-chat-v3-0324:free' },
    together: { apiKey: '', model: 'meta-llama/Llama-3-8b-chat-hf' },
    mistral: { apiKey: '', model: 'mistral-small-latest' },
    ollama: { apiKey: '', model: 'llama3.1:8b-instruct-q4_K_M', baseUrl: 'http://localhost:11434' }
  }
};

const config = new Conf({
  projectName: 'forge',
  configName: 'config',
  cwd: path.join(os.homedir(), '.forge'),
  defaults: DEFAULTS
});

export const getConfig = () => config.store;
export const setConfig = (key, value) => config.set(key, value);
export const getProviderConfig = (provider) => config.get(`providers.${provider}`) || {};
export const getApiKey = (provider) => config.get(`providers.${provider}.apiKey`) || '';
export const setApiKey = (provider, key) => config.set(`providers.${provider}.apiKey`, key);
export const getActiveProvider = () => config.get('provider');
export const setActiveProvider = (provider) => config.set('provider', provider);
export const getActiveModel = () => {
  const provider = getActiveProvider();
  return config.get(`providers.${provider}.model`);
};

export function applyStudentMode(enabled) {
  setConfig('studentMode', enabled);
  if (enabled) {
    setConfig('tokenBudget', 4000);
    setConfig('maxHistoryTurns', 3);
    if (!getActiveModel()) {
      setConfig('providers.groq.model', 'llama-3.1-8b-instant');
      setConfig('provider', 'groq');
    }
  }
}

export default config;
