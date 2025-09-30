# Kalpana VS Code Extension - Quick Start

## ✅ Currently Implemented

### 1. **Diagnostics Bridge**

Exports all VS Code problems to AI agent every 2 seconds.

```typescript
// AI can call
await getProblems({ severity: "error" })

// Returns
{
  count: 5,
  problems: [
    {
      file: "src/app.ts",
      line: 42,
      severity: "error",
      message: "Property 'foo' does not exist",
      source: "ts"
    }
  ]
}
```

### 2. **Clickable File Links**

AI mentions `src/app.ts:42` → User clicks → Opens in VS Code at line 42

**How it works:**

1. Frontend detects file paths with regex
2. Renders as clickable buttons
3. Sends postMessage to VS Code iframe
4. Extension handles `kalpana.openFile` command
5. Opens file and jumps to line

---

## 🚀 Test It Out

**After rebuilding the Docker image:**

1. **Test File Opening:**

   ```
   User: "What's in src/app.ts?"
   AI: "Let me check src/app.ts..."
   ```

   → Click the `src/app.ts` link
   → VS Code opens the file!

2. **Test Problems:**
   ```
   User: "Are there any errors?"
   AI: [calls getProblems()]
   AI: "I found 2 errors:
        - src/app.ts:42 - Missing semicolon
        - src/utils.ts:15 - Undefined variable"
   ```
   → Click `src/app.ts:42`
   → Jumps right to the error!

---

## 📋 Next Features to Build

See `IDEAS.md` for full list. Top priorities:

1. **Code Actions** - AI applies quick fixes
2. **Symbol Navigation** - AI finds definitions/references
3. **Formatting** - AI formats code with workspace config
4. **Git Integration** - AI sees diffs, blame, status
5. **Refactoring** - AI safely renames across project

Each feature follows the same pattern:

1. Add command to `extension.ts`
2. Add command type to `agent-bridge/server.ts`
3. Add method to `container-api.ts`
4. Add tool to `agent-tools.ts`

---

## 🛠️ Development

**Build extension:**

```bash
cd kalpana/container/vscode-extension
bun install
bun run compile
```

**Test locally:**

```bash
# Rebuild Docker image
cd kalpana
docker build -t kalpana-workspace:latest container/

# Start a workspace
# Extension auto-installs on startup
```

**Check if working:**

```bash
# Inside container
ls /tmp/kalpana-diagnostics.json

# Should show diagnostics JSON
cat /tmp/kalpana-diagnostics.json
```

---

## 🎯 Architecture

```
┌─────────────────────────────────┐
│ VS Code Extension               │
│ • Collects diagnostics          │
│ • Handles commands              │
│ • Writes to /tmp files          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Agent Bridge                    │
│ • Reads /tmp files              │
│ • Executes code-server commands │
│ • Returns results to AI         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ AI Agent                        │
│ • Calls tools                   │
│ • Gets VS Code data             │
│ • Takes actions                 │
└─────────────────────────────────┘
```

---

This extension is the foundation for making the AI a true pair programmer! 🚀



