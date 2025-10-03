# Agent Components

Modular, reusable components for the AI Agent system. This architecture breaks down the monolithic 1320-line agent page into maintainable, focused components.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AgentHeader                          │
│  (Status, Repo Info, Push Button, Error Banner)            │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────────────────┐
│                          │                                  │
│   AgentFilesPanel        │      AgentSidebar                │
│   (Diff Viewer)          │                                  │
│                          │  ┌────────────────────────────┐  │
│  ┌────────────────────┐  │  │  Tab: Activity / Chat    │  │
│  │  File List         │  │  └────────────────────────────┘  │
│  │  - file1.ts        │  │                                  │
│  │  - file2.tsx       │  │  ┌────────────────────────────┐  │
│  └────────────────────┘  │  │  AgentActivity             │  │
│                          │  │  (Tool Calls)              │  │
│  ┌────────────────────┐  │  │  OR                        │  │
│  │  Diff Display      │  │  │  AgentConversation         │  │
│  │  + Added lines     │  │  │  (Chat Messages)           │  │
│  │  - Removed lines   │  │  └────────────────────────────┘  │
│  └────────────────────┘  │                                  │
│                          │  ┌────────────────────────────┐  │
│                          │  │  AgentInput                │  │
│                          │  │  (Send/Resume)             │  │
│                          │  └────────────────────────────┘  │
└──────────────────────────┴──────────────────────────────────┘
```

## Components

### 1. AgentHeader

**Purpose**: Displays agent metadata, status, and actions

**Props**:
```typescript
interface AgentHeaderProps {
  agent: {
    name: string;
    task: string;
    githubRepo: string;
    sourceBranch: string;
    targetBranch: string;
    status: AgentStatus;
    errorMessage?: string;
    lastMessageAt?: string;
    pushedAt?: string;
  };
  isLiveStreaming: boolean;
  onBack: () => void;
  onPush?: () => void;
  pushing?: boolean;
}
```

**Features**:
- Status badge with live indicator
- Repository and branch information
- Push to GitHub button
- Error message banner
- Back navigation

---

### 2. AgentActivity

**Purpose**: Displays tool calls in chronological order

**Props**:
```typescript
interface AgentActivityProps {
  toolCalls: ToolCall[];
}
```

**Features**:
- Expandable tool call cards
- Tool-specific icons
- Argument display (JSON formatted)
- Timestamp for each call
- Empty state with helpful message

**Tool Icons**:
- File operations: `FileCode`
- Search: `Search`
- Git: `GitCommit`
- Terminal: `TerminalIcon`
- Errors: `AlertCircle`

---

### 3. AgentConversation

**Purpose**: Displays chat messages between user and agent

**Props**:
```typescript
interface AgentConversationProps {
  messages: ConversationMessage[];
  streamingText?: string;
}
```

**Features**:
- User and assistant message bubbles
- Markdown rendering with syntax highlighting
- Streaming text indicator
- Empty state
- Responsive typography

**Markdown Support**:
- Code blocks with syntax highlighting
- Lists (ordered & unordered)
- Blockquotes
- Headers
- Inline code

---

### 4. AgentFilesPanel

**Purpose**: Shows edited files with diff viewer

**Props**:
```typescript
interface AgentFilesPanelProps {
  files: EditedFile[];
}
```

**Features**:
- File list with operation indicators
  - 🟢 Created (green pulse)
  - 🔵 Modified (blue)
  - 🔴 Deleted (red)
- Diff viewer with line-by-line changes
- Syntax highlighting for additions/deletions
- File selection
- Empty state

**Diff Format**:
```
  1  + Added line (green background)
  2    Unchanged line
  3  - Removed line (red background)
```

---

### 5. AgentInput

**Purpose**: Input field for sending messages or resuming agent

**Props**:
```typescript
interface AgentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onResume?: () => void;
  sending: boolean;
  resuming?: boolean;
  agentStatus: AgentStatus;
  placeholder?: string;
}
```

**Features**:
- Auto-resizing textarea
- Character count
- Send button
- Resume button (when agent is completed)
- Enter to send (Shift+Enter for newline)
- Loading states
- Disabled when empty

**Behavior**:
- **Running**: Shows "Send" button
- **Completed/Idle**: Shows "Resume" + "Ask" buttons
- **Sending**: Disabled with spinner

---

### 6. AgentSidebar

**Purpose**: Resizable sidebar with tabbed interface

**Props**:
```typescript
interface AgentSidebarProps {
  children: React.ReactNode;
  activityCount: number;
  chatCount: number;
  defaultTab?: "activity" | "chat";
}
```

**Features**:
- Resizable width (300px - 800px)
- Tab switching (Activity / Chat)
- Badge counts on tabs
- Smooth transitions
- Drag handle for resizing

**Usage**:
```tsx
<AgentSidebar activityCount={10} chatCount={5}>
  <AgentSidebarTab tab="activity">
    <AgentActivity toolCalls={toolCalls} />
  </AgentSidebarTab>
  
  <AgentSidebarTab tab="chat">
    <AgentConversation messages={messages} />
    <AgentInput {...inputProps} />
  </AgentSidebarTab>
