# Quick Reference - UI & Tools Update

## 🎨 Design System

### Colors
```css
--black: #000000           /* Background */
--emerald-400: #34d399     /* Primary accent */
--zinc-100: #f4f4f5         /* Primary text */
--zinc-500: #71717a         /* Secondary text */
--zinc-900: #18181b         /* Borders */
--red-400: #f87171          /* Errors */
```

### Typography
```css
.heading    { font-weight: 300; letter-spacing: 0.05em; }
.body       { font-weight: 300; }
.technical  { font-family: monospace; font-size: 0.75rem; }
```

### Components
```tsx
// Card
<Card className="bg-black border border-zinc-900 hover:border-emerald-500/30 p-6" />

// Button (Primary)
<Button className="bg-black border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10" />

// Badge
<Badge className="bg-black/40 text-emerald-400 border-emerald-500/50 font-mono text-xs" />
```

## 🌐 Web Tools

### searchWeb
```typescript
await searchWeb({
  query: "Next.js 15 best practices",
  maxResults: 10
});
// Returns: { results: [...], count, message }
```

### scrapeWebPage
```typescript
await scrapeWebPage({
  url: "https://docs.example.com",
  extractLinks: true
});
// Returns: { title, content, links }
```

### fetchJSON
```typescript
await fetchJSON({
  url: "https://api.example.com/data",
  method: "GET",
  headers: { "Authorization": "..." }
});
// Returns: { data, status }
```

### downloadFile
```typescript
await downloadFile({
  url: "https://example.com/file.json",
  destination: "./config/file.json"
});
// Returns: { size, message }
```

## 🛠️ All Tools (40+)

### File Operations
- `readFile` - Read contents
- `writeFile` - Create/update
- `deleteFile` - Remove
- `moveFile` - Rename/move
- `listFiles` - List directory
- `fileTree` - Tree view
- `createDirectory` - Make dirs
- `searchCode` - Search with ripgrep

### Code Intelligence
- `getProblems` - All diagnostics
- `getCodeActions` - Quick fixes
- `applyCodeAction` - Apply fix
- `goToDefinition` - Find definition
- `findReferences` - Find usages
- `searchSymbols` - Search by name
- `getHover` - Type info
- `formatDocument` - Auto-format

### Execution
- `runCommand` - Shell commands
- `runInTerminal` - VS Code terminal
- `gitCommit` - Commit changes
- `gitPush` - Push commits

### Web & Research
- `searchWeb` ✨ - Search internet
- `scrapeWebPage` ✨ - Extract content
- `fetchJSON` ✨ - API calls
- `downloadFile` ✨ - Get files
- `webResearch` - Research agent
- `editCode` - Code editing agent

## 📝 Common Patterns

### Research Then Implement
```typescript
// 1. Research
const docs = await searchWeb({ query: "Feature best practices" });
const content = await scrapeWebPage({ url: docs.results[0].url });

// 2. Implement
await editCode({
  instruction: `Implement following: ${content.content}`,
  files: [...]
});
```

### API Integration
```typescript
// 1. Check API
const schema = await fetchJSON({ url: "api.com/schema" });

// 2. Download types
await downloadFile({ 
  url: "api.com/types.ts",
  destination: "./types/api.ts" 
});

// 3. Implement
await writeFile({ path: "./lib/api.ts", content: client });
```

### Documentation-Driven
```typescript
// 1. Find docs
const results = await searchWeb({ query: "Official docs" });

// 2. Read docs
const guide = await scrapeWebPage({ url: results.results[0].url });

// 3. Apply
await editCode({
  instruction: `Follow: ${guide.content}`,
  files: [...]
});
```

## ✅ Checklist

### UI Components
- [ ] Background is `bg-black`
- [ ] Borders are `border-zinc-900`
- [ ] Text uses `font-light`
- [ ] Technical info uses `font-mono`
- [ ] Emerald for primary actions
- [ ] No gradients
- [ ] No shadows (except focus)

### Agent Tools
- [ ] File operations work
- [ ] Code intelligence works
- [ ] Web search enabled
- [ ] Web scraping works
- [ ] API calls functional
- [ ] File downloads work

## 📚 Documentation

- `/UI_AND_TOOLS_UPDATE.md` - Full update details
- `/docs/DESIGN_SYSTEM.md` - Design guidelines
- `/COMPLETE_UPDATE_SUMMARY.md` - Complete summary
- `/BEFORE_AFTER_COMPARISON.md` - Visual comparison
- `/QUICK_REFERENCE.md` - This guide

## 🚀 Quick Start

### Use New UI
1. Go to `/dashboard/agents`
2. See clean black design
3. Create agent
4. Notice emerald accents

### Use Web Tools
```
User: "Research and implement feature X"

Agent:
- searchWeb("Feature X best practices")
- scrapeWebPage(documentation)  
- Implements with learned knowledge
```

## 💡 Tips

1. **Consistent Design**: Always use the new color system
2. **Web Tools**: Use for research before implementing
3. **Monospace**: Use for all technical text (paths, code, etc.)
4. **Light Weight**: Typography should be font-light
5. **Clean Borders**: Single pixel, no effects

---

**Everything you need to use the new UI and tools** ✨