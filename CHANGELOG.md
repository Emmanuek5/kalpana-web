# Changelog

All notable changes to Kalpana will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Chat History Persistence** - AI agent conversations are now saved and persist across sessions
  - New `Message` model in database to store chat messages per workspace
  - Messages automatically saved when sent (both user and assistant messages)
  - Chat history loaded when opening a workspace
  - Clear chat history button with confirmation dialog
  - API endpoints for loading, saving, and clearing messages:
    - `GET /api/workspaces/:id/messages` - Load all messages for a workspace
    - `POST /api/workspaces/:id/messages` - Save a message
    - `DELETE /api/workspaces/:id/messages` - Clear all messages for a workspace
  - Messages include all parts (text, tools, reasoning, checkpoints, sources)
- **Diagnostics & Logs Viewer** - Comprehensive debugging tool for troubleshooting workspace issues
  - New "Logs" button in workspace header to view diagnostics
  - Full diagnostics dialog showing:
    - Extension activation status and logs
    - Process status (code-server, agent bridge)
    - Network status (WebSocket port 3002)
    - List of installed VS Code extensions
    - Container logs (last 200 lines)
  - Real-time refresh capability
  - New `/api/workspaces/[id]/diagnostics` endpoint
  - `execInContainer` method to run commands in Docker containers
  - Helps identify extension activation failures and connection issues
- **GitHub Integration** - Connect your GitHub account to work with private repositories
  - OAuth integration for GitHub authentication
  - Automatic Git configuration in containers with user credentials
  - Connect/disconnect GitHub account from settings page
  - GitHub access token securely injected into containers
  - Automatic git user.name and user.email configuration from GitHub profile
  - Support for cloning private repositories
  - Seamless push/pull operations from within containers
  - Visual GitHub connection status in settings with user avatar and profile info
  - Real-time GitHub connection status in workspace creation flow
- **Multi-Step Workspace Creation** - Improved workspace creation with guided wizard
  - Step 1: Basic Information (name and description)
  - Step 2: Template Selection (Node.js, Python, Rust, Go, Full Stack, or Custom)
  - Step 3: GitHub Repository (optional, with connection status indicators)
  - Step 4: Review & Create (summary of all selections with edit options)
  - Visual progress indicator showing completed and current steps
  - Smart navigation with validation between steps
  - Intelligent step skipping for non-applicable options
  - GitHub connection warnings with quick access to settings
  - Repository browser to select from your GitHub repos
  - Client-side search filter for repositories (name, full name, description)
  - Improved spacing and layout for better readability

### Fixed

- **Git User Configuration** - Ensured git user.name and user.email are always set in containers
  - **Priority 1**: Fetch from GitHub API if GitHub connected (existing behavior)
  - **Priority 2**: Use user's account name/email from session (NEW)
  - **Priority 3**: Default to "Kalpana User" / "user@kalpana.local" (NEW)
  - Added `GIT_USER_NAME` and `GIT_USER_EMAIL` environment variables to containers
  - Git commits will now work even without GitHub connection
  - Users can see which source was used in container startup logs
- **AI Agent Message Streaming Issues** - Fixed text being overwritten and tools appearing at wrong positions
  - **Issue 1**: When model sent text → tool → more text, the second text would overwrite the first
  - **Issue 2**: Tool calls always appeared at the bottom instead of in chronological order
  - **Root cause**: Global `currentText` accumulator was not reset between text sections
  - **Solution**: Track current text part index and reset when tool calls start
  - Text deltas now correctly create new text parts after tool calls
  - Messages now display parts in correct chronological order (text, tool, text, etc.)
- **File List API Not Working** - Fixed `/api/workspaces/[id]/files` returning empty results
  - Added new `fileTree` command to agent bridge that recursively builds full file tree
  - Previous `listFiles` command only returned immediate children, not nested structure
  - New command properly excludes `node_modules`, `.git`, `dist`, `build`, `.next`, and hidden files
  - Files endpoint now uses `fileTree` instead of `listFiles`
  - File mention picker (@) in AI chat will now work properly
