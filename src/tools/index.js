import { read_file, write_file, list_files } from './file.js';
import { str_replace_editor, edit_file } from './editor.js';
import { bash_execute } from './shell.js';
import { web_search } from './search.js';
import { build_repo_map } from './repomap.js';
import { run_validators } from './validator.js';
import { updateMemory } from '../memory/index.js';

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file content with optional line range.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, start_line: { type: 'number' }, end_line: { type: 'number' } }, required: ['path'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a full file.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'str_replace_editor',
      description: 'Exact one-occurrence replacement editor.',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string' }, old_str: { type: 'string' }, new_str: { type: 'string' } },
        required: ['file_path', 'old_str', 'new_str']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit with fallback: str_replace -> udiff -> rewrite.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          old_str: { type: 'string' },
          new_str: { type: 'string' },
          patch: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bash_execute',
      description: 'Run shell command with approval gate.',
      parameters: { type: 'object', properties: { command: { type: 'string' }, description: { type: 'string' } }, required: ['command'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search web using DuckDuckGo Lite.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, num_results: { type: 'number' } }, required: ['query'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in directory.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'repo_map',
      description: 'Create compact repository map with signatures.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, includeSignatures: { type: 'boolean' }, maxFiles: { type: 'number' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_validators',
      description: 'Run lint + tests after edits.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Add memory pointers to MEMORY.md.',
      parameters: {
        type: 'object',
        properties: {
          pointers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { category: { type: 'string' }, content: { type: 'string' } },
              required: ['category', 'content']
            }
          }
        },
        required: ['pointers']
      }
    }
  }
];

export async function executeTool(name, args = {}) {
  switch (name) {
    case 'read_file': return read_file(args);
    case 'write_file': return write_file(args);
    case 'str_replace_editor': return str_replace_editor(args);
    case 'edit_file': return edit_file(args);
    case 'bash_execute': return bash_execute(args);
    case 'web_search': return web_search(args);
    case 'list_files': return list_files(args);
    case 'repo_map': return build_repo_map(args);
    case 'run_validators': return run_validators();
    case 'update_memory': return updateMemory(args.pointers || []);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
