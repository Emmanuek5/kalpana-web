# Mini Browser Feature

## Overview

The Mini Browser allows you to view web applications running inside the container directly within VS Code. This solves the problem of container ports not being accessible from the host machine's browser.

## Features

- **Embedded Browser**: Full browser experience inside VS Code
- **Navigation Controls**: Back, forward, refresh buttons
- **URL Bar**: Navigate to any localhost port or external URL
- **Quick Access Buttons**: Pre-configured buttons for common ports
- **History Management**: Navigate through browsing history
- **Status Bar Integration**: Quick access from the status bar

## Usage

### Opening the Browser

**Method 1: Command Palette**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Kalpana: Open Mini Browser"
3. Press Enter

**Method 2: Keyboard Shortcut**
- Press `Ctrl+K Ctrl+B` (or `Cmd+K Cmd+B` on Mac)

**Method 3: Status Bar**
- Click the "🌐 Browser" button in the status bar (bottom right)

### Opening a Specific Port

**Method 1: Command Palette**
1. Press `Ctrl+Shift+P`
2. Type "Kalpana: Open Port in Browser"
3. Enter the port number (e.g., `3000`)

**Method 2: Keyboard Shortcut**
- Press `Ctrl+K Ctrl+P` (or `Cmd+K Cmd+P` on Mac)
- Enter the port number

### Quick Access Ports

The browser includes quick access buttons for common development ports:

- **:3000** - Common for React, Next.js
- **:3001** - Alternative dev server
- **:4000** - GraphQL, Apollo
- **:5000** - Flask, Express
- **:5173** - Vite dev server
- **:8000** - Django, FastAPI
- **:8080** - Common HTTP server

Click any button to instantly navigate to that port.

## Navigation

### Toolbar Controls

- **← (Back)**: Go to previous page in history
- **→ (Forward)**: Go to next page in history
- **↻ (Refresh)**: Reload current page
- **URL Bar**: Enter any URL and press Enter or click "Go"

### Keyboard Shortcuts

- **Enter** in URL bar: Navigate to entered URL
- **Ctrl+K Ctrl+B**: Open/focus browser
- **Ctrl+K Ctrl+P**: Open specific port

## Common Use Cases

### 1. Viewing a React Development Server

```bash
# In terminal, start your dev server
npm run dev
# Server starts on http://localhost:3000
```

Then:
1. Open Mini Browser (`Ctrl+K Ctrl+B`)
2. Click the `:3000` quick access button
3. View your app directly in VS Code

### 2. Testing API Endpoints

```bash
# Start your API server
python app.py
# Server starts on http://localhost:5000
```

Then:
1. Open Mini Browser
2. Navigate to `http://localhost:5000/api/endpoint`
3. View JSON responses inline

### 3. Viewing Documentation Sites

```bash
# Start documentation server
mkdocs serve
# Server starts on http://localhost:8000
```

Then:
1. Open Mini Browser
2. Click `:8000` button
3. Browse documentation while coding

## Technical Details

### How It Works

The Mini Browser uses VS Code's Webview API to create an embedded iframe that can access `localhost` URLs inside the container. Since the browser runs in the same network context as the container, it can access ports that aren't exposed to the host machine.

### Security

The iframe uses the following sandbox permissions:
- `allow-same-origin`: Required for localhost access
- `allow-scripts`: Enables JavaScript in web apps
- `allow-forms`: Enables form submissions
- `allow-popups`: Allows modal dialogs
- `allow-modals`: Enables alert/confirm dialogs

### Limitations

1. **Cross-Origin Restrictions**: Some sites may block iframe embedding
2. **No Browser Extensions**: The embedded browser doesn't support extensions
3. **Limited DevTools**: Use VS Code's built-in DevTools instead
4. **Session Isolation**: Each browser instance has its own session

## Troubleshooting

### Port Not Loading

**Problem**: Browser shows "Connection refused" or blank page

**Solutions**:
1. Verify the server is running: Check terminal output
2. Confirm the port number is correct
3. Try refreshing the page (↻ button)
4. Check if the server is bound to `0.0.0.0` (not just `127.0.0.1`)

### Page Not Updating

**Problem**: Changes in code don't appear in browser

**Solutions**:
1. Click the Refresh button (↻)
2. Check if hot-reload is enabled in your dev server
3. Clear browser cache by closing and reopening the panel

### CORS Errors

**Problem**: API requests fail with CORS errors

**Solutions**:
1. Configure your API server to allow `localhost` origins
2. Use a proxy in your development setup
3. Add CORS headers to your API responses

### Slow Loading

**Problem**: Pages load slowly or timeout

**Solutions**:
1. Check container resource limits
2. Reduce bundle size in development
3. Use production builds for better performance
4. Increase timeout in your dev server config

## Tips & Best Practices

### 1. Multiple Browsers

You can open multiple browser panels side-by-side:
- Open first browser: `Ctrl+K Ctrl+B`
- Split editor: `Ctrl+\`
- Open second browser in new pane

### 2. Persistent URLs

The browser remembers the last URL you visited. When you reopen it, it will navigate to that URL automatically.

### 3. External URLs

While designed for localhost, the browser can also open external URLs:
- Documentation sites
- API references
- GitHub pages
- Any public website

### 4. Development Workflow

Recommended layout:
```
┌─────────────┬─────────────┐
│   Editor    │   Browser   │
│             │             │
│  code.tsx   │ localhost:  │
│             │    3000     │
├─────────────┴─────────────┤
│       Terminal            │
│   npm run dev             │
└───────────────────────────┘
```

## Integration with Kalpana

The Mini Browser integrates seamlessly with other Kalpana features:

- **AI Agent**: Agent can suggest opening specific ports
- **Diagnostics**: View runtime errors in context
- **Checkpoints**: Test different versions of your app
- **Git Integration**: Preview changes before committing

## Future Enhancements

Planned features:
- [ ] DevTools integration
- [ ] Network request inspection
- [ ] Console output capture
- [ ] Screenshot capability
- [ ] Responsive design testing
- [ ] Multiple viewport sizes
- [ ] Browser history persistence
- [ ] Bookmark management

## Feedback

Have suggestions or issues? Please report them in the Kalpana repository.
