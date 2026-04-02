import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const SESSION_DIR = path.join(os.homedir(), '.forge', 'sessions');

export async function saveSession(messages, metadata = {}) {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  const filename = `${new Date().toISOString().replace(/:/g, '-')}.json`;
  const filePath = path.join(SESSION_DIR, filename);
  
  const sessionData = {
    timestamp: new Date().toISOString(),
    messages,
    metadata
  };

  await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
  return filename;
}

export async function listSessions() {
  try {
    const files = await fs.readdir(SESSION_DIR);
    const sessions = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async (file) => {
        const content = await fs.readFile(path.join(SESSION_DIR, file), 'utf-8');
        const data = JSON.parse(content);
        return {
          id: file.replace('.json', ''),
          timestamp: data.timestamp,
          messagesCount: data.messages.length
        };
      })
    );
    return sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  } catch (e) {
    return [];
  }
}

export async function loadSession(id) {
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export function getSessionStats(messages) {
  let turns = 0;
  let toolCalls = 0;
  
  for (const m of messages) {
    if (m.role === 'user') turns++;
    if (m.tool_calls) toolCalls += m.tool_calls.length;
  }

  return { turns, toolCalls };
}
