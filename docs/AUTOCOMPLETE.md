# AI Autocomplete Feature

## Overview

The AI-powered autocomplete feature provides intelligent code completions directly in the VSCode editor using OpenRouter's ultra-fast models.

## Architecture

### Components

1. **VSCode Extension** (`container/vscode-extension/src/autocomplete-provider.ts`)
   - Implements `InlineCompletionItemProvider`
   - Runs inside the container's VSCode instance
   - Uses OpenRouter AI SDK for completions

2. **Configuration API** (`app/api/workspace/[id]/configure-autocomplete/route.ts`)
   - Endpoint to configure autocomplete for a workspace
   - Passes user's OpenRouter API key to the extension

3. **Extension Config Utility** (`lib/vscode-extension-config.ts`)
   - Helper to communicate with VSCode extension via WebSocket
   - Sends API key and model configuration

## How It Works

1. **Initialization**
   - When workspace starts, the VSCode extension activates
   - Extension registers an inline completion provider for all file types
   - Waits for API key configuration

2. **Configuration**
   - Frontend calls `/api/workspace/[id]/configure-autocomplete`
   - API retrieves user's OpenRouter API key from database
   - Sends configuration to extension via WebSocket (port 3002)
   - Extension stores API key and model preference

3. **Completion Flow**
   - User types in editor
   - VSCode triggers completion provider
   - Provider captures context (prefix/suffix code)
   - Sends request to OpenRouter with ultra-fast model
   - Returns completion as inline suggestion
   - User accepts with Tab or continues typing

## Models

### Default Model
- **google/gemini-flash-1.5-8b**: Ultra-fast, optimized for code completion
  - Low latency (~200-500ms)
  - Good code understanding
  - Cost-effective

### Alternative Fast Models
- `google/gemini-flash-1.5`: Slightly more capable
- `anthropic/claude-3-haiku`: Good for complex completions
- `meta-llama/llama-3.1-8b-instruct`: Open source option

## Configuration

### Setting Up Autocomplete

#### Option 1: Automatic (Recommended)
Call the configuration endpoint when workspace starts:

```typescript
// In workspace startup code
await fetch(`/api/workspace/${workspaceId}/configure-autocomplete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'google/gemini-flash-1.5-8b' // optional
  })
});
```

#### Option 2: Manual via WebSocket
```typescript
import { configureAutocomplete } from '@/lib/vscode-extension-config';

await configureAutocomplete(
  'your-openrouter-api-key',
  'google/gemini-flash-1.5-8b'
);
```

### Changing the Model

Update the model by calling the configuration endpoint with a different model:

```typescript
await fetch(`/api/workspace/${workspaceId}/configure-autocomplete`, {
  method: 'POST',
  body: JSON.stringify({
    model: 'anthropic/claude-3-haiku'
  })
});
```

## Features

### Context-Aware Completions
- Analyzes up to 50 lines before cursor
- Considers 20 lines after cursor
- Understands file type and language

### Smart Filtering
- Minimum 3 characters before triggering
- Debounced to avoid excessive requests
- Cancellable requests
- Respects VSCode's inline completion settings

### Performance Optimizations
- Low temperature (0.2) for consistent completions
- Max 200 tokens to keep completions focused
- Request caching via debouncing
- Automatic cleanup of markdown formatting

## Usage

### In the Editor

1. **Start typing** - Autocomplete triggers automatically after 3 characters
2. **Wait briefly** - Completion appears as gray text
3. **Accept** - Press `Tab` to accept the suggestion
4. **Reject** - Keep typing or press `Esc` to dismiss

### Keyboard Shortcuts

- `Tab` - Accept inline suggestion
- `Esc` - Dismiss suggestion
- `Ctrl+Space` - Manually trigger (if configured)

## Troubleshooting

### No Completions Appearing

1. **Check API Key**: Ensure OpenRouter API key is configured in user settings
2. **Verify Configuration**: Check `/tmp/kalpana-config.json` in container
3. **Check Logs**: View extension logs in VSCode Output panel (Kalpana)
4. **Network**: Ensure container can reach OpenRouter API

### Slow Completions

1. **Switch Model**: Try a faster model like `gemini-flash-1.5-8b`
2. **Check Network**: Verify internet connection speed
3. **Reduce Context**: Extension automatically limits context window

### Completions Not Relevant

1. **Try Different Model**: Some models work better for specific languages
2. **Provide More Context**: Type more code to give better context
3. **Check File Type**: Ensure file extension is recognized

## API Reference

### POST `/api/workspace/[id]/configure-autocomplete`

Configure autocomplete for a workspace.

**Request Body:**
```json
{
  "model": "google/gemini-flash-1.5-8b" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Autocomplete configured successfully",
  "model": "google/gemini-flash-1.5-8b"
}
```

### WebSocket Command: `updateAutocompleteConfig`

Direct command to extension via WebSocket (port 3002).

**Command:**
```json
{
  "id": "unique-id",
  "type": "updateAutocompleteConfig",
  "payload": {
    "apiKey": "sk-or-v1-...",
    "model": "google/gemini-flash-1.5-8b"
  }
}
```

**Response:**
```json
{
  "id": "unique-id",
  "success": true,
  "data": {
    "message": "Autocomplete config updated"
  }
}
```

## Cost Considerations

### Gemini Flash 1.5 8B Pricing
- Input: ~$0.075 per 1M tokens
- Output: ~$0.30 per 1M tokens

### Typical Usage
- Average completion: ~500 input tokens, ~50 output tokens
- Cost per completion: ~$0.00005 (very low)
- 1000 completions: ~$0.05

### Optimization Tips
1. Use the fastest/cheapest model that works for your needs
2. Completions are debounced to reduce API calls
3. Short max_tokens (200) keeps costs minimal

## Future Enhancements

- [ ] Local caching of common completions
- [ ] Multi-line completion support
- [ ] Function signature completion
- [ ] Import statement suggestions
- [ ] Context from open files
- [ ] Fine-tuned models for specific languages
- [ ] Offline mode with local models

## Development

### Building the Extension

```bash
cd container/vscode-extension
npm install
npm run bundle
```

### Testing

1. Start workspace with VSCode
2. Configure autocomplete via API
3. Open a code file
4. Start typing and observe completions

### Debugging

Enable extension logging:
```typescript
// In extension.ts
console.log("Autocomplete triggered:", { prefix, suffix });
```

View logs in VSCode:
- View → Output
- Select "Kalpana" from dropdown