- **🚨 CRITICAL: VS Code Extension Not Activating** - Fixed "Cannot find module 'ws'" error
  - **Root cause**: `vsce package` doesn't bundle node_modules by default
  - **Solution**: Added `esbuild` to bundle extension with all dependencies into single file
  - Added `bundle` script to package.json using esbuild
  - Updated Dockerfile to use `bun run bundle` instead of `bun run compile`
  - Extension now properly bundles the `ws` WebSocket library into `out/extension.js`
  - This was preventing the extension from activating and starting the WebSocket server on port 3002
  - Extension will now activate successfully and create port forwarding for 3002
- **Diagnostics Dialog Overflow** - Fixed log sections overflowing the modal
  - All log sections now have proper max-height and scrolling
  - Container logs limited to 400px height with scroll
  - Extension activation and other logs limited to 150-200px
  - Added `whitespace-pre-wrap` and `break-words` for better text wrapping
- **VS Code Extension Package** - Added missing `publisher` field to fix "undefined_publisher" issue
- **VS Code Extension Activation Debugging** - Added comprehensive logging to diagnose extension activation issues
  - Extension now logs activation status to `/tmp/kalpana-extension-activated.log`
  - Added top-level module load logging
  - WebSocket server creation wrapped in try-catch with detailed error messages
  - Agent bridge now checks activation log file when connecting
  - Added host binding (`0.0.0.0`) to WebSocket server for better container compatibility
  - Extension shows error dialog in VS Code if WebSocket server fails to start

### Changed

- **Optimized File Mention Picker** - Made file selector more compact and sleek
  - Reduced height from 320px to 200px max
  - Reduced width to 420px for better fit
  - Removed header and footer sections to save space
  - More compact file items with smaller icons (3x3) and text (xs/10px)
  - Positioned directly above input field instead of 330px offset
  - Added glassmorphism with backdrop blur for modern look
  - Improved selection highlighting with emerald accent border
- Updated Better Auth configuration to request `repo` scope for GitHub OAuth
- Enhanced container startup script to configure Git with GitHub credentials
- Modified workspace start API to fetch and inject GitHub access token from user's connected account
- Transformed workspace creation page from single form to guided multi-step wizard
- Improved user experience with step-by-step guidance and validation
- Added reconnect button for GitHub on settings page
- Improved spacing and padding throughout workspace creation flow
- **Completely redesigned workspace page** with futuristic aesthetic
  - Pure black background with subtle gradients and grid patterns
  - Glassmorphism effects with backdrop blur
  - Emerald accent color scheme
  - Removed decorative icons, kept only functional ones
  - Full-width editor with proper iframe rendering
  - Floating AI agent panel (500px overlay)
- **Transformed AI chat to agentic interface** (no traditional chat bubbles)
  - Single-column unified message view
  - Real-time tool invocation rendering
  - Checkpoint system for tracking operations (success/error/pending)
  - Compact, futuristic design with minimal spacing

### Technical Details

- Created `/api/user/github` endpoint for GitHub connection status and disconnection
- Updated `start.sh` to configure git credential helper with GitHub token
- Updated `start.sh` to automatically rebuild Nix environment on container start
  - Detects `/workspace/flake.nix` or `shell.nix`
  - Runs non-interactive rebuild (`nix develop -c true` or `nix-shell --run true`)
  - Non-fatal on failure; container continues to boot
- Fetch GitHub user info via API to set git config automatically
- Store GitHub credentials in `.git-credentials` file in containers for persistent authentication
- Implemented step-based navigation system with progress tracking
- Added conditional step rendering based on template selection
- Enhanced form validation with real-time GitHub status checks
- Created `/api/user/github/repos` endpoint to fetch user repositories
- Added repository browser component with search and selection
- Improved error handling for GitHub connection issues
- Redesigned message rendering system for agentic UI patterns
- Implemented checkpoint system with visual status indicators
- Added tool-specific icons and display formatting
- Optimized layout for modern, minimal aesthetic
- **Migrated to AI SDK v5** tool format
  - Updated from `parameters` to `inputSchema` in tool definitions
  - Changed `toDataStreamResponse()` to `toUIMessageStreamResponse()`
  - Refactored tools into separate `lib/agent-tools.ts` file
  - Uses `convertToCoreMessages()` for message format conversion
  - Improved tool execution return values with context data
