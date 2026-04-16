import fs from 'fs/promises';
import path from 'path';

export async function loadContextHierarchy(startDir = process.cwd()) {
  const parts = [];
  let dir = path.resolve(startDir);

  while (true) {
    for (const file of ['GEMINI.md', 'FORGE.md']) {
      const full = path.join(dir, file);
      try {
        const text = await fs.readFile(full, 'utf8');
        parts.unshift(`## ${full}\n${text}`);
      } catch {
        // missing context file is fine
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return parts.join('\n\n');
}
