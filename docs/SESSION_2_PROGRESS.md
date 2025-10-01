# Kalpana - Session 2 Progress Report

## 🎉 Major Accomplishments

### ✅ Authentication System (Better Auth)

- ✅ Better Auth configured with MongoDB adapter
- ✅ GitHub OAuth provider setup
- ✅ Auth API routes (`/api/auth/[...all]`)
- ✅ Client-side auth hooks
- ✅ Beautiful login page with oil black & green theme
- ✅ Session management

### ✅ Dashboard & UI

- ✅ Full dashboard with workspace list
- ✅ Create new workspace page with template selection
- ✅ Workspace status indicators (STOPPED, STARTING, RUNNING, etc.)
- ✅ Start/Stop workspace controls
- ✅ Beautiful cards and UI components
- ✅ Responsive layout

### ✅ Docker Infrastructure

- ✅ `DockerManager` class for container orchestration
- ✅ `PortManager` for dynamic port allocation (40000-50000)
- ✅ Automatic container creation and lifecycle management
- ✅ Resource limits (CPU, memory)
- ✅ Container health checking
- ✅ Proper cleanup on stop/destroy

### ✅ Workspace Management

- ✅ Complete CRUD API routes:
  - `GET /api/workspaces` - List all workspaces
  - `POST /api/workspaces` - Create workspace
  - `GET /api/workspaces/[id]` - Get single workspace
  - `PATCH /api/workspaces/[id]` - Update workspace
  - `DELETE /api/workspaces/[id]` - Delete workspace
  - `POST /api/workspaces/[id]/start` - Start container
  - `POST /api/workspaces/[id]/stop` - Stop container
- ✅ Workspace limit enforcement (max 5 per user)
- ✅ Template selection (Node, Python, Rust, Go, etc.)
- ✅ GitHub repo integration ready

### ✅ Main Workspace View

- ✅ Split-panel layout (VSCode + AI Chat)
- ✅ VSCode iframe embed (ready for code-server)
- ✅ AI chat sidebar with message UI
- ✅ Status monitoring and controls
- ✅ Real-time workspace status polling
- ✅ Start/Stop controls in workspace view

---

## 📁 Complete File Structure

```
kalpana/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts        # Better Auth handler
│   │   └── workspaces/
│   │       ├── route.ts                   # List & Create
│   │       └── [id]/
│   │           ├── route.ts               # Get, Update, Delete
│   │           ├── start/route.ts         # Start container
│   │           └── stop/route.ts          # Stop container
│   ├── dashboard/
│   │   ├── page.tsx                       # Dashboard with workspace list
│   │   └── new/page.tsx                   # Create new workspace
│   ├── login/
│   │   └── page.tsx                       # Login with GitHub OAuth
│   ├── workspace/[id]/
│   │   └── page.tsx                       # Main workspace view (VSCode + AI)
│   ├── globals.css                        # Oil black & green theme
│   ├── layout.tsx                         # Root layout
│   └── page.tsx                           # Landing page
├── components/
│   └── ui/                                # 8 shadcn/ui components
├── lib/
│   ├── docker/
│   │   ├── manager.ts                     # Docker container management
│   │   └── port-manager.ts                # Port allocation system
│   ├── auth.ts                            # Better Auth server config
│   ├── auth-client.ts                     # Better Auth client hooks
│   ├── db.ts                              # Prisma client singleton
│   └── utils.ts                           # cn() utility
├── prisma/
│   └── schema.prisma                      # User & Workspace models
├── .env.local                             # Environment variables
├── components.json                        # shadcn/ui config
├── package.json                           # Dependencies
└── README.md                              # Documentation
```

---

## 🚧 What's Next (Remaining Work)

### 1. Docker Container Image 🐳

**Priority: HIGH**

Create the base container image with:

```dockerfile
FROM nixos/nix:latest

# Install code-server, git, bun, etc.
RUN nix-env -iA nixpkgs.code-server \
                nixpkgs.git \
                nixpkgs.gh \
                nixpkgs.ripgrep \
                nixpkgs.bun

# Agent bridge WebSocket server
COPY agent-bridge /agent-bridge

# Startup script
COPY start.sh /start.sh

EXPOSE 8080 3001
CMD ["/start.sh"]
```

**Files to create:**

- `container/Dockerfile`
- `container/start.sh`
- `container/agent-bridge/` (WebSocket server)

