import fs from 'fs/promises';
import path from 'path';

export async function read_file({ path: filePath, start_line, end_line }) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const start = start_line ? parseInt(start_line) - 1 : 0;
  const end = end_line ? parseInt(end_line) : lines.length;
  
  const slicedLines = lines.slice(start, end);
  return slicedLines.map((line, i) => `${start + i + 1} | ${line}`).join('\n');
}

export async function write_file({ path: filePath, content }) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return `Successfully wrote ${content.length} characters to ${filePath}`;
}

export async function list_files({ path: dirPath = '.', recursive = true }) {
  // Simple recursive readdir for now, ignoring .git and node_modules
  const getFiles = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map((res) => {
      const resPath = path.join(dir, res.name);
      if (res.name === '.git' || res.name === 'node_modules') return [];
      return res.isDirectory() ? (recursive ? getFiles(resPath) : [resPath]) : resPath;
    }));
    return Array.prototype.concat(...files);
  };
  
  const allFiles = await getFiles(dirPath);
  return allFiles.join('\n');
}
