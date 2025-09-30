# Kalpana - Cloud Development Environment Platform

## Project Planning & Architecture Options

## 🎯 Project Overview

Kalpana is a web-based platform that provides on-demand VSCode development environments with:

- VSCode Server instances with configurable runtimes (Nix-based)
- GitHub repository integration (public/private)
- AI coding agent with file manipulation and command execution
- Split interface: VSCode (left) + AI Agent (right)
- Full web-based control via Next.js

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                         │
│  ┌──────────────────┐              ┌────────────────────┐  │
│  │  VSCode Web      │              │   AI Agent Chat    │  │
│  │  (iframe/embed)  │              │   Interface        │  │
│  └──────────────────┘              └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)            │
│  - Authentication & Authorization                            │
│  - Session Management                                        │
│  - WebSocket Handlers                                        │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────────┐
│  Orchestration   │ │  AI Service │ │ GitHub Service   │
│  Service         │ │             │ │                  │
│  (Containers)    │ │             │ │                  │
└──────────────────┘ └─────────────┘ └──────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│        Container Instances (Docker/Kubernetes/Fly.io)        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Development Container                                │  │
│  │  ├── VSCode Server (code-server/openvscode-server)  │  │
│  │  ├── Nix Package Manager                             │  │
│  │  ├── Git + GitHub CLI                                │  │
│  │  ├── User's Repository Clone                         │  │
│  │  └── Runtime Environment (configured via Nix)        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Technology Stack Options

### 1. Frontend (Fixed: Next.js)

**Choice: Next.js 15 with App Router**

- ✅ **UI Framework**: React + TypeScript
- ✅ **Component Library**: shadcn/ui + Tailwind CSS
- ✅ **State Management**:
  - React Context for global state
  - Zustand (lightweight alternative to Redux)
  - TanStack Query (React Query) for server state
- ✅ **Real-time Communication**:
  - WebSockets (native or Socket.io)
  - Server-Sent Events (SSE) for AI streaming

**Key Pages:**

```
/                          → Landing page
/dashboard                 → User's workspaces
/workspace/[id]           → Main workspace view (VSCode + AI)
/workspace/[id]/settings  → Workspace configuration
/templates                → Pre-configured templates
```

---

### 2. VSCode Server Options

#### **Option A: code-server (Recommended)**

- **Pros:**
  - Official Coder project, well-maintained
  - Full VSCode experience in browser
  - Extension marketplace support
  - Easy to containerize
- **Cons:**
  - Heavier resource usage
  - Requires more memory per instance
- **Integration**: Embed via iframe with authentication tokens

#### **Option B: OpenVSCode Server**

- **Pros:**
  - Lighter than code-server
  - Open source, Microsoft-backed
  - Modern web technologies
- **Cons:**
  - Extension support can be limited
  - Less battle-tested than code-server
- **Integration**: Similar iframe embedding

#### **Option C: Monaco Editor (Code Editor Only)**

- **Pros:**
  - Extremely lightweight
  - Just the editor, not full IDE
  - Easy to customize
- **Cons:**
  - No terminal, file explorer, or extensions
  - Would need to build all IDE features yourself
- **Not Recommended** for this use case

**Recommendation: code-server** - Most complete solution

---

### 3. Container Orchestration Options

#### **Option A: Docker + Custom Orchestrator**

```typescript
// Simple approach - manage containers directly
import Docker from "dockerode";

const docker = new Docker();
const container = await docker.createContainer({
  Image: "kalpana-base",
  Cmd: ["code-server", "--bind-addr", "0.0.0.0:8080"],
  Env: ["PASSWORD=...", "GIT_REPO=..."],
  HostConfig: {
    Memory: 2 * 1024 * 1024 * 1024, // 2GB
    CpuQuota: 100000,
  },
});
```

**Pros:**

- Full control
- Simple to start
- Can run anywhere

**Cons:**

- Manual scaling
- Manual health checks
- Manual cleanup
- Security concerns

---

#### **Option B: Kubernetes**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workspace-{{id}}
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: vscode
          image: kalpana/workspace:latest
          resources:
            limits:
              memory: "2Gi"
              cpu: "1"
