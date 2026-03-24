# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude AI generates/modifies code using structured tool calls against a virtual file system, with live sandboxed preview.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Run all tests
npm test

# Lint
npm run lint

# Database reset (destructive)
npm run db:reset
```

**Single test file:**
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

**Database inspection:**
```bash
npx prisma studio
```

## Architecture

### Core Data Flow

```
User Chat Input
  → /api/chat (streaming, Vercel AI SDK)
  → Claude (or MockLanguageModel fallback)
  → Tool calls: str_replace_editor / file_manager
  → VirtualFileSystem (in-memory)
  → FileSystemContext → PreviewFrame (sandboxed iframe with import maps)
```

### Key Modules

**`src/lib/`** — Business logic:
- `virtual-file-system.ts`: In-memory file store; all component code lives here, never on disk
- `jsx-transformer.ts`: Babel-based JSX compilation + import map generation for browser execution
- `provider.ts`: Abstracts Anthropic vs. MockLanguageModel; falls back when `ANTHROPIC_API_KEY` is absent
- `auth.ts`: JWT session management via cookies

**`src/lib/contexts/`** — Global state:
- `ChatContext`: AI message state, submission, streaming
- `FileSystemContext`: Virtual FS state, synchronized with AI tool call results

**`src/app/api/chat/route.ts`** — Main streaming endpoint:
- Processes AI tool calls (`str_replace_editor`, `file_manager`)
- Persists projects to SQLite via Prisma for authenticated users

**`src/components/`** — UI:
- `chat/`: `ChatInterface`, `MessageList`, `MessageInput`
- `editor/`: `CodeEditor` (Monaco), `FileTree`
- `preview/`: `PreviewFrame` — renders components in a sandboxed iframe using blob URLs

### Database

Prisma with SQLite (`prisma/dev.db`). Two models: `User` (email/bcrypt password) and `Project` (stores messages and file data as JSON). Projects support anonymous users (`userId` is optional).

### AI Tool Interface

Claude interacts with the virtual file system through two tools defined in the API route:
- `str_replace_editor`: Create or patch file content
- `file_manager`: Rename/delete files

### Environment

`ANTHROPIC_API_KEY` in `.env` enables real AI generation. Without it, the app uses `MockLanguageModel` as a static fallback — all other functionality remains intact.

### Node Compatibility

`node-compat.cjs` patches `globalThis.localStorage`/`sessionStorage` for Node 25+ SSR compatibility. It is required at runtime.

## Code Style

Use comments sparingly — only for complex or non-obvious logic. Self-explanatory code should not be commented.
