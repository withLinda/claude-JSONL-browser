# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

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