- **Added reasoning and sources support**
  - Collapsible reasoning sections with emerald-themed UI
  - Source/citation rendering with clickable links
  - Reasoning token collection via `onChunk` callback
  - `sendReasoning: true` and `sendSources: true` in stream response
  - Stream parsing for `reasoning-delta` and `source` events
  - Beautiful collapsible panels with character counts
  - Link previews for external sources with titles and content
- **Enhanced tool execution visualization**
  - Real-time execution states: "Calling", "Executing", "Executed"
  - Dynamic status indicators with icons (Check, AlertCircle, Loader2)
  - Color-coded borders: emerald (success), red (error), zinc (executing)
  - Collapsible output sections with line counts
  - Abbreviated output previews (150 chars) with expand option
  - Full output view with syntax highlighting and scrolling
  - Input parameter display with truncation for long values
  - Dedicated error section with clear failure messaging
  - Live progress indicators during tool execution
- **Added markdown rendering for AI responses**
  - Full GitHub Flavored Markdown (GFM) support via `remark-gfm`
  - Syntax highlighting for code blocks via `rehype-highlight`
  - Custom styled components for all markdown elements:
    - Inline code: emerald text on zinc-900 background
    - Code blocks: zinc-950 background with zinc-800 border
    - Headings (h1-h3): scaled sizes with zinc-200/300 colors
    - Lists (ul/ol): disc/decimal styling with proper spacing
    - Links: emerald-400 with hover states, opens in new tab
    - Blockquotes: left border with italic styling
    - Tables: bordered with zinc-800, alternating backgrounds
    - Bold/Italic: enhanced contrast for readability
  - Futuristic dark theme matching workspace aesthetic
  - GitHub Dark syntax highlighting theme for code
- **Implemented multi-step AI agent calls**
  - Added `stopWhen: stepCountIs(10)` for automatic continuation after tool execution
  - Agent now provides summaries and context after using tools
  - Updated stream parsing for AI SDK v5 events:
    - `tool-input-start`: Initial tool call indication
    - `tool-input-available`: Complete tool input with parameters
    - `tool-output-available`: Tool execution results
    - `finish-step`: Step completion for multi-step flows
  - Proper state management across multiple agent steps
  - Accumulator resets between steps for clean message handling
  - **Fixed tool call matching** to use `toolCallId` instead of `toolName`
    - Ensures correct tool state updates when multiple tools are called
    - Prevents UI stuck in "Executing..." state
    - Unique identification for each tool invocation
  - **Fixed duplicate checkpoint bug**
    - Added existence check before adding completion checkpoints
    - Prevents multiple "completed" messages for the same tool
  - **Fixed text rendering across steps**
    - Reset text accumulator on `start-step` instead of `finish-step`
    - Allows text to properly accumulate in multi-step flows
    - Text responses now visible after tool execution
  - **Fixed "Processing..." stuck state**
    - Handle `finish` event to properly set `isStreaming` to false
    - UI now correctly shows completion state

### Added

- **Implemented Sub-Agent System**
  - **Web Research Agent** (`lib/agents/web-research-agent.ts`)
    - Autonomous browser automation using Puppeteer
    - Own tool set: goToPage, extractText, clickElement, getLinks, saveFinding
    - Uses `generateObject` for structured decision-making
    - Can perform multi-step web research with scratchpad memory
    - Collects findings with titles, URLs, and summaries
  - **Code Editing Agent** (`lib/agents/code-editing-agent.ts`)
    - Specialized agent for making code changes
    - Own tool set: analyzeCode, planEdit, applyEdit, validateEdit, finishEditing
    - Multi-step editing process with validation
    - Generates unified diffs for all changes
    - Maintains edit history and provides explanations
- **Expanded File Tools**
  - `deleteFile`: Delete files/directories with recursive option
  - `moveFile`: Move or rename files and directories
  - `createDirectory`: Create directories with recursive option
  - `fileTree`: Get tree view of workspace structure
  - `webResearch`: Delegate to web research sub-agent
  - `editCode`: Delegate to code editing sub-agent
- **Sub-Agent Architecture**
  - Sub-agents receive model from main agent for consistency
  - Each sub-agent has its own execution loop and tools
  - Structured output using AI SDK v5 `generateObject`
  - Agents maintain internal state (scratchpad, findings, history)
  - Pattern follows AI SDK best practices for tool calling

### Technical Details