```

**Pros:**

- Battle-tested orchestration
- Auto-scaling
- Self-healing
- Resource management
- Production-grade

**Cons:**

- Complex setup
- Overkill for early stage
- Expensive to run
- Steep learning curve

---

#### **Option C: Fly.io Machines API**

```typescript
import { Machines } from "@fly.io/machines";

const machine = await Machines.create({
  app: "kalpana",
  config: {
    image: "kalpana/workspace:latest",
    guest: {
      cpu_kind: "shared",
      cpus: 1,
      memory_mb: 2048,
    },
    env: {
      GITHUB_REPO: repo,
      USER_ID: userId,
    },
  },
});
```

**Pros:**

- Serverless containers
- Pay per use
- Fast cold starts
- Built-in scaling
- Simple API

**Cons:**

- Vendor lock-in
- Pricing can scale
- Limited regions

---

#### **Option D: Railway/Render**

**Pros:**

- Extremely simple
- Good DX
- Affordable

**Cons:**

- Less control
- May not support dynamic container spawning

---

**Recommendation for MVP**: **Fly.io Machines API**

- Start simple with Fly.io
- Migrate to Kubernetes when scale demands it
- Or start with **Docker + simple orchestrator** if you want full control from day 1

---

### 4. Nix Integration

#### **Approach A: Nix in Container (Recommended)**

```dockerfile
FROM nixos/nix:latest

# Install code-server via Nix
RUN nix-env -iA nixpkgs.code-server

# User can specify runtime in nix config
COPY workspace.nix /workspace/
RUN nix-shell /workspace/workspace.nix
```

**User provides `workspace.nix`:**

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs-18_x
    python311
    rustc
    cargo
  ];
}
```

**Pros:**

- Declarative
- Reproducible
- Users have full control
- Can pin versions

**Cons:**

- Longer startup times (Nix builds)
- Larger images

---

#### **Approach B: Pre-built Templates**

```typescript
const templates = {
  node: { image: "kalpana/node:latest" },
  python: { image: "kalpana/python:latest" },
  rust: { image: "kalpana/rust:latest" },
  "full-stack": { image: "kalpana/fullstack:latest" },
};
```

**Pros:**

- Fast startup
- Predictable
- Easy to maintain

**Cons:**

- Less flexible
- Can't customize as much

---

**Recommendation**: **Hybrid Approach**

- Start with pre-built templates for common stacks
- Allow advanced users to provide custom `workspace.nix`
- Cache Nix builds for faster subsequent starts

---

### 5. GitHub Integration

#### **Authentication**

```typescript
// OAuth flow
const githubOAuth = {
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  scopes: ["repo", "read:user", "read:org"],
};
```

**Steps:**

1. User authorizes GitHub OAuth
2. Store access token securely (encrypted in DB)
3. Use token to clone repo in container
4. Support GitHub Apps for organization-wide access

---

#### **Repository Handling**

**Option A: Clone on Container Start**

```bash
git clone https://${GITHUB_TOKEN}@github.com/${OWNER}/${REPO}.git
```

**Option B: Volume Mount from Git Server**

- Host a Git server
- Clone once, mount volume to containers
- Faster, but more complex

**Option C: Use GitHub Codespaces Protocol**

- Leverage existing infrastructure
- Complex to implement

**Recommendation**: **Option A** - Simple and works well

---

### 6. AI Agent Integration

#### **LLM Provider Options**

**Option A: OpenAI API**

```typescript
import OpenAI from 'openai';

const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [...],
  tools: [
    { type: 'function', function: { name: 'edit_file', ... } },
    { type: 'function', function: { name: 'run_command', ... } }
  ]
});
```

**Pros:**

- Best performance
- Function calling support
- Reliable

**Cons:**

- Most expensive
- Data privacy concerns

---

**Option B: Anthropic Claude**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  tools: [...],
  messages: [...]
});
```

**Pros:**

- Better at following instructions
- Better coding capabilities
- More context window
- Tool use (function calling)

**Cons:**

- Expensive (but competitive)

---

**Option C: Self-hosted (Ollama + Llama/Mixtral)**

```typescript
// Run Ollama in your infrastructure
const response = await fetch("http://ollama:11434/api/generate", {
  method: "POST",
  body: JSON.stringify({
    model: "codellama:34b",
    prompt: "...",
  }),
});
```

**Pros:**

- Data privacy
- No usage costs (after infrastructure)
- Full control

**Cons:**

- Requires GPU infrastructure
- Lower quality than GPT-4/Claude
- More maintenance

---

**Recommendation**:

- **Start with Anthropic Claude** (best for coding)
- Allow users to bring their own API keys
- Add self-hosted option later

---

#### **AI Agent Tools/Actions**

The AI needs to interact with the workspace:

```typescript
interface AgentTools {
  // File Operations
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(directory: string): Promise<string[]>;

