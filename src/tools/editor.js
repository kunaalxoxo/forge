import fs from 'fs/promises';
import path from 'path';
import { applyPatch, createPatch } from 'diff';

function resolveInCwd(inputPath) {
  return path.resolve(process.cwd(), inputPath);
}

function unified(filePath, oldContent, newContent) {
  return createPatch(filePath, oldContent, newContent, 'before', 'after');
}

export async function str_replace_editor({ file_path, old_str, new_str }) {
  const full = resolveInCwd(file_path);
  const original = await fs.readFile(full, 'utf8');
  const occurrences = original.split(old_str).length - 1;

  if (occurrences === 0) throw new Error('str_replace failed: old_str not found');
  if (occurrences > 1) throw new Error(`str_replace failed: old_str found ${occurrences} times`);

  const updated = original.replace(old_str, new_str);
  await fs.writeFile(full, updated, 'utf8');
  return unified(file_path, original, updated);
}

export async function udiff_editor({ file_path, patch }) {
  const full = resolveInCwd(file_path);
  const original = await fs.readFile(full, 'utf8');
  const updated = applyPatch(original, patch);
  if (updated === false) throw new Error('udiff apply failed');
  await fs.writeFile(full, updated, 'utf8');
  return unified(file_path, original, updated);
}

export async function rewrite_editor({ file_path, content }) {
  const full = resolveInCwd(file_path);
  const original = await fs.readFile(full, 'utf8');
  await fs.writeFile(full, content, 'utf8');
  return unified(file_path, original, content);
}

export async function edit_file(args) {
  if (args.old_str !== undefined && args.new_str !== undefined) {
    return str_replace_editor({ file_path: args.file_path, old_str: args.old_str, new_str: args.new_str });
  }
  if (args.patch) {
    return udiff_editor({ file_path: args.file_path, patch: args.patch });
  }
  if (args.content !== undefined) {
    return rewrite_editor({ file_path: args.file_path, content: args.content });
  }
  throw new Error('edit_file requires old_str/new_str, patch, or content');
}
