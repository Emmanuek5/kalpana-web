# Kalpana 🚀

Your AI-powered cloud development environment. VSCode in the browser with GitHub integration and Nix-based runtimes.

## 🎨 Design

**Color Scheme**: Oil Black & Green

- Primary: `#00ff88` (Vibrant Green)
- Background: `#0a0e0d` (Oil Black)
- Accent: Green highlights throughout

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: MongoDB + Prisma
- **Auth**: Better Auth
- **AI**: Vercel AI SDK + OpenRouter
- **Containers**: Docker + Dockerode
- **IDE**: code-server (VSCode in browser)
- **Runtime**: Nix

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- [Docker](https://www.docker.com/get-started)
- [MongoDB](https://www.mongodb.com/try/download/community) (or use Docker)

### Installation

1. **Clone the repository** (if from Git)

   ```bash
   git clone <your-repo-url>
   cd kalpana
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start MongoDB** (using Docker)

   ```bash
   docker run -d -p 27017:27017 --name kalpana-mongo \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=password \
     mongo:7
   ```

4. **Set up environment variables**

   ```bash
   # Copy the example file
   cp .env.example .env.local

   # Edit .env.local and add your credentials:
   # - GitHub OAuth credentials
   # - OpenRouter API key
   ```

5. **Initialize database**

   ```bash
   bunx prisma generate
   bunx prisma db push
   ```

6. **Start development server**

   ```bash
   bun dev
   ```

7. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
kalpana/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, workspaces, agent)
│   ├── dashboard/         # Dashboard page
│   ├── workspace/[id]/    # Workspace view
│   └── page.tsx           # Landing page
├── components/
│   ├── ui/                # shadcn/ui components
│   └── ...                # Custom components
├── lib/
│   ├── db.ts              # Prisma client
│   ├── auth.ts            # Better Auth config
│   ├── docker/            # Docker management
│   └── utils.ts           # Utilities
├── prisma/
│   └── schema.prisma      # Database schema
└── container/             # Docker container source (coming soon)
```

## 🔑 Environment Variables

See `.env.example` for all required environment variables.

### Required:

- `DATABASE_URL` - MongoDB connection string
- `BETTER_AUTH_SECRET` - Auth secret (32+ chars)
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `OPENROUTER_API_KEY` - OpenRouter API key

## 🐳 Docker Setup

Ensure Docker is running:

```bash
docker ps
```

### Build the workspace image

Use the provided scripts (they auto-detect if your cwd is repo root or `kalpana/`):

```bash
# From repo root OR from kalpana/
bun run container:build

# Or specify a custom image name
WORKSPACE_IMAGE=myorg/kalpana-workspace:dev bun run container:build
```

To build manually:

```bash
# From repo root
docker build -t kalpana/workspace:latest kalpana/container

# From kalpana/
docker build -t kalpana/workspace:latest container
```

### Docker host configuration

If you use `DOCKER_HOST`, it is supported in formats `tcp://`, `http(s)://`, `unix://` and `npipe://`.

- Windows (Docker Desktop): prefer default named pipe (unset `DOCKER_HOST`), or set `DOCKER_HOST=npipe://./pipe/docker_engine`.
- Linux/Mac: default is `/var/run/docker.sock`. If exposing daemon on TCP, e.g. `http://localhost:2375`, ensure it's enabled.

## 📝 Development Progress

- [x] Project setup with Next.js 15
- [x] Oil black & green theme
- [x] shadcn/ui components
- [x] MongoDB + Prisma setup
- [x] Better Auth with GitHub OAuth
- [x] Docker container management (DockerManager + PortManager)
- [x] VSCode server integration (code-server in containers)
- [x] AI agent with AI SDK + OpenRouter
- [x] Agent bridge WebSocket server
- [x] GitHub repository cloning (ready)
- [x] Nix runtime templates (6 templates)
- [x] Complete dashboard & workspace UI
- [x] Real-time AI chat with streaming
- [ ] GitHub OAuth token storage (optional enhancement)

**Status**: 95% Complete - Production Ready! 🚀

## 🤝 Contributing

This is a personal project, but contributions are welcome!

## 📄 License

MIT

## 🙏 Acknowledgments

- [code-server](https://github.com/coder/code-server)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Better Auth](https://better-auth.com)
- [shadcn/ui](https://ui.shadcn.com)

---

Built with ❤️ and ☕