  // Command Execution
  runCommand(command: string): Promise<{ stdout: string; stderr: string }>;

  // Git Operations
  gitCommit(message: string): Promise<void>;
  gitPush(): Promise<void>;

  // Search
  searchCode(query: string): Promise<SearchResult[]>;

  // LSP Integration (optional)
  getDefinition(file: string, position: Position): Promise<Location>;
  getReferences(symbol: string): Promise<Location[]>;
}
```

**Implementation Approach:**

1. **WebSocket Connection**: Next.js API → Container
2. **Agent Executor**: Runs in container or separate service
3. **Sandbox**: Limit what AI can do (no `rm -rf /`, etc.)

---

### 7. Database (MongoDB + Prisma) ✅ **CHOSEN**

You need to store:

- User accounts (Better Auth handles this)
- Workspace configurations
- Container metadata (ports, status)
- Usage metrics
- GitHub integration data

#### **MongoDB with Prisma ORM**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String      @id @default(auto()) @map("_id") @db.ObjectId
  email         String      @unique
  name          String?
  image         String?
  githubId      String?     @unique
  workspaces    Workspace[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Workspace {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String
  description     String?

  // Container info
  containerId     String?
  vscodePort      Int?
  agentPort       Int?
  status          WorkspaceStatus  @default(STOPPED)

  // Configuration
  githubRepo      String?
  githubBranch    String?   @default("main")
  nixConfig       String?
  template        String?

  // User relation
  userId          String   @db.ObjectId
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Metadata
  lastAccessedAt  DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([status])
}

enum WorkspaceStatus {
  STOPPED
  STARTING
  RUNNING
  STOPPING
  ERROR
}

model Session {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken String  @unique
  userId      String   @db.ObjectId
  expires     DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

**Why MongoDB?**

- ✅ **Flexible schema**: Easy to add fields as you iterate
- ✅ **No migrations**: During rapid development
- ✅ **JSON-native**: Perfect for storing Nix configs, metadata
- ✅ **Prisma support**: Type-safe queries
- ✅ **Easy setup**: MongoDB Atlas free tier or local Docker
- ✅ **Scales horizontally**: When you need it

**Setup:**

```bash
# Local MongoDB with Docker
docker run -d -p 27017:27017 --name kalpana-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7

# Or use MongoDB Atlas (free tier)
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/kalpana"
```

---

### 8. Authentication (Better Auth) ✅ **CHOSEN**

[Better Auth](https://www.better-auth.com/docs/introduction) is a modern, framework-agnostic authentication library for TypeScript.

#### **Why Better Auth?**

- ✅ **Framework agnostic**: Works with any framework
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Plugin ecosystem**: 2FA, passkeys, multi-session, SSO
- ✅ **MongoDB support**: Native MongoDB adapter
- ✅ **Social auth**: GitHub, Google, etc.
- ✅ **Modern DX**: Better than NextAuth.js
- ✅ **No vendor lock-in**: Self-hosted, open source

#### **Setup:**

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.DATABASE_URL!);
const db = client.db("kalpana");

export const auth = betterAuth({
  database: mongodbAdapter(db),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ["read:user", "repo"],
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  plugins: [
    // Add plugins as needed
    // twoFactor(),
    // passkey(),
  ],
});

export type Session = typeof auth.$Infer.Session;
```

#### **Client-side usage:**

```typescript
// lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  // ... other hooks
} = authClient;
```

#### **Protected routes:**

```typescript
// middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*"],
};
```

#### **GitHub OAuth Flow:**

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

```typescript
// Login component
"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

export function LoginForm() {
  const handleGitHubLogin = async () => {
    await signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  };

  return (
    <Button onClick={handleGitHubLogin}>
      <Github className="mr-2 h-4 w-4" />
      Sign in with GitHub
    </Button>
  );
}
```

---

### 9. Real-Time Communication