- Installed `puppeteer-core`, `chromium`, and `diff` libraries
- Sub-agents use same model as main agent when available
- Web agent supports Chrome/Chromium on Windows and Linux
- Code editing agent provides complete before/after diffs
- All tools return structured results with success/error states

### Enhanced Agent Bridge

- **Error Tracking System**
  - Console log buffer (stores last 1000 logs)
  - Real-time error broadcasting to all connected clients
  - Support for log levels: log, error, warn, info
  - Automatic capture of process errors and unhandled rejections
- **New Bridge Commands**
  - `getConsoleLogs`: Retrieve filtered console logs with limit
  - `clearConsoleLogs`: Clear log buffer
  - `reportError`: Report errors from client with stack traces
  - `getLintErrors`: Get ESLint errors for files
  - `watchFile`: File watching support (placeholder)
- **Container API Extensions**
  - Added methods for all new bridge commands
  - Type-safe interfaces for error reporting
  - Automatic log level filtering
- **New Agent Tools**
  - `getConsoleLogs`: Agent can retrieve and analyze console errors
  - `getLintErrors`: Agent can check code quality issues

### Clickable File References

- **Automatic File Path Detection**
  - Regex-based detection of file paths in markdown
  - Supports common file extensions (ts, tsx, js, jsx, json, css, etc.)
  - Line number support (e.g., `src/app.ts:42`)
- **Interactive File Links**
  - Click to open files in VS Code editor
  - Visual indicator with FileCode icon
  - Hover effects and tooltips
  - Custom styled buttons integrated with markdown
- **VS Code Integration**
  - Post messages to iframe for file opening
  - Line number navigation support
  - Seamless editor integration

### Container Log Monitoring & Rebuild System

- **Real-time Startup Logs**
  - Container log streaming from DockerManager
  - Parse startup stages from start.sh output
  - Track progress: init → clone → nix → agent → ready
  - Progress bar with percentage indicator
  - Stage-specific messages (e.g., "Cloning repository...", "Starting agent bridge...")
- **API Endpoints**
  - `/api/workspaces/[id]/logs` - Get container logs with parsed status
  - `/api/workspaces/[id]/restart` - Restart workspace (re-runs start.sh)
- **Rebuild Button**
  - "Rebuild" button in header when workspace is running
  - Re-runs start.sh to apply Nix file changes
  - Visual progress overlay during rebuild
  - Auto-refresh editor iframe after rebuild
  - Emerald-themed button to indicate environment action

### Enhanced Workspace UI

- **Improved Header Design**
  - Gradient background (black to zinc-950)
  - Workspace icon with Terminal symbol
  - Better typography with semibold titles
  - Improved spacing and visual hierarchy
- **Startup Progress Display**
  - Animated progress bar during container startup
  - Real-time stage updates from container logs
  - Shows: "Initializing", "Cloning", "Nix Config", "Agent Bridge", "Ready"
  - Auto-hides when workspace is fully running
- **Rebuild Progress Overlay**
  - Toast-style notification at top center
  - Shows rebuild progress with animated bar
  - Real-time status updates from container logs
  - Glassmorphic design with backdrop blur
- **AI Assistant Panel**
  - Enhanced header with Brain icon and pulse indicator
  - Gradient background (black → zinc-950 → black)
  - Better visual hierarchy with "Always ready to help" subtitle
  - Improved border and shadow effects
- **Editor Area**
  - Gradient background (zinc-950 to black)
  - Better integration with VS Code iframe
  - Smoother transitions and loading states

### DockerManager Enhancements

- **New Methods**
  - `getContainerLogs()` - Retrieve container logs with options
  - `streamContainerLogs()` - Stream logs with callback
  - `restartWorkspace()` - Restart container (re-runs start.sh)
  - `execInContainer()` - Execute commands in running container
- **Log Parsing**
  - Detects startup stages from log markers
  - Calculates progress percentage
  - Provides user-friendly status messages
- **Workspace Persistence**
  - Docker named volumes for each workspace
  - Data persists across container restarts
  - Volume naming: `kalpana-workspace-{workspaceId}`
  - Optional volume deletion on workspace destroy

### Improved Tool Execution UI

- **Collapsed by Default**
  - Tool cards show compact view initially
  - Click to expand for full details
  - Shows only "✓ Completed successfully" or "✗ Failed" when collapsed
