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
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
          start_line: { type: 'number', description: 'Optional: Start line number' },
          end_line: { type: 'number', description: 'Optional: End line number' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with new content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path where the file should be saved' },
          content: { type: 'string', description: 'Complete text content for the file' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'str_replace_editor',
      description: 'Surgically replace an exact string in a file with a new string',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file to modify' },
          old_str: { type: 'string', description: 'The exact literal string to find' },
          new_str: { type: 'string', description: 'The string to replace it with' }
        },
        required: ['file_path', 'old_str', 'new_str']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bash_execute',
      description: 'Execute a terminal command with a clear description of its purpose',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run' },
          description: { type: 'string', description: 'Explanation of what this command does' }
        },
        required: ['command', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo to find information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string' },
          num_results: { type: 'number', description: 'Number of results to return (default 5)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files in a directory to understand project structure',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to current dir)' },
          recursive: { type: 'boolean', description: 'Whether to list files in subdirectories' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_memory',
      description: 'Update the persistent MEMORY.md file with new facts or project pointers',
      parameters: {
        type: 'object',
        properties: {
          pointers: {
            type: 'array',
            description: 'Array of memory entries to add',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: ['ARCH', 'PREF', 'BUG', 'TODO', 'CONTEXT'], description: 'Category of the fact' },
                content: { type: 'string', description: 'The factual statement (max 150 chars)' }
              },
              required: ['category', 'content']
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
