import fs from 'fs/promises';
import path from 'path';

export async function loadContext(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);
  let contextParts = [];

  while (true) {
    const aiFile = path.join(currentDir, 'AI.md');
    const forgeFile = path.join(currentDir, 'FORGE.md');

    try {
      const aiContent = await fs.readFile(aiFile, 'utf-8');
      contextParts.unshift(`--- Context from ${aiFile} ---\n${aiContent}\n--- End of context from ${aiFile} ---`);
    } catch (e) {}

    try {
      const forgeContent = await fs.readFile(forgeFile, 'utf-8');
      contextParts.unshift(`--- Context from ${forgeFile} ---\n${forgeContent}\n--- End of context from ${forgeFile} ---`);
    } catch (e) {}

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return contextParts.join('\n\n');
}
