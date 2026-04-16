import fs from 'fs/promises';
import path from 'path';

function resolveInCwd(inputPath = '.') {
  return path.resolve(process.cwd(), inputPath);
}

export async function read_file({ path: filePath, start_line, end_line }) {
  const fullPath = resolveInCwd(filePath);
  const content = await fs.readFile(fullPath, 'utf8');
  const lines = content.split('\n');
  const start = start_line ? Math.max(Number(start_line) - 1, 0) : 0;
  const end = end_line ? Math.min(Number(end_line), lines.length) : lines.length;
  return lines.slice(start, end).map((line, i) => `${start + i + 1} | ${line}`).join('\n');
}

export async function write_file({ path: filePath, content }) {
  const fullPath = resolveInCwd(filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return `Wrote ${content.length} chars to ${fullPath}`;
}

export async function list_files({ path: dirPath = '.', recursive = true }) {
  const root = resolveInCwd(dirPath);
  const skip = new Set(['.git', 'node_modules']);

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (entry.isDirectory()) {
        out.push(`${rel}/`);
        if (recursive) out.push(...await walk(abs));
      } else {
        out.push(rel);
      }
    }
    return out;
  }

  return (await walk(root)).join('\n');
}
