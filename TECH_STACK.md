# Kalpana - Final Tech Stack

## 🎯 Architecture Summary

**Kalpana** is a web-based cloud development platform with VSCode Server + AI Agent.

---

## 📦 Technology Stack (FINAL)

| Layer          | Technology                             | Why?                                           |
| -------------- | -------------------------------------- | ---------------------------------------------- |
| **Frontend**   | Next.js 15 + App Router                | Modern React framework                         |
| **UI**         | shadcn/ui + Tailwind CSS               | Beautiful, accessible components               |
| **Database**   | MongoDB + Prisma                       | Flexible schema, easy setup, JSON-native       |
| **Auth**       | [Better Auth](https://better-auth.com) | Modern, type-safe, plugin ecosystem            |
| **AI SDK**     | [Vercel AI SDK](https://ai-sdk.dev)    | Unified LLM interface, streaming, tool calling |
| **LLM**        | OpenRouter                             | Access to all models (Claude, GPT-4, etc.)     |
| **Containers** | Docker (local)                         | Full control, simple, cost-effective           |
| **IDE**        | code-server                            | Full VSCode in browser                         |
| **Runtime**    | Nix                                    | Reproducible development environments          |
| **Real-time**  | WebSockets                             | Bidirectional communication                    |

---

## 🔌 Port Allocation Strategy

### The Problem You Identified:

> "What if I'm in two workspaces? Won't the ports conflict?"

### The Solution: Dynamic Port Mapping

Docker containers can all use the **same internal ports** (because they're isolated), but each needs **unique host ports**.

#### How It Works:

```typescript
// PortManager allocates ports sequentially
class PortManager {
  private usedPorts = new Set<number>();
  private currentPort = 40000;

  allocate(): number {
    while (this.usedPorts.has(this.currentPort)) {
      this.currentPort++;
    }
    this.usedPorts.add(this.currentPort);
    return this.currentPort++;
  }

  release(port: number) {
    this.usedPorts.delete(port);
  }
}
```

#### Example with 3 Workspaces:

```
User has 3 workspaces open simultaneously:

┌─────────────────────────────────────────────────────┐
│  Workspace 1: "My React App"                        │
│  ├─ Container: workspace-abc123                     │
│  ├─ Internal ports: 8080, 3001                      │
│  └─ Host ports: 40001 (VSCode), 40002 (Agent)      │
│     Access: localhost:40001                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Workspace 2: "Backend API"                         │
│  ├─ Container: workspace-def456                     │
│  ├─ Internal ports: 8080, 3001  ← Same internal!   │
│  └─ Host ports: 40003 (VSCode), 40004 (Agent)      │
│     Access: localhost:40003                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Workspace 3: "ML Project"                          │
│  ├─ Container: workspace-ghi789                     │
│  ├─ Internal ports: 8080, 3001  ← Same internal!   │
│  └─ Host ports: 40005 (VSCode), 40006 (Agent)      │
│     Access: localhost:40005                         │
└─────────────────────────────────────────────────────┘
```

#### In MongoDB:

```javascript
// All workspaces stored with their port assignments
{
  workspaces: [
    {
      _id: "abc123",
      name: "My React App",
      vscodePort: 40001,
      agentPort: 40002,
      status: "RUNNING",
    },
    {
      _id: "def456",
      name: "Backend API",
      vscodePort: 40003,
      agentPort: 40004,
      status: "RUNNING",
    },
    {
      _id: "ghi789",
      name: "ML Project",
      vscodePort: 40005,
      agentPort: 40006,
      status: "RUNNING",
    },
  ];
}
```

#### Browser Access:

```typescript
// User opens workspace 1
window.open("http://localhost:40001"); // VSCode for workspace 1

// User opens workspace 2 in another tab
window.open("http://localhost:40003"); // VSCode for workspace 2

// Both work simultaneously! ✅
```

### Capacity:

- **Port range**: 40000 - 50000 (10,000 ports)
- **Ports per workspace**: 2 (VSCode + Agent)
- **Max concurrent workspaces**: **5,000**

This is more than enough for most use cases!

---

## 🤖 AI Agent Flow

```typescript
// 1. User asks AI in workspace 1
User Input → AI Chat (localhost:3000)
    ↓
// 2. Next.js API route receives request
POST /api/agent { workspaceId: "abc123", message: "..." }
    ↓
// 3. AI SDK calls OpenRouter (Claude)
streamText({ model: claude, tools: [...] })
    ↓
// 4. AI decides to write a file
tool.writeFile({ path: "...", content: "..." })
    ↓
// 5. Tool connects to workspace 1's agent bridge
WebSocket → localhost:40002 (workspace 1's agent port)
    ↓
// 6. Agent bridge writes file in container
writeFile("/workspace/src/...")
    ↓
// 7. File appears in VSCode
User sees file in localhost:40001
```

**Simultaneously**, if user is in workspace 2:

```typescript
// Workspace 2 AI agent uses different port
WebSocket → localhost:40004 (workspace 2's agent port)
    ↓
writeFile in workspace 2's container
    ↓
File appears in localhost:40003
```

**No conflicts!** Each workspace has its own isolated container and ports.

---

## 🗄️ Database Schema (MongoDB + Prisma)

```prisma
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
  githubId      String?     @unique
  workspaces    Workspace[]
  createdAt     DateTime    @default(now())
}

model Workspace {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String

  // Container metadata
  containerId     String?
  vscodePort      Int?      // Dynamically assigned host port
  agentPort       Int?      // Dynamically assigned host port
  status          WorkspaceStatus @default(STOPPED)

  // Configuration
  githubRepo      String?
  nixConfig       String?
  template        String?

  // Relations
  userId          String   @db.ObjectId
  user            User     @relation(fields: [userId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum WorkspaceStatus {
  STOPPED
  STARTING
  RUNNING
  STOPPING
  ERROR
}
```

---

## 🔐 Authentication (Better Auth)

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

export const auth = betterAuth({
  database: mongodbAdapter(db),

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ["read:user", "repo"],
    },
  },
});
```

**Benefits:**

- ✅ Modern, type-safe API
- ✅ Native MongoDB support
- ✅ Plugin ecosystem (2FA, passkeys, SSO)
- ✅ Framework agnostic
- ✅ Better DX than NextAuth.js

---

## 🐳 Docker Container Structure

```dockerfile
FROM nixos/nix:latest

# Install essentials
RUN nix-env -iA nixpkgs.code-server \
                nixpkgs.git \
                nixpkgs.bun

WORKDIR /workspace

# Agent bridge (WebSocket server for AI commands)
COPY agent-bridge /agent-bridge
RUN cd /agent-bridge && bun install

EXPOSE 8080 3001

CMD ["/start.sh"]
```

Each container runs:

1. **code-server** on port 8080 (VSCode interface)
2. **Agent bridge** on port 3001 (WebSocket for AI commands)
3. **User's workspace** at `/workspace/`

---

## 📊 Request Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Browser                            │
│  ┌────────────────┐         ┌──────────────────┐    │
│  │ Workspace 1    │         │  Workspace 2     │    │
│  │ localhost:40001│         │  localhost:40003 │    │
│  └────────────────┘         └──────────────────┘    │
└──────────────────────────────────────────────────────┘
                │                        │
                │                        │
        ┌───────┴────────┐      ┌───────┴────────┐
        │ Container 1    │      │ Container 2    │
        │ (workspace-1)  │      │ (workspace-2)  │
        │                │      │                │
        │ Ports:         │      │ Ports:         │
        │ 8080→40001     │      │ 8080→40003     │
        │ 3001→40002     │      │ 3001→40004     │
        └────────────────┘      └────────────────┘
                │                        │
                └────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Next.js App         │
                │   - API Routes        │
                │   - AI Agent          │
                │   - Docker Manager    │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   MongoDB             │
                │   - Users             │
                │   - Workspaces        │
                │   - Sessions          │
                └───────────────────────┘
```

---

## 🚀 Quick Start Commands

```bash
# 1. Create project
bunx create-next-app@latest kalpana --typescript --tailwind --app --use-bun
cd kalpana

# 2. Install dependencies
bun add ai @openrouter/ai-sdk-provider zod better-auth mongodb @prisma/client dockerode ws
bun add -d @types/dockerode @types/ws prisma

# 3. Install UI components
bunx shadcn@latest init
bunx shadcn@latest add button input card dialog

# 4. Start MongoDB
docker run -d -p 27017:27017 --name kalpana-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7

# 5. Configure database
echo 'DATABASE_URL="mongodb://admin:password@localhost:27017/kalpana?authSource=admin"' > .env.local

# 6. Initialize Prisma
bunx prisma init --datasource-provider mongodb

# 7. Create database schema
bunx prisma db push

# 8. Build container image
docker build -t kalpana/workspace:latest ./container

# 9. Start development
bun dev
```

---

## ✅ Key Takeaways

1. **Port conflicts are handled** - Each workspace gets unique host ports
2. **Internal ports can be the same** - Docker isolates containers
3. **PortManager tracks allocation** - Sequential assignment from pool
4. **MongoDB stores port mappings** - Persists which workspace uses which ports
5. **Up to 5,000 concurrent workspaces** - More than enough capacity

**You can absolutely have multiple workspaces open at the same time!** ✨

---

## 📚 References

- [Better Auth Docs](https://www.better-auth.com/docs/introduction)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Prisma MongoDB](https://www.prisma.io/docs/concepts/database-connectors/mongodb)
- [code-server](https://github.com/coder/code-server)
- [Dockerode](https://github.com/apocas/dockerode)

Ready to start building! 🚀
