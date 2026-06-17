# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Releasing (local, private builds)

This is a Tauri desktop app released as a stand-alone executable, built locally. Versioning is **SemVer** (`X.Y.Z`); `package.json` is the single source of truth and is mirrored into `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.

1. Update `CHANGELOG.md` for the release.
2. Bump the version: `npm version patch` (or `minor` / `major`). This runs `scripts/sync-version.mjs` to propagate the new version into the Tauri/Cargo files, then commits them and creates the `vX.Y.Z` git tag.
3. Build the installer: `npm run release` (= `npm run tauri:build`). The `prebuild` hook regenerates `lib/build-info.ts` (version + git short-hash + build date - shown in the app header), and Tauri emits an installer named with the version under `src-tauri/target/release/bundle/` (NSIS `.exe`, MSI `.msi`).
4. Distribute the installer from `src-tauri/target/release/bundle/`.
5. Push when ready: `git push && git push --tags`.

Notes:
- `lib/build-info.ts` is **generated** (gitignored) and regenerated before every `dev`/`build` via npm `pre*` hooks - never edit or commit it.
- Bump convention: `patch` = fixes/tweaks, `minor` = new user-facing features, `major` = stability/breaking-UX milestone.
- Local `vX.Y.Z` tags do **not** trigger CI - the release-by-tag workflow is deactivated (`workflow_dispatch`-only) while the repo is unlicensed.

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS with custom Everforest dark theme colors
- **Icons**: Lucide React
- **State Management**: React useState hooks (no external state library)

### Key Components

**JsonlConverter.tsx** - Main application component that handles:
- Multi-file JSONL management with unique IDs
- File upload via drag & drop or button
- JSONL to Markdown conversion logic
- Search functionality across all loaded files
- File sorting (by date, name, size)
- Inline file renaming
- Export capabilities (individual or combined markdown)

### JSONL Conversion Logic

The converter specifically handles Claude conversation logs with:
- Session metadata extraction (sessionId, gitBranch, cwd)
- Message type handling: user, assistant, summary
- Special formatting for model changes via `/model` command
- Tool use formatting for assistant responses
- Timestamp preservation and formatting

### Theme System

Uses Everforest dark theme colors defined in tailwind.config.ts:
- Background levels: bg-dim through bg5
- Semantic colors: red, yellow, green, blue, aqua, purple
- Text colors: fg (primary), grey0-2 (secondary)

### File Structure Patterns
- Components use client-side rendering (`'use client'`)
- Utility functions centralized in lib/utils.ts
- Single-page application with all logic in JsonlConverter component
- No API routes or server components beyond Next.js defaults