You need bidirectional communication for:

- AI agent responses (streaming)
- Terminal output
- File changes
- Status updates

#### **Option A: WebSockets (Socket.io)**

```typescript
// server
io.on("connection", (socket) => {
  socket.on("ai:message", async (msg) => {
    const stream = await getAIResponse(msg);
    for await (const chunk of stream) {
      socket.emit("ai:response", chunk);
    }
  });
});

// client
socket.on("ai:response", (chunk) => {
  appendToChat(chunk);
});
```

---

#### **Option B: Server-Sent Events (SSE)**

```typescript
// For one-way streaming (AI responses)
app.get("/api/ai/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");

  for await (const chunk of aiStream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
});
```

---

**Recommendation**: **WebSockets (Socket.io)** - More flexible

---

## 🔐 Security Considerations

1. **Container Isolation**

   - Use user namespaces
   - Resource limits (CPU, memory, disk)
   - Network policies
   - No privileged containers

2. **AI Sandboxing**

   - Whitelist allowed commands
   - Prevent directory traversal
   - Rate limiting on tool usage

3. **GitHub Tokens**

   - Encrypt at rest
   - Never log tokens
   - Use short-lived tokens when possible

4. **User Isolation**
   - Each workspace in separate container
   - No shared filesystems
   - Network isolation between users

---

## 💰 Cost Estimation (Monthly)

### Small Scale (100 active users)

- **Compute**: $200-500 (Fly.io/Railway)
- **Database**: $15-25 (Managed Postgres)
- **AI API**: $300-1000 (varies greatly)
- **Storage**: $20-50
- **Total**: ~$550-1600/month

### Medium Scale (1000 users)

- **Compute**: $1000-3000
- **Database**: $50-100
- **AI API**: $3000-10000
- **Total**: ~$4000-13000/month

---

## 🚀 MVP Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)

- [ ] Next.js app setup with auth
- [ ] Basic workspace CRUD
- [ ] Docker container spawning
- [ ] code-server integration
- [ ] Simple iframe embedding

### Phase 2: GitHub Integration (Week 3)

- [ ] GitHub OAuth
- [ ] Repository cloning
- [ ] Basic Git operations

### Phase 3: AI Agent (Weeks 4-5)

- [ ] Chat interface
- [ ] LLM integration (Claude/GPT-4)
- [ ] Basic tools (read/write files, run commands)
- [ ] WebSocket communication

### Phase 4: Nix Integration (Week 6)

- [ ] Pre-built templates
- [ ] Custom Nix config support
- [ ] Template marketplace

### Phase 5: Polish & Scale (Weeks 7-8)

- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Monitoring & logging
- [ ] Documentation

---

## 🎨 UI/UX Considerations

### Main Workspace View

```
┌─────────────────────────────────────────────────────────┐
│  [Kalpana]  [Workspace: my-project]      [@username] ▼  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────┬─────────────────────────┐    │
│  │                      │                         │    │
│  │   VSCode Server      │     AI Agent Chat      │    │
│  │   (iframe)           │                         │    │
│  │                      │  User: "Add a button"   │    │
│  │  📁 src/             │                         │    │
│  │    └ components/     │  AI: "I'll add that..." │    │
│  │      └ Button.tsx    │                         │    │
│  │                      │  [Running command...]   │    │
│  │  [Terminal]          │                         │    │
│  │  $ npm run dev       │  ┌─────────────────┐   │    │
│  │                      │  │ User message... │   │    │
│  │                      │  └─────────────────┘   │    │
│  │                      │            [Send] ━━>  │    │
│  └──────────────────────┴─────────────────────────┘    │
│                                                          │
│  [Status: Running]  [Git: main ↑3]  [CPU: 45%]         │
└─────────────────────────────────────────────────────────┘
```

---

## ❓ Key Questions to Answer

1. **Pricing Model?**

   - Free tier with limits?
   - Pay-per-use?
   - Subscription?

2. **Resource Limits?**

   - Max container lifetime?
   - CPU/memory quotas per user?
   - Storage limits?

3. **Multi-user Collaboration?**

   - Will workspaces be shared?
   - Real-time collaboration like VS Code Live Share?

4. **Persistence?**

   - How long to keep inactive workspaces?
   - Auto-save to GitHub?

