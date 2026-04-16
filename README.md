# forge

Lightweight open-source AI coding CLI (Node.js, ESM, low-memory friendly).

## Features

- Multi-provider backend with fallback: Groq, OpenRouter, Together, Mistral, Ollama
- Readline + chalk terminal UX
- Tool calling (`tool_choice: "auto"`) with streaming responses
- File tools + surgical `str_replace_editor`
- Multi-format edit fallback via `edit_file` (`str_replace -> udiff -> rewrite`)
- Shell tool approval gate with Windows `cmd /c` support
- MEMORY.md pointer memory with `/sleep` autoDream consolidation
- Context hierarchy from `GEMINI.md` and `FORGE.md` (cwd upward)
- Session checkpointing and `/undo`
- Slash commands: `/help /clear /model /provider /provider status /memory /sleep /plan /architect /add /daemon /offline /student /session /cost /undo`

## Install

```bash
npm install
npm link
```

## First-run setup

```bash
forge setup
forge
```

## Notes

- Defaults are tuned for student mode and low-end hardware.
- `/offline` switches provider to local Ollama at `http://localhost:11434`.
- Auto-commit runs after edit tools when Git changes exist.
