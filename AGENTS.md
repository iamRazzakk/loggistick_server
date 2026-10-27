# Agent instructions

## Do not read these files

Every agent, subagent, and Tab completion must not read:

- `.env` and any other secret env file (`.env.local`, `.env.production`, `.env.development`, and similar)

Do not open them with Read, Grep, or a shell command (`Get-Content`, `type`, `cat`, `rg`, `findstr`, `Select-String`). Do not ask the user to paste their contents.

`.env.example` and `src/config/index.ts` are allowed.

## If a task needs the secret env file

Stop and ask the user to change that file themselves. Do not work around the block.

A project hook (`.cursor/hooks.json`) denies these reads, and `.cursorignore` hides the same files from agent search.
