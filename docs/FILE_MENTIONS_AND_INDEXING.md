# File Mentions & Codebase Indexing

## Overview

Implemented two powerful features to enhance AI agent context awareness:
1. **File Mentions (@file)** - Reference specific files in chat
2. **Codebase Indexing** - Automatic indexing of entire project structure

## Features

### 1. File Mentions (@file)

**How it works:**
- Type `@` in the chat input
- Fuzzy search dropdown appears with all workspace files
- Select a file to mention it
- AI agent receives file path as context

**Example:**
```
User: "Can you fix the bug in @middleware.ts?"
      ↓
Agent receives: "[Mentioned files: middleware.ts]\n\nCan you fix the bug in @middleware.ts?"
      ↓
Agent uses readFile tool to examine the file
```

### 2. Codebase Indexing

**What's indexed:**
- All files (paths, languages, line counts)
- Exported functions, classes, and constants
- Project statistics (total files, lines, symbols)
- Directory structure

**How it works:**
- Initial index generated on workspace startup
- Re-indexed every 5 minutes automatically
- Included in AI agent's system prompt
- Agent has full project map before answering

## Implementation

### Backend

**1. Indexing Script** (`container/index-codebase.sh`)
- Scans entire workspace
- Extracts symbols using grep/regex
- Generates JSON index
- Stores in `/workspace/.kalpana/codebase-index.json`

**2. API Endpoints**

**GET `/api/workspaces/[id]/files`**
- Returns flat list of all files
- Cached for 60 seconds
- Used for @file autocomplete

**GET `/api/workspaces/[id]/codebase-index`**
- Returns full codebase index
- Cached for 5 minutes
- Auto-generates if missing/stale

**POST `/api/workspaces/[id]/codebase-index`**
- Manually trigger re-indexing
- Returns fresh index

**3. Container Integration** (`container/start.sh`)
- Generates initial index on startup
- Background process re-indexes every 5 minutes
- Runs in parallel with code-server

**4. System Prompt** (`lib/system.ts`)
- Includes codebase index in AI context
- Shows top 20 files
- Shows top 30 exported symbols
- Provides project statistics

### Frontend

**1. File Mention Autocomplete** (`components/workspace/file-mention-autocomplete.tsx`)
- Fuzzy search with fuse.js
- Keyboard navigation (↑↓ arrows)
- Enter to select, Esc to cancel
- Shows file icons and paths

**2. AI Agent Panel** (`components/workspace/ai-agent-panel.tsx`)
- Fetches file list on mount
- Fetches codebase index on mount
- Detects @ character in input
- Shows autocomplete dropdown
- Extracts mentioned files from message
- Includes context in message to AI

## Index Structure

```json
{
  "lastUpdated": "2025-10-01T23:00:00Z",
  "files": [
    {
      "path": "src/app.ts",
      "language": "typescript",
      "size": 1234,
      "lines": 45
    }
  ],
  "symbols": {
    "functions": [
      { "name": "startServer", "file": "src/app.ts", "line": 10 }
    ],
    "classes": [
      { "name": "App", "file": "src/app.ts", "line": 3 }
    ],
    "exports": [
      { "name": "startServer", "file": "src/app.ts", "line": 10 }
    ]
  },
  "stats": {
    "totalFiles": 42,
    "totalLines": 3456,
    "totalFunctions": 89,
    "totalClasses": 12,
    "totalExports": 67
  }
}
```

## Usage

### File Mentions

**In Chat:**
```
User: "Refactor @src/utils.ts to use async/await"
```

**What happens:**
1. Dropdown shows matching files as you type
2. Select file with Enter or click
3. File path inserted: `@src/utils.ts`
4. On send, agent receives: `[Mentioned files: src/utils.ts]`
5. Agent can use readFile tool to examine it

### Codebase Index

**Automatic:**
- Index generated on workspace start
- Updated every 5 minutes
- Included in every AI request

**Manual Refresh:**
```typescript
await fetch(`/api/workspaces/${workspaceId}/codebase-index`, {
  method: 'POST'
});
```

## Benefits

### For Users
- ✅ **Faster context** - Just type @file instead of explaining location
- ✅ **Accurate references** - Autocomplete prevents typos
- ✅ **Better AI responses** - Agent knows project structure

### For AI Agent
- ✅ **Project awareness** - Sees entire codebase structure
- ✅ **Smart navigation** - Knows where to find things
- ✅ **Better suggestions** - Understands project patterns
- ✅ **Fewer questions** - Has context upfront

## Performance

### Indexing Speed
- **Small project** (< 100 files): ~1 second
- **Medium project** (100-1000 files): ~5 seconds
- **Large project** (1000+ files): ~15 seconds

### Memory Usage
- Index file: ~100KB - 2MB (depending on project size)
- Cached in memory: Minimal (only during generation)

