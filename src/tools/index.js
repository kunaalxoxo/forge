import { read_file, write_file, list_files } from './file.js';
import { str_replace_editor } from './editor.js';
import { bash_execute } from './shell.js';
import { web_search } from './search.js';
import { updateMemory } from '../memory/index.js';

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file with optional line ranges',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          start_line: { type: 'number' },
          end_line: { type: 'number' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'str_replace_editor',
      description: 'Surgically replace a string in a file. Verification included.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          old_str: { type: 'string' },
          new_str: { type: 'string' }
        },
        required: ['file_path', 'old_str', 'new_str']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bash_execute',
      description: 'Execute a terminal command with description',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          num_results: { type: 'number' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Update MEMORY.md with new facts or pointers',
      parameters: {
        type: 'object',
        properties: {
          pointers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: ['ARCH', 'PREF', 'BUG', 'TODO', 'CONTEXT'] },
                content: { type: 'string' }
              }
            }
          }
        },
        required: ['pointers']
      }
    }
  }
];

export async function executeTool(name, args) {
  switch (name) {
    case 'read_file': return await read_file(args);
    case 'write_file': return await write_file(args);
    case 'str_replace_editor': return await str_replace_editor(args);
    case 'bash_execute': return await bash_execute(args);
    case 'web_search': return await web_search(args);
    case 'list_files': return await list_files(args);
    case 'update_memory': return await updateMemory(args.pointers);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