</AgentSidebar>
```

---

## Design System

### Colors

**Status Colors**:
- `IDLE`: Gray (`zinc-800/80`)
- `CLONING`: Blue (`blue-500/20`)
- `RUNNING`: Amber (`amber-500/20`)
- `COMPLETED`: Emerald (`emerald-500/20`)
- `ERROR`: Red (`red-500/20`)
- `PUSHING`: Purple (`purple-500/20`)

**Semantic Colors**:
- Primary: Emerald (`emerald-500`)
- Danger: Red (`red-500`)
- Warning: Amber (`amber-500`)
- Info: Blue (`blue-500`)

### Typography

- **Headers**: `text-sm` to `text-lg`, `font-medium`
- **Body**: `text-xs` to `text-sm`
- **Labels**: `text-[10px]` to `text-xs`, `text-zinc-500`
- **Code**: `font-mono`, `text-[11px]`

### Spacing

- **Padding**: `p-2` to `p-4`
- **Gaps**: `gap-1.5` to `gap-4`
- **Borders**: `border-zinc-800/50`

---

## State Management

### Agent State

```typescript
interface Agent {
  id: string;
  name: string;
  task: string;
  githubRepo: string;
  sourceBranch: string;
  targetBranch: string;
  status: AgentStatus;
  errorMessage?: string;
  toolCalls?: string;        // JSON
  filesEdited?: string;      // JSON
  conversationHistory?: string; // JSON
  pushedAt?: string;
  lastMessageAt?: string;
}
```

### SSE Events

The agent page connects to `/api/agents/[id]/stream` for real-time updates:

```typescript
// Event types
type SSEEvent =
  | { type: "init" }
  | { type: "status"; status: AgentStatus; error?: string }
  | { type: "tool-call"; toolCall: ToolCall }
  | { type: "tool-result"; toolName: string; result: any }
  | { type: "message"; message: ConversationMessage }
  | { type: "streaming"; content: string }
  | { type: "files"; files: EditedFile[] }
  | { type: "done" };
```

---

## API Integration

### Endpoints

1. **GET `/api/agents/[id]`**
   - Fetch agent details
   - Returns full agent object with JSON fields

2. **GET `/api/agents/[id]/stream`**
   - SSE stream for real-time updates
   - Sends events as agent executes

3. **POST `/api/agents/[id]/chat`**
   - Send chat message to agent
   - Body: `{ message: string }`

4. **POST `/api/agents/[id]/resume`**
   - Resume completed agent with new task
   - Body: `{ newTask: string }`

5. **POST `/api/agents/[id]/push`**
   - Push changes to GitHub
   - No body required

---

## Migration Guide

### Before (Monolithic)

```tsx
// 1320 lines in one file
export default function AgentDetailPage() {
  // 50+ state variables
  // 20+ functions
  // Complex JSX with nested conditions
  // Hard to test, maintain, or reuse
}
```

### After (Modular)

```tsx
// Main page: ~250 lines
export default function AgentDetailPage() {
  // Fetch data
  // Handle events
  // Compose components
  
  return (
    <div>
      <AgentHeader {...headerProps} />
      <AgentFilesPanel files={files} />
      <AgentSidebar>
        <AgentSidebarTab tab="activity">
          <AgentActivity toolCalls={toolCalls} />
        </AgentSidebarTab>
        <AgentSidebarTab tab="chat">
          <AgentConversation messages={messages} />
          <AgentInput {...inputProps} />
        </AgentSidebarTab>
      </AgentSidebar>
    </div>
  );
}
```

### Benefits

1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be used in other contexts
3. **Testability**: Easy to unit test individual components
4. **Readability**: Clear component hierarchy
5. **Performance**: Can optimize individual components
6. **Collaboration**: Multiple devs can work on different components

---

## Testing

### Unit Tests

```typescript
// Example: AgentActivity.test.tsx
describe("AgentActivity", () => {
  it("shows empty state when no tool calls", () => {
    render(<AgentActivity toolCalls={[]} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders tool calls with correct icons", () => {
    const toolCalls = [
      { id: "1", type: "read_file", timestamp: "2024-01-01" },
    ];
    render(<AgentActivity toolCalls={toolCalls} />);
    expect(screen.getByText("read file")).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// Example: AgentPage.test.tsx
describe("AgentDetailPage", () => {
  it("loads and displays agent data", async () => {
    mockFetch({ agent: mockAgent });
    render(<AgentDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText(mockAgent.name)).toBeInTheDocument();
    });
  });

  it("handles SSE events", async () => {
    const { mockSSE } = setupSSE();
    render(<AgentDetailPage />);
    
    mockSSE.emit({ type: "tool-call", toolCall: mockToolCall });
    
    await waitFor(() => {
      expect(screen.getByText(mockToolCall.function.name)).toBeInTheDocument();
    });
  });
});
```

---

## Future Enhancements

### Planned Features

1. **Tool Result Display**
   - Show tool outputs alongside calls
   - Collapsible result sections

2. **Search & Filter**
   - Search through tool calls
   - Filter by tool type
   - Filter files by operation

3. **Export Functionality**
   - Export conversation as markdown
   - Download diffs as patch files
   - Export tool call logs

4. **Keyboard Shortcuts**
   - `Cmd+K`: Focus input
   - `Cmd+1/2`: Switch tabs
   - `Cmd+Enter`: Send message

5. **Collaborative Features**
   - Multiple users viewing same agent
   - Real-time cursor positions
   - Comment on tool calls

6. **Analytics**
   - Tool usage statistics
   - Performance metrics
   - Success rate tracking

---

## Contributing

When adding new features:

1. **Keep components focused**: One responsibility per component
2. **Follow naming conventions**: `Agent*` prefix for agent-specific components
3. **Add TypeScript types**: All props should be typed
4. **Write tests**: Unit tests for components, integration for pages
5. **Update documentation**: Keep this README current
6. **Match design system**: Use existing colors, spacing, typography

---

## Related Documentation

- [Agent API Documentation](../../app/api/agents/README.md)
- [Agent Executor](../../container/agent-bridge/agent-executor.ts)
- [Workspace Agent Panel](../workspace/ai-agent-panel.tsx)
- [Design System](../../docs/DESIGN_SYSTEM.md)