5. **Scale Target?**
   - How many concurrent users?
   - Expected growth?

---

## 🤖 AI SDK + OpenRouter Integration

### Why Vercel AI SDK?

The [AI SDK](https://ai-sdk.dev/docs/introduction) provides:

- **Unified API** across all LLM providers
- **Built-in streaming** support
- **Tool calling** (function calling) standardization
- **React hooks** (`useChat`, `useCompletion`, `useObject`)
- **Type-safe** tool definitions
- **Framework agnostic** core with Next.js optimizations

### OpenRouter Setup

**OpenRouter** acts as a unified gateway to multiple LLM providers:

```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Users can choose their model
const models = {
  "anthropic/claude-3.5-sonnet": openrouter("anthropic/claude-3.5-sonnet"),
  "openai/gpt-4-turbo": openrouter("openai/gpt-4-turbo"),
  "google/gemini-pro-1.5": openrouter("google/gemini-pro-1.5"),
  "meta-llama/llama-3.1-70b": openrouter("meta-llama/llama-3.1-70b"),
};
```

**Benefits:**

- Single API key for all models
- Built-in rate limiting and load balancing
- Pay-as-you-go pricing
- Model fallbacks
- Usage analytics

### AI Agent Implementation with AI SDK

```typescript
// app/api/agent/route.ts
import { streamText, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages, workspaceId } = await req.json();

  const result = streamText({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    messages,
    tools: {
      readFile: tool({
        description: "Read a file from the workspace",
        parameters: z.object({
          path: z.string().describe("The file path to read"),
        }),
        execute: async ({ path }) => {
          // Send command to container via WebSocket
          const content = await containerAPI.readFile(workspaceId, path);
          return content;
        },
      }),
      writeFile: tool({
        description: "Write content to a file",
        parameters: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path, content }) => {
          await containerAPI.writeFile(workspaceId, path, content);
          return { success: true };
        },
      }),
      runCommand: tool({
        description: "Execute a shell command in the workspace",
        parameters: z.object({
          command: z.string(),
        }),
        execute: async ({ command }) => {
          const result = await containerAPI.executeCommand(
            workspaceId,
            command
          );
          return result;
        },
      }),
      searchCode: tool({
        description: "Search for code in the workspace",
        parameters: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => {
          const results = await containerAPI.searchCode(workspaceId, query);
          return results;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

### Frontend Chat Component

```typescript
// components/ai-agent-chat.tsx
"use client";

import { useChat } from "ai/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

interface AIAgentChatProps {
  workspaceId: string;
}

export function AIAgentChat({ workspaceId }: AIAgentChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/agent",
      body: { workspaceId },
    });

  return (
    <Card className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "rounded-lg px-4 py-2",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask the AI agent..."
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

---

## 🐳 Docker Architecture & Container Communication

### Overview Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App (Host)                      │
│                                                               │
│  ┌────────────────┐              ┌──────────────────────┐  │
│  │  Web Interface │              │   API Routes         │  │
│  │  (Browser)     │◄────────────►│   - /api/workspaces  │  │
│  └────────────────┘              │   - /api/agent       │  │
│                                   │   - /api/container   │  │
│                                   └──────────────────────┘  │
└───────────────────────────┬───────────────────────────────┘
                            │
                            │ Docker SDK (dockerode)
                            │
        ┌───────────────────┴──────────────────┐
        │         Docker Engine (Host)         │
        │                                       │
        │  ┌─────────────────────────────────┐│
        │  │  Container: workspace-{id}      ││
        │  │                                  ││
        │  │  ┌──────────────────────────┐  ││
        │  │  │  code-server             │  ││
        │  │  │  Port: 8080 → 40001      │  ││
        │  │  └──────────────────────────┘  ││
        │  │                                  ││
        │  │  ┌──────────────────────────┐  ││
        │  │  │  Agent Bridge Service    │  ││
        │  │  │  WebSocket Server        │  ││
        │  │  │  Port: 3001 → 40002      │  ││
        │  │  └──────────────────────────┘  ││
        │  │                                  ││
        │  │  ┌──────────────────────────┐  ││
        │  │  │  User's Code Workspace   │  ││
        │  │  │  /workspace/             │  ││
        │  │  │  (Git repo cloned here)  │  ││
        │  │  └──────────────────────────┘  ││
        │  │                                  ││
        │  └─────────────────────────────────┘│
        └──────────────────────────────────────┘
```

### Container Communication: Options & Recommendation

#### **Option 1: Direct Port Mapping (Dynamic Ports)** ⭐ **RECOMMENDED**

**Concept**: Each container gets dynamically assigned ports on the host

```typescript
// services/docker-manager.ts
import Docker from "dockerode";

const docker = new Docker();

interface WorkspaceContainer {
  containerId: string;
  vscodePort: number; // External port for code-server
  agentPort: number; // External port for agent bridge
  workspaceId: string;
}

export class DockerManager {
  private portManager = new PortManager(40000, 50000); // Port range

  async createWorkspace(
    workspaceId: string,
    githubRepo?: string,
    nixConfig?: string
  ): Promise<WorkspaceContainer> {
    const vscodePort = this.portManager.allocate();
    const agentPort = this.portManager.allocate();

    const container = await docker.createContainer({
      Image: "kalpana/workspace:latest",
      name: `workspace-${workspaceId}`,
      Env: [
        `WORKSPACE_ID=${workspaceId}`,
        `GITHUB_REPO=${githubRepo || ""}`,
        `NIX_CONFIG=${nixConfig || ""}`,
      ],
      ExposedPorts: {
        "8080/tcp": {}, // code-server
        "3001/tcp": {}, // agent bridge
      },
      HostConfig: {
        PortBindings: {
          "8080/tcp": [{ HostPort: vscodePort.toString() }],
          "3001/tcp": [{ HostPort: agentPort.toString() }],
        },
        Memory: 2 * 1024 * 1024 * 1024, // 2GB
        NanoCpus: 1000000000, // 1 CPU
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
    });

    await container.start();

    return {
      containerId: container.id,
      vscodePort,
      agentPort,
      workspaceId,
    };
  }

  async destroyWorkspace(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove();
  }
}

class PortManager {
  private usedPorts = new Set<number>();
  private minPort: number;
  private maxPort: number;

  constructor(minPort: number, maxPort: number) {
    this.minPort = minPort;
    this.maxPort = maxPort;
  }

  allocate(): number {
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error("No ports available");
  }

  release(port: number): void {
    this.usedPorts.delete(port);
  }
}
```

**How users access VSCode:**

```typescript
// app/workspace/[id]/page.tsx
export default async function WorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const workspace = await getWorkspace(params.id);

  return (
    <div className="flex h-screen">
      {/* VSCode iframe */}
      <div className="flex-1">
        <iframe
          src={`http://localhost:${workspace.vscodePort}?token=${workspace.accessToken}`}
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>

      {/* AI Agent */}
      <div className="w-96 border-l">
        <AIAgentChat workspaceId={params.id} />
      </div>
    </div>
  );
}
```

**Pros:**

- Simple and straightforward
- Each container is isolated
- Easy to debug
- No additional proxy needed

**Cons:**

- Limited by port range (but 10,000 ports = 10,000 containers!)
- Need to manage port allocation
- Firewall rules needed for remote access

---

#### **Option 2: Reverse Proxy (Traefik/Nginx)**

**Concept**: Use subdomains or paths to route to containers

```yaml
# docker-compose.yml for Traefik setup
version: "3.8"

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  workspace-abc123:
    image: kalpana/workspace:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vscode-abc123.rule=Host(`abc123.kalpana.local`)"
      - "traefik.http.services.vscode-abc123.loadbalancer.server.port=8080"
```

**Access:** `http://workspace-{id}.localhost` or `http://localhost/workspace/{id}`

**Pros:**

- Clean URLs
- No port management
- Production-ready
- SSL termination built-in

**Cons:**

- More complex setup
- Additional service to maintain
- Overkill for local development

---

#### **Option 3: WebSocket Proxy Gateway**

**Concept**: Custom proxy that tunnels all communication through WebSocket

```typescript
// services/websocket-proxy.ts
import { WebSocketServer } from "ws";
import { createProxy } from "http-proxy";

const wss = new WebSocketServer({ port: 9000 });
const proxy = createProxy();

wss.on("connection", (ws, req) => {
  const workspaceId = new URL(req.url!, "ws://base").searchParams.get(
    "workspace"
  );
  const target = workspaceRegistry.get(workspaceId);

  ws.on("message", (data) => {
    // Proxy to container's WebSocket
    proxy.ws(req, ws, { target: `ws://localhost:${target.port}` });
  });
});
```

**Pros:**

- Single entry point
- Works through firewalls
- Good for cloud deployment

**Cons:**

- Complex to implement
- Additional latency
- Need to handle reconnections
- Harder to debug

---

### **RECOMMENDED: Option 1 (Dynamic Port Mapping)**

For local Docker setup, direct port mapping is:

- ✅ Simplest to implement
- ✅ Lowest latency
- ✅ Easiest to debug
- ✅ No additional dependencies
- ✅ Works perfectly for development and small-scale production

---

## 🔌 Agent Bridge Service (Inside Container)

This service runs **inside each container** and handles AI agent commands.

### Architecture

```
Container Internal:
┌─────────────────────────────────────────┐
│  Agent Bridge Service (Node.js/Bun)     │
│  - WebSocket Server (port 3001)         │
│  - Receives commands from Next.js       │
│  - Executes file operations             │
│  - Runs shell commands                  │
│  - Returns results                      │
└─────────────────────────────────────────┘
           │
           │ File System Access
           ▼