---

### 2. Agent Bridge WebSocket Server 🌉

**Priority: HIGH**

WebSocket server running inside each container:

```typescript
// Handles AI commands:
// - readFile(path)
// - writeFile(path, content)
// - runCommand(command)
// - searchCode(query)
// - gitCommit(), gitPush()
```

**Files to create:**

- `container/agent-bridge/server.ts`
- `container/agent-bridge/handlers/file-ops.ts`
- `container/agent-bridge/handlers/command-runner.ts`

---

### 3. AI Agent API with AI SDK 🤖

**Priority: HIGH**

Integrate Vercel AI SDK + OpenRouter:

```typescript
// app/api/agent/route.ts
import { streamText, tool } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

export async function POST(req: Request) {
  const result = streamText({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    tools: {
      readFile,
      writeFile,
      runCommand,
      searchCode,
    },
  });
  return result.toDataStreamResponse();
}
```

**Files to create:**

- `app/api/agent/route.ts`
- `lib/container-api.ts` (WebSocket client)
- Update `app/workspace/[id]/page.tsx` with real AI integration

---

### 4. GitHub OAuth Token Storage 🔑

**Priority: MEDIUM**

- Capture GitHub OAuth token during login
- Encrypt and store in database
- Use for cloning private repos
- Handle token refresh

---

### 5. Nix Templates 📦

**Priority: MEDIUM**

Pre-built Nix configurations:

- Node.js template
- Python template
- Rust template
- Go template
- Full-stack template

---

### 6. Repository Cloning 📥

**Priority: MEDIUM**

- Clone GitHub repos on container start
- Support private repos with user's OAuth token
- Handle errors gracefully

---

## 🎨 Screenshots (If we could see them!)

1. **Landing Page**: Beautiful hero with green accents
2. **Login**: Minimal, clean GitHub OAuth
3. **Dashboard**: Workspace cards with status badges
4. **New Workspace**: Template selection grid
5. **Workspace View**: Split panel VSCode + AI chat

---

## 📊 Stats

| Metric          | Count                    |
| --------------- | ------------------------ |
| Files Created   | 25+                      |
| Lines of Code   | ~2500+                   |
| API Routes      | 8                        |
| Pages           | 5                        |
| Components      | 11 (8 shadcn + 3 custom) |
| Database Models | 2                        |
| Docker Services | 1 (DockerManager)        |
| Auth Providers  | 1 (GitHub OAuth)         |

---

## 🔑 Environment Variables Needed

Before running, set these in `.env.local`:

```bash
# Database
DATABASE_URL="mongodb://admin:password@localhost:27017/kalpana?authSource=admin"

# Better Auth
BETTER_AUTH_SECRET="your-32-char-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# OpenRouter
OPENROUTER_API_KEY="your-openrouter-key"

# Docker
DOCKER_HOST="unix:///var/run/docker.sock"  # or npipe:////./pipe/docker_engine on Windows
```

---

## 🚀 How to Run (Current State)

1. **Start MongoDB:**

```bash
docker run -d -p 27017:27017 --name kalpana-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7
```

2. **Set up database:**

```bash
cd kalpana
bunx prisma db push
```

3. **Start dev server:**

```bash
bun dev
```

4. **Visit:**

```
http://localhost:3000
```

---

## 🎯 Next Session Goals

1. **Build Docker container image** with code-server and agent bridge
2. **Implement AI agent** with AI SDK + OpenRouter
3. **Test end-to-end flow**: Create workspace → Start → Code → AI chat
4. **Add GitHub repo cloning**
5. **Polish UI/UX**

---

## 💡 Architecture Highlights

### Port Allocation Strategy

- Each workspace gets 2 ports: VSCode (8080→40001) + Agent (3001→40002)
- Ports tracked in MongoDB
- Automatic allocation from pool (40000-50000)
- Supports up to 5,000 concurrent workspaces!

### Security

- User authentication required for all operations
- Users can only access their own workspaces
- Container resource limits enforced
- GitHub tokens encrypted (when implemented)
- No privileged containers

### Scalability

- Stateless Next.js app (can scale horizontally)
- MongoDB for persistent state
- Docker containers isolated per workspace
- Port pooling allows thousands of concurrent workspaces

---

**Status**: 🟢 Core infrastructure complete! Ready for Docker image and AI integration.

**Next**: Build the container image and connect AI agent! 🚀
