import fs from 'fs/promises';
import path from 'path';

const EXT = new Set(['.js', '.mjs', '.cjs', '.json', '.md']);
const SKIP = new Set(['.git', 'node_modules']);

async function collect(dir, root, out) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push(`${rel}/`);
      await collect(full, root, out);
    } else {
      out.push(rel);
    }
  }
}

function signatures(content) {
  const lines = content.split('\n');
  const sigs = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(export\s+)?(async\s+)?function\s+\w+/.test(trimmed)) sigs.push(trimmed);
    else if (/^(export\s+)?class\s+\w+/.test(trimmed)) sigs.push(trimmed);
    if (sigs.length >= 8) break;
  }
  return sigs;
}

export async function build_repo_map({ path: basePath = '.', includeSignatures = true, maxFiles = 120 } = {}) {
  const root = path.resolve(process.cwd(), basePath);
  const tree = [];
  await collect(root, root, tree);
  const files = tree.filter((f) => !f.endsWith('/')).slice(0, maxFiles);

  if (!includeSignatures) {
    return { root, files, signatures: {} };
  }

  const sigMap = {};
  for (const rel of files) {
    const ext = path.extname(rel);
    if (!EXT.has(ext) || ext === '.md' || ext === '.json') continue;
    const full = path.join(root, rel);
    try {
      const content = await fs.readFile(full, 'utf8');
      const sigs = signatures(content);
      if (sigs.length) sigMap[rel] = sigs;
    } catch {
      // ignore unreadable files
    }
  }

  return { root, files, signatures: sigMap };
}