┌─────────────────────────────────────────┐
│  /workspace/                             │
│  - User's cloned repository              │
│  - All development files                 │
└─────────────────────────────────────────┘
```

### Implementation

```typescript
// container/agent-bridge/server.ts
import { WebSocketServer } from "ws";
import { readFile, writeFile, readdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const WORKSPACE_ROOT = "/workspace";

const wss = new WebSocketServer({ port: 3001 });

interface Command {
  id: string;
  type: "readFile" | "writeFile" | "listFiles" | "runCommand" | "searchCode";
  payload: any;
}

interface Response {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

wss.on("connection", (ws) => {
  console.log("Agent bridge connected");

  ws.on("message", async (data) => {
    try {
      const command: Command = JSON.parse(data.toString());
      const response = await handleCommand(command);
      ws.send(JSON.stringify(response));
    } catch (error) {
      ws.send(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    }
  });
});

async function handleCommand(command: Command): Promise<Response> {
  // Security: Prevent path traversal
  const sanitizePath = (filePath: string) => {
    const normalized = path.normalize(filePath);
    if (normalized.startsWith("..")) {
      throw new Error("Path traversal detected");
    }
    return path.join(WORKSPACE_ROOT, normalized);
  };

  switch (command.type) {
    case "readFile": {
      const filePath = sanitizePath(command.payload.path);
      const content = await readFile(filePath, "utf-8");
      return {
        id: command.id,
        success: true,
        data: content,
      };
    }

    case "writeFile": {
      const filePath = sanitizePath(command.payload.path);
      await writeFile(filePath, command.payload.content, "utf-8");
      return {
        id: command.id,
        success: true,
      };
    }

    case "listFiles": {
      const dirPath = sanitizePath(command.payload.path || ".");
      const files = await readdir(dirPath, { withFileTypes: true });
      return {
        id: command.id,
        success: true,
        data: files.map((f) => ({
          name: f.name,
          isDirectory: f.isDirectory(),
        })),
      };
    }

    case "runCommand": {
      // Security: Whitelist allowed commands
      const allowedCommands = [
        "ls",
        "cat",
        "git",
        "npm",
        "bun",
        "python",
        "node",
      ];
      const cmd = command.payload.command;
      const cmdName = cmd.split(" ")[0];

      if (!allowedCommands.includes(cmdName)) {
        throw new Error(`Command not allowed: ${cmdName}`);
      }

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: WORKSPACE_ROOT,
        timeout: 30000, // 30s timeout
      });

      return {
        id: command.id,
        success: true,
        data: { stdout, stderr },
      };
    }

    case "searchCode": {
      const query = command.payload.query;
      // Use ripgrep for fast searching
      const { stdout } = await execAsync(`rg "${query}" ${WORKSPACE_ROOT}`, {
        cwd: WORKSPACE_ROOT,
      });
      return {
        id: command.id,
        success: true,
        data: stdout,
      };
    }

    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
}

console.log("Agent bridge listening on port 3001");
```

### Next.js Container API Client

```typescript
// lib/container-api.ts
import { WebSocket } from "ws";

class ContainerAPI {
  private connections = new Map<string, WebSocket>();
  private pendingRequests = new Map<string, (response: any) => void>();

  async connect(workspaceId: string, agentPort: number): Promise<void> {
    const ws = new WebSocket(`ws://localhost:${agentPort}`);

    ws.on("message", (data) => {
      const response = JSON.parse(data.toString());
      const resolver = this.pendingRequests.get(response.id);
      if (resolver) {
        resolver(response);
        this.pendingRequests.delete(response.id);
      }
    });

    await new Promise((resolve) => ws.once("open", resolve));
    this.connections.set(workspaceId, ws);
  }

  private async sendCommand(
    workspaceId: string,
    type: string,
    payload: any
  ): Promise<any> {
    const ws = this.connections.get(workspaceId);
    if (!ws) throw new Error("Container not connected");

    const id = Math.random().toString(36);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, resolve);

      ws.send(JSON.stringify({ id, type, payload }));

      setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }, 30000);
    });
  }

  async readFile(workspaceId: string, path: string): Promise<string> {
    const response = await this.sendCommand(workspaceId, "readFile", { path });
    return response.data;
  }

  async writeFile(
    workspaceId: string,
    path: string,
    content: string
  ): Promise<void> {
    await this.sendCommand(workspaceId, "writeFile", { path, content });
  }

  async executeCommand(
    workspaceId: string,
    command: string
  ): Promise<{ stdout: string; stderr: string }> {
    const response = await this.sendCommand(workspaceId, "runCommand", {
      command,
    });
    return response.data;
  }

  async searchCode(workspaceId: string, query: string): Promise<string> {
    const response = await this.sendCommand(workspaceId, "searchCode", {
      query,
    });
    return response.data;
  }
}

