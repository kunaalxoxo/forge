import fs from 'fs/promises';
import { createPatch } from 'diff';
import { colors } from '../ui/colors.js';

export async function str_replace_editor({ file_path, old_str, new_str }) {
  const content = await fs.readFile(file_path, 'utf-8');
  const occurrences = content.split(old_str).length - 1;

  if (occurrences === 0) throw new Error(`Could not find "${old_str}" in ${file_path}`);
  if (occurrences > 1) throw new Error(`Found multiple occurrences (${occurrences}) of "${old_str}" in ${file_path}`);

  const updatedContent = content.replace(old_str, new_str);
  await fs.writeFile(file_path, updatedContent, 'utf-8');

  const patch = createPatch(file_path, content, updatedContent);
  const patchLines = patch.split('\n');
  
  let formattedDiff = '';
  for (const line of patchLines.slice(4)) {
    if (line.startsWith('+')) formattedDiff += colors.success(line) + '\n';
    else if (line.startsWith('-')) formattedDiff += colors.error(line) + '\n';
    else formattedDiff += line + '\n';
  }

  process.stdout.write(formattedDiff);
  return `Successfully replaced in ${file_path}\n${formattedDiff}`;
}
