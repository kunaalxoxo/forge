# ⚒ Forge

Forge is a production-grade, offline-capable AI coding CLI designed to be fast, lightweight, and efficient.

## Features
- Multi-provider support (Groq, OpenRouter, Together, Mistral)
- Automatic fallback chain
- Interactive REPL with colored output
- Surgical file editing with unified diffs
- Smart memory system (MEMORY.md)
- Context awareness (AI.md hierarchy)

## Installation
```bash
npm install -g .
```

## Setup
Run the setup wizard to configure your API keys:
```bash
forge setup
```

## Usage
- **Interactive REPL:** `forge`
- **Single Prompt:** `forge "fix the bug in src/index.js"`
- **With Context:** `forge --file src/config.js "summarize this"`

## Slash Commands
- `/help` - Show all commands
- `/plan` - Toggle plan mode
- `/memory` - View or clear memory
- `/session` - Save/load session history
- `/sleep` - Consolidate memory

## Providers
Forge uses free-tier APIs from:
- [Groq](https://console.groq.com)
- [OpenRouter](https://openrouter.ai/keys)
- [Mistral AI](https://console.mistral.ai)
- [Together AI](https://api.together.xyz)