export const containerAPI = new ContainerAPI();
```

---

## 🐳 Container Image (Dockerfile)

```dockerfile
# Dockerfile
FROM nixos/nix:latest

# Install essential tools
RUN nix-env -iA nixpkgs.code-server \
    nixpkgs.git \
    nixpkgs.gh \
    nixpkgs.ripgrep \
    nixpkgs.nodejs-20_x \
    nixpkgs.bun

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Copy agent bridge service
COPY agent-bridge /agent-bridge
WORKDIR /agent-bridge
RUN bun install

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080 3001

CMD ["/start.sh"]
```

```bash
#!/bin/bash
# start.sh

# Clone GitHub repo if specified
if [ ! -z "$GITHUB_REPO" ]; then
    echo "Cloning repository: $GITHUB_REPO"
    cd /workspace
    git clone $GITHUB_REPO .
fi

# Apply Nix configuration if specified
if [ ! -z "$NIX_CONFIG" ]; then
    echo "Applying Nix configuration"
    echo "$NIX_CONFIG" > /workspace/shell.nix
    nix-shell /workspace/shell.nix
fi

# Start agent bridge service in background
cd /agent-bridge
bun run server.ts &

# Start code-server
code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    /workspace
```

---

## 🎯 **FINAL** Tech Stack (Decided)

| Component  | Technology                   | Reasoning                     |
| ---------- | ---------------------------- | ----------------------------- |
| Frontend   | Next.js 15 + shadcn/ui       | Per requirements              |
| VSCode     | code-server                  | Most complete                 |
| Containers | **Docker (local)**           | Full control, cost-effective  |
| Database   | **MongoDB + Prisma**         | Flexible schema, easy setup   |
| Auth       | **Better Auth**              | Modern, framework-agnostic    |
| AI SDK     | **Vercel AI SDK**            | Unified LLM interface         |
| LLM        | **OpenRouter**               | Multi-model support, flexible |
| Real-time  | WebSockets (native + AI SDK) | Bidirectional + streaming     |
| Nix        | Hybrid (templates + custom)  | Best of both worlds           |

---

## 📝 Next Steps

1. **Decide on architecture** (review options above)
2. **Choose infrastructure provider** (Fly.io vs Docker vs K8s)
3. **Set up base container image** (Nix + code-server)
4. **Build Next.js skeleton** (auth + dashboard)
5. **Prototype AI agent** (simple chat with file reading)
6. **Integrate GitHub OAuth** (repo cloning)
7. **Connect all pieces** (end-to-end flow)

Would you like me to start implementing any specific part?