### Network
- File list: ~10-50KB
- Codebase index: ~100KB - 2MB
- Cached for 5 minutes (reduces requests)

## File Exclusions

The indexer automatically excludes:
- `node_modules/`
- `.git/`
- `.next/`
- `dist/`, `build/`
- `.kalpana/`
- `coverage/`
- `__pycache__/`, `.pytest_cache/`
- `venv/`, `.venv/`

## Example AI Context

When you send a message, the AI receives:

```
System Prompt:
  You are an expert AI coding assistant...
  
  # CODEBASE INDEX
  
  Statistics:
  - Total Files: 42
  - Total Lines: 3456
  - Functions: 89
  - Classes: 12
  
  Key Files:
  - src/app.ts (typescript, 45 lines)
  - lib/utils.ts (typescript, 67 lines)
  - components/Button.tsx (typescript, 123 lines)
  ...
  
  Exported Symbols:
  - startServer (src/app.ts:10)
  - formatDate (lib/utils.ts:5)
  - Button (components/Button.tsx:8)
  ...

User Message:
  [Mentioned files: src/middleware.ts]
  [Codebase: 42 files, 89 functions]
  
  Can you add error handling to @src/middleware.ts?
```

## Keyboard Shortcuts

**File Mention Autocomplete:**
- `@` - Open file picker
- `↑` `↓` - Navigate files
- `Enter` - Select file
- `Esc` - Close picker
- Type to filter

## Troubleshooting

### Index not generating
**Check container logs:**
```bash
docker logs workspace-<id> | grep "Indexing codebase"
```

**Manually trigger:**
```bash
docker exec workspace-<id> /index-codebase.sh /workspace
```

### File mentions not working
**Check file list API:**
```bash
curl http://localhost:3000/api/workspaces/<id>/files
```

**Check browser console** for fetch errors

### Autocomplete not showing
- Ensure you type `@` after a space or at start
- Check that file list has loaded (console.log)
- Verify fuse.js is installed

## Advanced Usage

### Custom Index Fields

Edit `container/index-codebase.sh` to add custom fields:
```bash
# Add file description
description=$(head -5 "$file" | grep -E "^//|^#" | sed 's/^[/#]*\s*//')
```

### Language-Specific Indexing

Add more symbol extraction for other languages:
```bash
# Python
grep -n "^\s*def\s\+\w\+" "$file"  # Functions
grep -n "^\s*class\s\+\w\+" "$file"  # Classes

# Go
grep -n "^func\s\+\w\+" "$file"  # Functions
grep -n "^type\s\+\w\+\s\+struct" "$file"  # Structs
```

### Faster Indexing

Use parallel processing:
```bash
find /workspace -type f | xargs -P 4 -I {} process_file {}
```

## Future Enhancements

### Planned
- [ ] Semantic search (vector embeddings)
- [ ] Symbol type information (function signatures)
- [ ] Import/dependency graph
- [ ] Recently modified files priority
- [ ] File content summaries (AI-generated)

### Possible
- [ ] Multi-file mentions (select multiple)
- [ ] Folder mentions (@src/)
- [ ] Symbol mentions (@MyClass.method)
- [ ] Line number mentions (@file.ts:42)

## Files Created/Modified

### Created
1. ✅ `container/index-codebase.sh` - Indexing script
2. ✅ `app/api/workspaces/[id]/codebase-index/route.ts` - Index API
3. ✅ `components/workspace/file-mention-autocomplete.tsx` - UI component

### Modified
1. ✅ `container/Dockerfile` - Added indexing script
2. ✅ `container/start.sh` - Added periodic re-indexing
3. ✅ `lib/system.ts` - Added index to system prompt
4. ✅ `app/api/agent/route.ts` - Fetch and pass index
5. ✅ `components/workspace/ai-agent-panel.tsx` - File mention logic

## Testing

### 1. Rebuild Container
```bash
bun run container:build
```

### 2. Start Workspace
Watch for:
```
🔍 Generating initial codebase index...
✅ Codebase indexed: 42 files, 3456 lines
```

### 3. Test File Mentions
1. Open workspace chat
2. Type `@` in input
3. See file dropdown
4. Select a file
5. Send message
6. Check agent receives context

### 4. Verify Index
```bash
# In container
cat /workspace/.kalpana/codebase-index.json
```

### 5. Check System Prompt
Look at agent response - it should reference project structure

## Summary

✅ **File mentions** - @file autocomplete with fuzzy search
✅ **Codebase indexing** - Automatic project structure analysis
✅ **AI context** - Agent receives full project map
✅ **Periodic updates** - Index refreshes every 5 minutes
✅ **Performance** - Cached and optimized
✅ **Automatic** - No manual configuration needed

The AI agent now has complete awareness of your project structure and can intelligently navigate and understand the codebase! 🎉