- **Expandable Details**
  - Input parameters with syntax highlighting
  - Full output in formatted JSON
  - Error messages with stack traces
  - Chevron icon indicates expand/collapse state
- **Better Visual Feedback**
  - Hover effects on completed tools
  - Green for success, red for errors
  - Smooth transitions and animations
  - Clear loading states with spinner

### Enhanced AI Communication

- **Interleaved Responses**
  - AI explains before calling tools
  - AI summarizes after tool execution
  - Natural conversation flow: talk → tool → talk
  - Updated system prompt with communication guidelines
- **Example Flow**
  - User: "Check the login file"
  - AI: "Let me search for the login function" (text)
  - AI: [calls searchCode tool]
  - AI: "I found the login function in src/auth.ts..." (text)

### Button Improvements

- **Rebuild Button**
  - RefreshCw icon for visual clarity
  - Emerald theme (green) for environment actions
  - Font-medium for better readability
  - Hover states with lighter colors
- **Stop Button**
  - X icon for immediate recognition
  - Red theme for destructive action
  - Consistent styling with rebuild button
  - Visual warning through color

### Scrollbar Improvements

- **Agent Panel Scrolling**
  - Only vertical scroll (no horizontal)
  - Ultra-thin scrollbar (4px width)
  - Semi-transparent with hover states
  - Prevents text overflow and layout shifts
- **Custom Scrollbar Styling**
  - Zinc-themed to match UI
  - Smooth transitions
  - Minimal visual footprint

### Streaming Rebuild System

- **Real-time Log Streaming**
  - Server-Sent Events (SSE) for live updates
  - `/api/workspaces/[id]/rebuild` endpoint
  - Streams container logs during restart
  - Shows all log lines in real-time
- **Improved Rebuild UI**
  - Logs displayed in main editor area (not floating modal)
  - Live stage updates: "Stopping container..." → "Streaming logs..." → "Complete!"
  - Scrollable log viewer with monospace font (max-h-96)
  - Auto-refreshes iframe when ready
  - Waits for confirmation from start.sh markers
- **Smart Completion Detection**
  - Monitors for "Starting code-server" marker
  - Monitors for "Agent bridge started" marker
  - Only completes when container is running AND ready
  - 60-second timeout for safety
  - Automatic cleanup on success or error

### Streaming Container Start

- **Live Startup Logs**
  - `/api/workspaces/[id]/start` now streams logs via SSE
  - Same real-time log viewer as rebuild
  - Shows container creation and initialization progress
  - 90-second timeout (starting takes longer than rebuild)
- **Editor-Integrated Log Display**
  - Logs show in main editor area where VS Code will appear
  - Clean, centered layout with terminal-style log viewer
  - Header shows spinner, title, and current stage
  - Log panel with border, header showing line count
  - No floating modals or overlays
  - Smooth transition from logs to editor
- **Visibility into Startup Process**
  - See container creation in real-time
  - Monitor repository cloning
  - Watch Nix environment setup
  - Track agent bridge initialization
  - Know exactly when VS Code is ready

### Component Refactoring & Architecture

- **Split Workspace Page into Components**
  - Main page reduced from ~1600 lines to ~780 lines
  - Created modular component structure in `/components/workspace/`
  - Improved maintainability and code organization
- **New Components Created**
  - `WorkspaceHeader`: Header with back button, workspace info, and action buttons
  - `WorkspaceEditor`: Manages editor iframe and all workspace states (starting, running, stopped, stopping)
  - `StartupLogsView`: Terminal-style log viewer for startup/rebuild operations
  - `AIAgentPanel`: Complete AI chat interface with tool execution, reasoning, and checkpoints
- **Improved Layout Architecture**
  - Changed from absolute positioning to flexbox layout
  - Editor area properly centers content accounting for AI panel width
  - AI panel uses `w-[500px] shrink-0` instead of `absolute right-0`
  - Logs now correctly center in editor area
  - Better responsive behavior and consistent spacing
- **Type Safety Improvements**
  - Unified `Message` and `MessagePart` type definitions across components
  - Proper discriminated unions for different part types
  - Type-safe component props with explicit interfaces
- **Code Quality Benefits**
  - Easier to locate and modify specific functionality
  - Each component has single responsibility
  - Shared types prevent inconsistencies
  - Better separation of concerns

