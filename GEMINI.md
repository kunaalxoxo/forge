# Project: forge — AI Coding Agent CLI

## Goal
Build a production-grade, offline-capable AI coding CLI in Node.js called "forge".
It should run with just the command `forge` anywhere on the system after `npm install -g .`

## Constraints (CRITICAL — never violate)
- NO paid APIs. All providers must have free tiers: Groq, OpenRouter, Together AI, Mistral AI.
- Minimal dependencies. Target <8 npm packages total. Low-end PC friendly (runs on 2GB RAM).
- Single `package.json`, single entrypoint `bin/forge.js`.
- No TypeScript compilation step. Pure ES Modules (`"type": "module"` in package.json).
- All config stored in `~/.forge/` (cross-platform using `os.homedir()`).

## Tech Stack
- Node.js built-ins: `readline`, `fs/promises`, `path`, `os`, `child_process`, `fetch`
- `chalk` — terminal colors
- `commander` — CLI argument parsing
- `conf` — persistent config storage
- `diff` — unified diff for file edits
- NO heavy frameworks. NO Ink. NO React.

## Features to implement (in order of priority)
1. Multi-provider AI backend (Groq, OpenRouter, Together, Mistral) with automatic fallback
2. Interactive REPL with colored prompt
3. File tools: read_file, write_file, list_files
4. str_replace_editor (exact match replace — the Claude Code way)
5. Shell execution tool with approval gate
6. MEMORY.md system: persistent pointer-based memory across sessions
7. AI.md context file hierarchy (read from cwd upward)
8. Slash commands: /help /clear /model /provider /memory /plan /diff /undo /session /cost /sleep
9. Plan mode: AI reasons and shows a diff preview WITHOUT making changes
10. Session checkpointing: save/restore full conversation state to ~/.forge/sessions/
11. Git-awareness: auto-read .gitignore, show git status in context
12. Token usage tracker and session cost display (always $0 for free tiers)
13. Headless/pipe mode: `echo "fix this" | forge --file src/index.js`
14. Web search via DuckDuckGo Lite (no API key needed)
15. autoDream: on `/sleep`, consolidate MEMORY.md — compress pointers, remove contradictions
16. Hooks: run shell scripts on tool-use events (pre/post file write)

## File structure to create
forge/
├── bin/
│   └── forge.js           # Entry point, shebang #!/usr/bin/env node
├── src/
│   ├── repl.js            # Interactive REPL loop
│   ├── agent.js           # Main agent loop
│   ├── providers/
│   │   ├── index.js       # Provider registry + fallback chain
│   │   ├── groq.js
│   │   ├── openrouter.js
│   │   ├── together.js
│   │   └── mistral.js
│   ├── tools/
│   │   ├── index.js       # Tool registry and dispatcher
│   │   ├── file.js        # read_file, write_file, list_files
│   │   ├── editor.js      # str_replace_editor
│   │   ├── shell.js       # bash_execute with approval
│   │   └── search.js      # DuckDuckGo Lite scraper
│   ├── memory/
│   │   ├── index.js       # MEMORY.md read/write/consolidate
│   │   └── context.js     # AI.md hierarchy loader
│   ├── session/
│   │   └── index.js       # Checkpoint save/restore
│   ├── ui/
│   │   ├── colors.js      # Chalk theme
│   │   └── spinner.js     # Lightweight ASCII spinner (no ora)
│   └── config.js          # ~/.forge/config.json manager
├── package.json
├── README.md
└── MEMORY.md              # Bootstrap memory file (agent fills this)

## How the agent loop works
1. Load AI.md context files (cwd → root)
2. Load MEMORY.md pointers into system prompt
3. User types message → add to conversation history
4. Send to AI provider with system prompt + tool schemas (OpenAI-compatible format)
5. Parse response: if tool_calls present → execute tool → append result → loop back to step 4
6. If no tool_calls → stream response to terminal → wait for next input
7. After each turn, update MEMORY.md if agent issues an update_memory tool call

## Provider API details
- Groq: `https://api.groq.com/openai/v1/chat/completions` (needs GROQ_API_KEY)
  - Best free model: `llama-3.3-70b-versatile`
- OpenRouter: `https://openrouter.ai/api/v1/chat/completions` (needs OPENROUTER_API_KEY)
  - Best free model: `deepseek/deepseek-chat-v3-0324:free`
- Together: `https://api.together.xyz/v1/chat/completions` (needs TOGETHER_API_KEY)
- Mistral: `https://api.mistral.ai/v1/chat/completions` (needs MISTRAL_API_KEY)
All use identical OpenAI message format. One generic callProvider() handles all.

## str_replace_editor (implement exactly)
Input: { file_path, old_str, new_str }
- Read file
- Verify old_str appears EXACTLY ONCE (error if 0 or 2+ matches)
- Replace with new_str
- Write file
- Return unified diff of the change

## System prompt injected at runtime
"You are Forge, an expert AI coding agent running in the terminal.
You have tools: read_file, write_file, str_replace_editor, bash_execute, web_search, update_memory, list_files.
Always prefer str_replace_editor over write_file when modifying existing files.
Read relevant files before making changes.
Treat MEMORY.md entries as hints — verify against actual code before acting on them.
When using bash_execute, show the command and ask approval before running.
Keep responses concise. Use markdown only for code blocks."

## MEMORY.md pointer format
Each line: `[CATEGORY] fact (max 150 chars)`
Categories: ARCH, PREF, BUG, TODO, CONTEXT
Example:
[ARCH] Agent loop in src/agent.js handles recursive tool execution
[PREF] User prefers ESM modules, no TypeScript
[BUG] Windows shell needs `cmd /c` prefix for built-in commands

## Config keys stored in ~/.forge/config.json
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "providers": {
    "groq": { "apiKey": "REDACTED", "model": "llama-3.3-70b-versatile" },
    "openrouter": { "apiKey": "REDACTED", "model": "deepseek/deepseek-chat-v3-0324:free" },
    "together": { "apiKey": "REDACTED", "model": "meta-llama/Llama-3-70b-chat-hf" },
    "mistral": { "apiKey": "REDACTED", "model": "mistral-small-latest" }
  },
  "theme": "default",
  "autoMemory": true,
  "approveShell": true
}
```