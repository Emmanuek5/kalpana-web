# Kalpana Diagnostics Bridge

This VS Code extension runs inside the code-server container and bridges VS Code's diagnostic information (Problems tab) to the Kalpana AI Agent.

## What It Does

1. **Monitors All Diagnostics**: Uses VS Code's `vscode.languages.getDiagnostics()` API to collect all problems from all language servers
2. **Writes to File**: Every 2 seconds, writes diagnostics to `/tmp/kalpana-diagnostics.json`
3. **Real-time Updates**: Listens for diagnostic changes and updates immediately
4. **Complete Coverage**: Captures:
   - TypeScript errors
   - ESLint warnings
   - All language server diagnostics
   - Errors, warnings, info messages, and hints

## Output Format

```json
{
  "timestamp": 1696123456789,
  "count": 5,
  "diagnostics": [
    {
      "file": "src/app.ts",
      "line": 42,
      "column": 10,
      "severity": "error",
      "message": "Property 'foo' does not exist on type 'Bar'.",
      "source": "ts",
      "code": 2339
    }
  ]
}
```

## How AI Agent Uses It

The AI agent can call the `getProblems` tool to retrieve these diagnostics, giving it visibility into exactly what problems exist in the codebase - the same problems the user sees in VS Code.

## Installation

Automatically installed during container startup via `start.sh`:

```bash
code-server --install-extension /vscode-extension
```

## Building

```bash
bun install
bun run compile
```

This compiles the TypeScript to `out/extension.js` which VS Code loads.
