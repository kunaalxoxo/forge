import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const SESSION_DIR = path.join(os.homedir(), '.forge', 'sessions');
const ACTIVE_FILE = path.join(SESSION_DIR, 'active.json');
const CHECKPOINT_DIR = path.join(SESSION_DIR, 'checkpoints');

async function ensureDirs() {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
}

function makeId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveSession(messages, metadata = {}) {
  await ensureDirs();
  const id = makeId();
  const payload = { id, timestamp: new Date().toISOString(), messages, metadata };
  await fs.writeFile(path.join(SESSION_DIR, `${id}.json`), JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(ACTIVE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  await createCheckpoint(messages);
  return id;
}

export async function createCheckpoint(messages) {
  await ensureDirs();
  const id = makeId();
  const checkpoint = { id, timestamp: new Date().toISOString(), messages };
  await fs.writeFile(path.join(CHECKPOINT_DIR, `${id}.json`), JSON.stringify(checkpoint, null, 2), 'utf8');
  return id;
}

export async function listSessions() {
  await ensureDirs();
  const files = (await fs.readdir(SESSION_DIR)).filter((f) => f.endsWith('.json') && f !== 'active.json');
  const sessions = [];
  for (const file of files) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(SESSION_DIR, file), 'utf8'));
      sessions.push({ id: data.id, timestamp: data.timestamp, turns: data.messages?.filter((m) => m.role === 'user').length || 0 });
    } catch {
      // ignore bad session files
    }
  }
  return sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20);
}

export async function loadSession(id) {
  const file = path.join(SESSION_DIR, `${id}.json`);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  await fs.writeFile(ACTIVE_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

export async function undoLast(messages) {
  await ensureDirs();
  const files = (await fs.readdir(CHECKPOINT_DIR)).filter((f) => f.endsWith('.json')).sort();
  if (files.length < 2) return { restored: messages, note: 'No previous checkpoint.' };
  const prevFile = files[files.length - 2];
  const prev = JSON.parse(await fs.readFile(path.join(CHECKPOINT_DIR, prevFile), 'utf8'));
  return { restored: prev.messages || [], note: `Restored checkpoint ${prev.id}` };
}

export function getSessionStats(messages) {
  const turns = messages.filter((m) => m.role === 'user').length;
  const toolCalls = messages.reduce((acc, m) => acc + (Array.isArray(m.tool_calls) ? m.tool_calls.length : 0), 0);
  return { turns, toolCalls, costUsd: 0 };
}