### AI Agent Panel Improvements

- **Fixed Tool Call Display**
  - Removed duplicate tool displays (was showing both tool cards AND checkpoints)
  - Tool calls now collapsed by default with clean expand/collapse UI
  - Only show completed tools (output-available state)
  - Checkpoints removed as they duplicated tool information
  - Tools maintain proper chronological order in message flow
- **Improved Markdown Rendering**
  - Better code block styling with proper background and borders
  - Inline code with emerald highlighting
  - Proper list rendering (ul/ol) with correct indentation
  - Headings with appropriate sizing (h1, h2, h3)
  - Blockquotes with left border accent
  - Pre-formatted text blocks with overflow handling
  - All markdown elements properly styled for dark theme
- **Smarter "Processing..." Indicator**
  - Only shows when streaming AND no content exists yet
  - Hides as soon as any text or completed tools appear
  - Prevents "Processing..." showing after content is already displayed
  - Better user feedback for actual loading states
- **Cleaner Tool Cards**
  - Minimal collapsed state: icon + name + checkmark + chevron
  - Emerald theme for completed tools
  - Expandable to show input/output with proper formatting
  - JSON output with syntax highlighting
  - Better spacing and visual hierarchy

### VS Code Problems Integration

- **New VS Code Extension: `kalpana-diagnostics`**
  - Runs inside code-server container
  - Uses VS Code's diagnostic API to collect all problems
  - Updates diagnostics file every 2 seconds
  - Captures errors, warnings, info, and hints from all language servers
- **New Agent Tool: `getProblems`**
  - AI can now see EXACTLY what you see in VS Code's Problems tab
  - Includes TypeScript errors, ESLint warnings, and all other diagnostics
  - Can filter by severity (errors only, warnings only, etc.)
  - Returns file path, line number, column, message, and source
- **Enhanced Agent Bridge**
  - New command: `getVSCodeProblems`
  - Reads diagnostics from `/tmp/kalpana-diagnostics.json`
  - Supports severity filtering
  - Falls back gracefully if extension not loaded
- **Automatic Extension Installation**
  - Extension built during Docker image creation
  - Auto-installed on container startup
  - No manual configuration needed
- **Benefits for AI Agent**
  - Can proactively check for errors before suggesting fixes
  - Better context for debugging user issues
  - Can verify fixes actually resolve reported problems
  - Sees same problems as user (unlike manual linting)

### Clickable File Links in AI Responses

- **Smart File Path Detection**
  - Regex detects file paths in AI text: `src/app.ts`, `utils/helper.js:42`
  - Supports file paths with line numbers (`file.ts:42`)
  - Works with all common file extensions (ts, js, py, go, etc.)
- **Interactive File Buttons**
  - File paths rendered as clickable buttons with file icon
  - Emerald-themed hover effects
  - Shows filename and line number clearly
- **VS Code Integration**
  - Extension handles `kalpana.openFile` command via WebSocket
  - Opens file in VS Code editor (not preview)
  - Jumps to specific line if specified
  - Centers the line in viewport for easy viewing
  - Shows error if file doesn't exist
- **Seamless User Experience**
  - AI: "I found an error in `src/app.ts:42`"
  - User: _clicks `src/app.ts:42`_
  - VS Code: _Opens file, jumps to line 42_

---

## 🚀 Phase 1 VS Code Extension Features (IMPLEMENTED!)

### WebSocket Architecture

- **VS Code Extension WebSocket Server** (Port 3002)
  - Runs WebSocket server for direct communication with agent bridge
  - Handles incoming commands and sends responses
  - Automatic reconnection on disconnect
  - Command queueing when extension not ready
- **Agent Bridge WebSocket Client**
  - Connects to VS Code extension on startup
  - Auto-reconnects every 2 seconds on disconnect
  - Queues commands during connection attempts
  - 30-second timeout for commands
- **Direct Communication**
  - No more file-based communication!
  - Real-time command/response via WebSocket
  - Cleaner, faster, more reliable
  - Better error handling

### 🔧 Code Actions & Quick Fixes

- **Get Available Actions**
  - AI can query available quick fixes for any line
  - Returns all VS Code built-in fixes
  - Shows action titles, kinds, and preferences
