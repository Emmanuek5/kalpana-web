# Kalpana - Implementation Plan

## 🔌 Multi-Workspace Port Allocation (IMPORTANT!)

### How Multiple Workspaces Work Simultaneously

Each container uses the **same internal ports** (isolated by Docker), but gets **unique external ports** on the host:

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST MACHINE                             │
│                                                                   │
│  User Browser                                                     │
│  ├─ Workspace 1: http://localhost:40001 (VSCode)                │
│  │                ws://localhost:40002 (Agent)                   │
│  │                                                                │
│  └─ Workspace 2: http://localhost:40003 (VSCode)                │
│                   ws://localhost:40004 (Agent)                   │
│                                                                   │
│  ┌────────────────────────┐    ┌────────────────────────┐      │
│  │ Container workspace-1  │    │ Container workspace-2  │      │
│  │                        │    │                        │      │
│  │  Internal: 8080 ──────►│───►│40001 (Host)            │      │
│  │  Internal: 3001 ──────►│───►│40002 (Host)            │      │
│  └────────────────────────┘    │                        │      │
│                                 │  Internal: 8080 ──────►│─────►│40003 (Host)
│                                 │  Internal: 3001 ──────►│─────►│40004 (Host)
│                                 └────────────────────────┘      │
│                                                                   │
│  PortManager:                                                     │
│  ├─ allocate() → 40001 (vscode, ws1)                            │
│  ├─ allocate() → 40002 (agent, ws1)                             │
│  ├─ allocate() → 40003 (vscode, ws2)                            │
│  ├─ allocate() → 40004 (agent, ws2)                             │
│  └─ ... up to port 50000                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Database Tracking

```typescript
// When creating workspace 1
{
  id: "workspace-abc123",
  name: "My React App",
  vscodePort: 40001,  // ← Stored in MongoDB
  agentPort: 40002,   // ← Stored in MongoDB
  status: "RUNNING",
  userId: "user-xyz"
}

// When creating workspace 2
{
  id: "workspace-def456",
  name: "Backend API",
  vscodePort: 40003,  // ← Different ports!
  agentPort: 40004,   // ← Different ports!
  status: "RUNNING",
  userId: "user-xyz"  // ← Same user!
}
```

### Frontend Access

```typescript
// Workspace 1 page
<iframe src="http://localhost:40001" />  // VSCode for workspace 1
<AIChat workspaceId="abc123" />          // Connects to ws://localhost:40002

// Workspace 2 page
<iframe src="http://localhost:40003" />  // VSCode for workspace 2
<AIChat workspaceId="def456" />          // Connects to ws://localhost:40004
```

**Maximum concurrent workspaces**: 5,000 (10,000 ports ÷ 2 ports per workspace)

---

## 🔄 Complete Data Flow Example

### Scenario: User asks AI to "Create a new React component called Button"

```
1. User types in AI chat: "Create a new React component called Button"
   │
   ▼
2. Frontend (useChat hook) sends message to /api/agent
   │
   ▼
3. API Route receives message, calls AI SDK streamText()
   │
   ▼
4. AI SDK sends request to OpenRouter (Claude 3.5 Sonnet)
   │
   ▼
5. Claude analyzes request, decides to use writeFile tool
   Tool call: {
     name: "writeFile",
     arguments: {
       path: "src/components/Button.tsx",
       content: "import React from 'react';\n\nexport const Button = () => { ... }"
     }
   }
   │
   ▼
6. AI SDK executes tool (writeFile function)
   │
   ▼
7. writeFile function calls containerAPI.writeFile(workspaceId, path, content)
   │
   ▼
8. containerAPI sends WebSocket message to container's agent bridge:
   {
     id: "xyz123",
     type: "writeFile",
     payload: { path: "...", content: "..." }
   }
   │
   ▼
9. Agent Bridge in container receives message, writes file to /workspace/src/components/Button.tsx
   │
   ▼
10. Agent Bridge sends response back via WebSocket:
    {
      id: "xyz123",
      success: true
    }
   │
   ▼
11. containerAPI resolves promise with response
   │
   ▼
12. Tool execution completes, AI SDK continues streaming
   │
   ▼
13. AI generates final response: "I've created the Button component at src/components/Button.tsx"
   │
   ▼
14. Response streams to frontend via AI SDK
   │
   ▼
15. User sees message appear in chat
   │
   ▼
16. User can now see Button.tsx in code-server (left side)
```

---

## 🏗️ Project Structure

