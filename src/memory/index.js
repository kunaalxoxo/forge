import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const MEM_PATH = path.resolve(process.cwd(), 'MEMORY.md');
const RUNTIME_DIR = path.join(os.homedir(), '.forge');
const DAEMON_PID = path.join(RUNTIME_DIR, 'daemon.pid');

function parseLine(line) {
  const match = line.match(/^\[(ARCH|PREF|BUG|TODO|CONTEXT)\]\s+(.{1,150})$/);
  return match ? { category: match[1], content: match[2] } : null;
}

export async function ensureMemoryFile() {
  try {
    await fs.access(MEM_PATH);
  } catch {
    await fs.writeFile(MEM_PATH, '[CONTEXT] Forge memory bootstrap\n', 'utf8');
  }
}

export async function readMemory() {
  await ensureMemoryFile();
  const text = await fs.readFile(MEM_PATH, 'utf8');
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map(parseLine).filter(Boolean);
}

export async function formatForPrompt() {
  const pointers = await readMemory();
  return pointers.length ? pointers.map((p) => `[${p.category}] ${p.content}`).join('\n') : '[CONTEXT] empty';
}

export async function updateMemory(pointers = []) {
  const existing = await readMemory();
  const seen = new Set(existing.map((p) => `[${p.category}] ${p.content}`.toLowerCase()));
  const lines = [];
  for (const pointer of pointers) {
    const category = String(pointer.category || 'CONTEXT').toUpperCase();
    const content = String(pointer.content || '').trim().slice(0, 150);
    if (!content) continue;
    const line = `[${category}] ${content}`;
    if (seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    lines.push(line);
  }
  if (!lines.length) return 'No memory changes.';
  await fs.appendFile(MEM_PATH, `${(await fs.readFile(MEM_PATH, 'utf8')).endsWith('\n') ? '' : '\n'}${lines.join('\n')}\n`, 'utf8');
  return `Added ${lines.length} memory pointers.`;
}

export async function autoDream() {
  const current = await readMemory();
  const byKey = new Map();
  for (const item of current) {
    const key = `${item.category}:${item.content.toLowerCase().replace(/\s+/g, ' ').slice(0, 64)}`;
    byKey.set(key, item);
  }

  const resolved = [...byKey.values()]
    .map((item) => ({ ...item, content: item.content.replace(/\s+/g, ' ').trim().slice(0, 150) }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.content.localeCompare(b.content));

  const finalLines = resolved.map((item) => `[${item.category}] ${item.content}`);
  await fs.writeFile(MEM_PATH, `${finalLines.join('\n')}\n`, 'utf8');
  return `autoDream complete: ${finalLines.length} pointers.`;
}

export async function daemonStatus() {
  try {
    const pid = Number(await fs.readFile(DAEMON_PID, 'utf8'));
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    return { running: false, pid: null };
  }
}

export async function startDaemon() {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  const status = await daemonStatus();
  if (status.running) return `Daemon already running (${status.pid})`;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const cliPath = path.resolve(moduleDir, '../../bin/forge.js');
  const child = spawn(process.execPath, [cliPath, 'daemon-run'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  await fs.writeFile(DAEMON_PID, String(child.pid), 'utf8');
  return `Daemon started (${child.pid})`;
}

export async function stopDaemon() {
  const status = await daemonStatus();
  if (!status.running) return 'Daemon is not running.';
  process.kill(status.pid);
  await fs.rm(DAEMON_PID, { force: true });
  return `Daemon stopped (${status.pid})`;
}

export async function daemonTick() {
  await ensureMemoryFile();
  await autoDream();
}
