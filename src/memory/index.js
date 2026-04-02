import fs from 'fs/promises';
import path from 'path';

export async function readMemory() {
  try {
    const content = await fs.readFile('MEMORY.md', 'utf-8');
    return content.split('\n')
      .filter(line => line.startsWith('['))
      .map(line => {
        const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
        return match ? { category: match[1], content: match[2] } : null;
      }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

export async function appendMemory(category, content) {
  const pointer = `[${category}] ${content.slice(0, 150)}`;
  await fs.appendFile('MEMORY.md', `\n${pointer}`, 'utf-8');
}

export async function updateMemory(pointers) {
  const current = await readMemory();
  const existingContents = new Set(current.map(p => p.content));
  
  let addedCount = 0;
  for (const p of pointers) {
    if (!existingContents.has(p.content)) {
      await appendMemory(p.category, p.content);
      addedCount++;
    }
  }
  return `Updated MEMORY.md: added ${addedCount} new pointers.`;
}

export async function formatForPrompt() {
  const memory = await readMemory();
  if (memory.length === 0) return 'No memory yet.';
  return memory.map(m => `[${m.category}] ${m.content}`).join('\n');
}

export async function consolidate(callProvider) {
  const current = await fs.readFile('MEMORY.md', 'utf-8');
  const messages = [
    { role: 'system', content: 'You are an expert at information consolidation. Rewrite the following MEMORY.md file. Deduplicate, resolve contradictions, and group by category. Keep each line under 150 chars. Maintain the format: [CATEGORY] fact' },
    { role: 'user', content: current }
  ];
  
  const result = await callProvider(messages, []);
  await fs.writeFile('MEMORY.md', result.content, 'utf-8');
  return 'MEMORY.md consolidated.';
}