```
kalpana/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   │   └── page.tsx              # User's workspaces list
│   ├── workspace/
│   │   └── [id]/
│   │       ├── page.tsx          # Main workspace view
│   │       └── settings/
│   │           └── page.tsx      # Workspace settings
│   ├── templates/
│   │   └── page.tsx              # Nix templates marketplace
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts      # NextAuth.js
│       ├── workspaces/
│       │   ├── route.ts          # CRUD operations
│       │   └── [id]/
│       │       ├── start/
│       │       ├── stop/
│       │       └── destroy/
│       ├── agent/
│       │   └── route.ts          # AI Agent API (AI SDK)
│       └── container/
│           └── [id]/
│               └── connect/
│                   └── route.ts  # WebSocket upgrade
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── workspace/
│   │   ├── vscode-iframe.tsx
│   │   ├── ai-agent-chat.tsx
│   │   └── workspace-status.tsx
│   └── dashboard/
│       ├── workspace-card.tsx
│       └── create-workspace-dialog.tsx
│
├── lib/
│   ├── db/
│   │   └── prisma.ts
│   ├── docker/
│   │   ├── manager.ts            # Docker container management
│   │   └── port-manager.ts
│   ├── container-api.ts          # WebSocket client for containers
│   ├── ai/
│   │   ├── openrouter.ts         # OpenRouter config
│   │   └── tools.ts              # AI tool definitions
│   └── utils.ts
│
├── services/
│   ├── workspace-service.ts
│   ├── github-service.ts
│   └── nix-service.ts
│
├── container/                    # Container source code
│   ├── Dockerfile
│   ├── start.sh
│   └── agent-bridge/
│       ├── package.json
│       ├── server.ts             # WebSocket server for AI commands
│       └── handlers/
│           ├── file-ops.ts
│           ├── command-runner.ts
│           └── code-search.ts
│
├── prisma/
│   └── schema.prisma
│
├── public/
├── .env.local
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

---

## 📦 Package Dependencies

```json
{
  "name": "kalpana",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "docker:build": "docker build -t kalpana/workspace:latest ./container",
    "docker:push": "docker push kalpana/workspace:latest",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",

    // AI SDK
    "ai": "^3.0.0",
    "@openrouter/ai-sdk-provider": "^0.0.5",

    // UI
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.303.0",
    "tailwind-merge": "^2.2.0",
    "tailwindcss-animate": "^1.0.7",

    // Auth
    "better-auth": "^1.0.0",
    "mongodb": "^6.3.0",

    // Database
    "@prisma/client": "^5.8.0",

    // Docker
    "dockerode": "^4.0.2",

    // WebSocket
    "ws": "^8.16.0",

    // Validation
    "zod": "^3.22.4",

    // GitHub
    "@octokit/rest": "^20.0.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/dockerode": "^3.3.23",
    "@types/ws": "^8.5.10",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "prisma": "^5.8.0",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

---

## 🔒 Security Checklist

### Container Security

- [ ] **Resource Limits**: Set CPU/memory limits on all containers
- [ ] **User Namespaces**: Run containers as non-root users
- [ ] **No Privileged Mode**: Never use `--privileged` flag
- [ ] **Read-only Root**: Make container filesystem read-only except /workspace
- [ ] **Network Isolation**: Use custom Docker networks
- [ ] **Seccomp Profiles**: Apply seccomp security profiles
- [ ] **Command Whitelist**: Only allow safe commands in agent bridge

### Application Security

- [ ] **Authentication**: Require auth for all workspace operations
- [ ] **Authorization**: Users can only access their own workspaces
- [ ] **Rate Limiting**: Limit API calls per user
- [ ] **Input Validation**: Validate all user inputs with Zod
- [ ] **Path Traversal**: Prevent directory traversal in file operations
- [ ] **XSS Protection**: Sanitize all user-generated content
- [ ] **CSRF Protection**: Use NextAuth.js CSRF tokens
- [ ] **Secrets Management**: Never commit API keys, use env vars

### GitHub Integration

- [ ] **Token Encryption**: Encrypt GitHub tokens at rest
- [ ] **Scope Limitation**: Request minimum necessary OAuth scopes
- [ ] **Token Rotation**: Support token refresh
- [ ] **Webhook Verification**: Verify GitHub webhook signatures

### AI Security

- [ ] **Prompt Injection**: Sanitize user inputs to AI
- [ ] **Tool Sandboxing**: Limit what AI can do (no destructive commands)
- [ ] **Cost Limits**: Set max tokens per request
- [ ] **Content Filtering**: Filter inappropriate AI responses

---

## 📝 Environment Variables

```bash
# .env.example

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database (MongoDB)
DATABASE_URL="mongodb://admin:password@localhost:27017/kalpana?authSource=admin"
# Or MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/kalpana

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-oauth-app-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"

# OpenRouter
OPENROUTER_API_KEY="your-openrouter-api-key"

# Docker
DOCKER_HOST="unix:///var/run/docker.sock"  # or tcp://localhost:2375
CONTAINER_PORT_RANGE_START=40000
CONTAINER_PORT_RANGE_END=50000

# Container Defaults
DEFAULT_CONTAINER_MEMORY="2147483648"  # 2GB in bytes
DEFAULT_CONTAINER_CPU="1000000000"     # 1 CPU in nanocpus

# Feature Flags
ENABLE_NIX_CUSTOM_CONFIGS=true
ENABLE_PRIVATE_REPOS=true
MAX_WORKSPACES_PER_USER=5
```

---

## 🚀 **FINAL** Implementation Roadmap

### Week 1: Foundation & Infrastructure

**Day 1-2: Project Setup**

- [ ] Initialize Next.js 15 project with TypeScript
- [ ] Install and configure shadcn/ui
- [ ] Set up Tailwind CSS
- [ ] Set up MongoDB (local Docker or Atlas)
- [ ] Configure Prisma with MongoDB
- [ ] Set up Better Auth with GitHub OAuth

**Day 3-4: Docker Infrastructure**

- [ ] Create base Dockerfile with Nix
- [ ] Build agent bridge service (WebSocket server)
- [ ] Implement DockerManager service
- [ ] Implement PortManager
- [ ] Test container creation/destruction

**Day 5-7: Database & API**

- [ ] Design Prisma schema (User, Workspace, Session)
- [ ] Create workspace CRUD API routes
- [ ] Implement container start/stop/destroy endpoints
- [ ] Build dashboard UI (workspace list)
- [ ] Build create workspace dialog

### Week 2: VSCode Integration & AI Agent

**Day 8-10: VSCode Server**

- [ ] Integrate code-server in container
- [ ] Build iframe embedding component
- [ ] Implement authentication token system
- [ ] Test VSCode access and file editing
- [ ] Handle connection failures gracefully

**Day 11-13: AI Agent Core**

- [ ] Set up AI SDK with OpenRouter
- [ ] Implement AI agent API route with tools
- [ ] Build container API client (WebSocket)
- [ ] Create AI chat UI component
- [ ] Test file read/write operations

**Day 14: Integration Testing**

- [ ] Test end-to-end flow (create workspace → code → AI agent)
- [ ] Fix bugs and edge cases
- [ ] Performance testing

### Week 3: GitHub & Nix Integration

**Day 15-17: GitHub Integration**

- [ ] GitHub OAuth flow
- [ ] Repository selection UI
- [ ] Clone repo on container start
- [ ] Git operations via agent bridge
- [ ] Private repo support

**Day 18-20: Nix Templates**

- [ ] Create pre-built Nix templates (Node, Python, Rust, etc.)
- [ ] Template selection UI
- [ ] Custom Nix config support
- [ ] Template marketplace page
- [ ] Nix build caching

**Day 21: Polish & Testing**

- [ ] UI/UX improvements
- [ ] Error handling
- [ ] Loading states
- [ ] Integration testing

### Week 4: Production Ready

**Day 22-24: Security & Optimization**

- [ ] Implement all security measures (see checklist)
- [ ] Rate limiting
- [ ] Container resource limits
- [ ] Error boundaries
- [ ] Logging and monitoring

**Day 25-26: Documentation**

- [ ] User documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Developer setup guide

**Day 27-28: Launch Prep**

- [ ] Final testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Beta testing with users

---

## 📝 Next Steps (Immediate Actions)

### 1. **Initialize Project** ✅ Ready to Start

```bash
# Create Next.js app
bunx create-next-app@latest kalpana --typescript --tailwind --app --use-bun

cd kalpana

# Install dependencies
bun add ai @openrouter/ai-sdk-provider zod better-auth mongodb @prisma/client dockerode ws @octokit/rest
bun add -d @types/dockerode @types/ws prisma

# Install shadcn/ui
bunx shadcn@latest init
bunx shadcn@latest add button input card dialog dropdown-menu

# Start MongoDB (local)
docker run -d -p 27017:27017 --name kalpana-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7

# Initialize Prisma with MongoDB
bunx prisma init --datasource-provider mongodb
```

### 2. **Set Up Database Schema**

Create `prisma/schema.prisma` with User and Workspace models

### 3. **Build Docker Image**

Create `container/` directory with Dockerfile and agent bridge

### 4. **Implement Core Services**

- DockerManager
- ContainerAPI
- WorkspaceService

### 5. **Build UI Pages**

- Dashboard
- Workspace view
- Create workspace flow

---

## ❓ Key Questions

1. **User Limits**: How many concurrent workspaces per user?
2. **Persistence**: Auto-save to GitHub? How often?
3. **Idle Timeout**: Auto-stop containers after X minutes of inactivity?
4. **Pricing**: Will this be free, freemium, or paid-only?
5. **Collaboration**: Should workspaces support multiple users (like Live Share)?
6. **Deployment**: Local-only or plan for cloud deployment?

---

**Ready to start building?** 🚀

The architecture is solid:

- ✅ **AI SDK + OpenRouter** ([ai-sdk.dev](https://ai-sdk.dev/docs/introduction)) for flexible LLM access
- ✅ **Docker local** for full control
- ✅ **Dynamic port mapping** for simple container communication
- ✅ **WebSocket bridge** for AI agent commands
- ✅ **code-server** for full IDE experience

Let me know which part you want to implement first!
