import Conf from 'conf';
import os from 'os';
import path from 'path';

const schema = {
  provider: { type: 'string', default: 'groq' },
  model: { type: 'string', default: 'llama-3.3-70b-versatile' },
  providers: {
    type: 'object',
    default: {
      groq: { apiKey: '', model: 'llama-3.3-70b-versatile' },
      openrouter: { apiKey: '', model: 'deepseek/deepseek-chat-v3-0324:free' },
      together: { apiKey: '', model: 'meta-llama/Llama-3-70b-chat-hf' },
      mistral: { apiKey: '', model: 'mistral-small-latest' }
    }
  },
  theme: { type: 'string', default: 'default' },
  autoMemory: { type: 'boolean', default: true },
  approveShell: { type: 'boolean', default: true }
};

const config = new Conf({
  projectName: 'forge',
  configName: 'config',
  cwd: path.join(os.homedir(), '.forge'),
  schema
});

export const getConfig = () => config.store;
export const setConfig = (key, value) => config.set(key, value);
export const getApiKey = (provider) => config.get(`providers.${provider}.apiKey`);
export const setApiKey = (provider, key) => config.set(`providers.${provider}.apiKey`, key);
export const getActiveModel = () => {
  const provider = config.get('provider');
  return config.get(`providers.${provider}.model`);
};

export default config;