- **Apply Fixes Automatically**
  - AI can apply quick fixes with a single command
  - Supports workspace edits and commands
  - "Add missing import", "Fix all auto-fixable problems", etc.
- **Use Cases**
  - Auto-fix import errors
  - Apply linting fixes
  - Implement missing methods
  - Extract functions/variables
- **New AI Tools**:
  - `getCodeActions(filePath, line)` - Get available fixes
  - `applyCodeAction(actionId)` - Apply a specific fix

### 🎯 Symbol Navigation

- **Go to Definition**
  - Find where functions, classes, variables are defined
  - Returns file path, line, and character position
  - Supports multiple definitions
- **Find References**
  - See all usages of a symbol across the codebase
  - Returns count and list of all references
  - Helps understand code impact
- **Workspace Symbol Search**
  - Search for any symbol by name
  - Returns top 50 matches with location
  - Includes symbol kind (class, function, variable, etc.)
- **New AI Tools**:
  - `goToDefinition(filePath, line, character)` - Find definition
  - `findReferences(filePath, line, character)` - Find all usages
  - `searchSymbols(query)` - Search workspace symbols

### 💅 Code Formatting

- **Auto-Format Files**
  - Uses workspace's configured formatter (Prettier, ESLint, etc.)
  - Applies all formatting rules
  - Automatically saves the file
  - Returns number of edits applied
- **Use Cases**
  - Clean up code after generation
  - Fix indentation and spacing
  - Apply code style standards
- **New AI Tool**:
  - `formatDocument(filePath)` - Format and save file

### ℹ️ Hover Information

- **Type Information**
  - Get type signatures for any symbol
  - See JSDoc documentation
  - View parameter hints
  - Like hovering in VS Code!
- **Use Cases**
  - Understand function signatures
  - Read documentation
  - Check types before using
- **New AI Tool**:
  - `getHover(filePath, line, character)` - Get hover info

### 🖥️ Terminal Integration

- **Run Commands in VS Code Terminal**
  - AI can execute any shell command
  - Terminal shown to user automatically
  - Named terminals for organization
  - Persistent across commands
- **Use Cases**
  - Run tests: `npm test`
  - Build project: `npm run build`
  - Git operations: `git status`
  - Any shell command!
- **New AI Tool**:
  - `runInTerminal(command, terminalName?)` - Execute in terminal

### 📦 Container Integration

- **Enhanced Dockerfile**
  - Builds VS Code extension during image build
  - Installs `ws` package for WebSocket support
  - Compiles TypeScript extension
- **Auto-Installation on Startup**
  - Extension installed automatically via `start.sh`
  - No manual configuration needed
  - Ready to use immediately

### 🎯 Real-World Workflows

**Auto-Fix Workflow:**

1. AI: `getProblems()` → Finds 5 errors
2. AI: `getCodeActions("src/app.ts", 42)` → Gets available fixes
3. AI: `applyCodeAction(0)` → Applies "Add missing import"
4. AI: `formatDocument("src/app.ts")` → Cleans up formatting
5. AI: `getProblems()` → Verifies all fixed!

**Code Navigation:**

1. User: "Where is `UserService` defined?"
2. AI: `searchSymbols("UserService")` → Finds in `src/services/user.ts`
3. AI: `findReferences("src/services/user.ts", 10, 15)` → 47 usages
4. AI: "UserService is defined in `src/services/user.ts:10` and used in 47 places"

**Terminal Workflow:**

1. AI: `runInTerminal("npm test")` → Runs tests
2. User sees output in VS Code terminal
3. AI can see results and suggest fixes

### 📚 Documentation

- **IDEAS.md** - 28+ future feature ideas with implementation plans
- **QUICKSTART.md** - Quick reference for using the extension
- **README.md** - Extension overview and capabilities

### 🔮 Future Enhancements (Planned)

See `container/vscode-extension/IDEAS.md` for full roadmap:

- **Phase 2**: Git Integration, Refactoring Operations
- **Phase 3**: Debugging Support, Task Running
- **Phase 4**: Code Lens, Settings Management, Extension Marketplace

---

## 🖼️ Vision Model Support - Image Inputs

### Image Attachment

- **+ Button in Input**
  - Blue "+" button inside chat input (right side)
  - Click to upload images
  - Supports multiple image uploads
  - Accepts all image formats (PNG, JPG, GIF, WebP, etc.)
  - Visual preview thumbnails with remove button
- **Paste from Clipboard**
  - Paste images directly from clipboard (Ctrl/Cmd+V)
  - Screenshots, copied images, etc.
  - Automatic detection and conversion
  - Works globally when chat is focused
- **Image Preview**
  - 20x20px thumbnails above input
  - Hover to see remove button
  - Blue-themed border and styling
  - Shows image filename

### Multimodal AI

- **Vision Model Integration**
  - Sends images as base64-encoded data
  - Compatible with Claude, GPT-4V, and other vision models
  - Images included with text prompts
  - AI can analyze screenshots, diagrams, UI mockups, etc.
- **Smart Message Format**
  - Converts last user message to multimodal format
  - Text + images combined in single request
  - Format: `[{type: "text", text: "..."}, {type: "image", image: "data:..."}]`
- **Use Cases**
  - Debug UI issues from screenshots
  - Analyze diagrams and flowcharts
  - Code from design mockups
  - Explain visual concepts
  - Review app interfaces

### User Experience

**Workflow:**

1. Click image button or paste screenshot
2. Image appears as thumbnail preview
3. Type question: "What's wrong with this UI?"
4. AI receives text + image
5. AI analyzes and responds with context!

**Features:**

- Multiple images per message
- Remove images before sending
- Live count indicator (blue camera icon)
- Automatic base64 encoding
- Error handling for invalid files

---

## 📎 @-Mention File Context System

### Smart File Attachment

- **@ Mention Trigger**
  - Type `@` in chat input to trigger file picker
  - Works at start of message or after a space
  - Real-time search as you type
- **Fuzzy File Search**
  - Search files by name or path
  - Fuzzy matching algorithm (characters appear in order)
  - Filters out common directories (`node_modules`, `.git`, `dist`, etc.)
  - Shows up to 10 results
  - Keyboard navigation (↑↓ arrows, Enter to select, Esc to close)
- **Visual File Picker**
  - Beautiful dropdown UI with file/folder icons
  - Shows file name and full path
  - Live search results count
  - Keyboard shortcuts displayed

### File Context Management

- **Attach Files to Messages**
  - Select files from picker to attach
  - Visual chips show attached files
  - Remove files before sending with X button
  - Files listed in message for AI awareness
- **Smart File Reference**
  - Only file paths sent to AI, not full content
  - Format: `[Attached files: path1, path2, ...]`
  - AI can read files using `readFile` tool if needed
  - Saves tokens and allows dynamic content access
- **Smart Context Display**
  - Paperclip icon shows attachment count
  - Emerald-themed file chips
  - Files cleared after message sent
  - Error handling for unavailable files

### API Integration

- **New Endpoints**:
  - `GET /api/workspaces/[id]/files` - List all workspace files
  - `GET /api/workspaces/[id]/file-content?path=...` - Get file content
- **File Listing**
  - Recursive directory traversal
  - Flat file list with paths
  - Automatic filtering of build/dependency folders
  - Real-time updates when workspace changes

### User Experience

**Typical Workflow:**

1. User types `@` in chat
2. File picker appears instantly (no layout shift)
3. User types `app` to search
4. Results filtered to matching files
5. User selects `src/app.tsx`
6. File attached as chip below input
7. User types question: "How does routing work?"
8. AI receives: `[Attached files: src/app.tsx]` + question
9. AI reads the file and answers with context!

**Features:**

- Real-time file search and selection
- Multiple file attachments supported
- Visual feedback for all actions
- Keyboard-first UX (↑↓ arrows, Enter, Esc)
- Fixed positioning (no layout shift)
- Automatic cleanup after sending
- Token-efficient (only paths sent, AI reads content as needed)

### Benefits

✅ **Contextual Conversations**

- AI knows which files to examine
- AI reads content only when needed
- Perfect for code reviews and debugging

✅ **Fast & Intuitive**

- Type `@` and start searching
- Fuzzy search finds files quickly
- Keyboard shortcuts for power users
- No layout shift when picker appears

✅ **Clean UX**

- Files displayed as chips
- Easy to remove before sending
- "+" button for images inside input
- No clutter in chat

---

## [Previous Versions]

See git history for changes before this changelog was created.
