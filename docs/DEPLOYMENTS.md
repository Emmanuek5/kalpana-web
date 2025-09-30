# Deployment System Guide

This guide explains how to use Kalpana's deployment system to deploy applications with automated builds and routing.

## Overview

The deployment system allows you to:

- 🚀 Deploy applications from your workspaces
- 🏗️ Automated build processes with custom commands
- 🌐 Subdomain routing with Traefik (optional)
- 🔌 Port-based access when no base URL is configured
- 🔄 Auto-rebuild on GitHub pushes via webhooks
- 📊 Build history and tracking
- 🔍 Real-time deployment logs

## Architecture

### Components

1. **Deployment Manager** - Manages deployment lifecycle
2. **Traefik Manager** - Handles dynamic subdomain routing
3. **Build System** - Tracks and executes builds
4. **Webhook Handler** - Auto-rebuild on GitHub events

### Deployment Modes

#### 1. Subdomain Routing (with Traefik)
- Requires `TRAEFIK_BASE_URL` environment variable
- Automatic HTTPS with Let's Encrypt
- Access via: `https://[subdomain].[base-url]`

#### 2. Port Mapping (without Traefik)
- Direct port exposure when no base URL is set
- Access via: `http://localhost:[port]`

## Getting Started

### 1. Environment Variables

Add these to your `.env` file:

```env
# Required for subdomain routing (optional)
TRAEFIK_BASE_URL=example.com
TRAEFIK_EMAIL=admin@example.com

# Traefik network (optional, defaults to traefik-proxy)
TRAEFIK_NETWORK=traefik-proxy
```

### 2. Create a Deployment

1. Navigate to your workspace
2. Click the **Deployments** tab
3. Click **New Deployment**
4. Configure your deployment:
   - **Name**: Deployment identifier
   - **Description**: Optional description
   - **Build Command**: Command to build your app (e.g., `npm run build`)
   - **Start Command**: Command to start your app (e.g., `npm start`)
   - **Working Directory**: Where to run commands (default: `/workspace`)
   - **Port**: Application port inside container (e.g., `3000`)
   - **Subdomain**: Subdomain for routing (only if base URL is set)
   - **Auto-rebuild**: Enable GitHub webhook auto-rebuild

### 3. Deploy Your Application

1. Click the **Play** button on your deployment
2. Watch the real-time deployment logs
3. Access your application via the provided URL

## Traefik Setup

### Prerequisites

- Docker installed
- Ports 80, 443, and 8080 available
- Domain name pointing to your server (for subdomain routing)

### Automatic Setup

Traefik is automatically configured when:
1. `TRAEFIK_BASE_URL` is set
2. First deployment with subdomain is created

### Manual Setup

If needed, you can set up Traefik manually:

```bash
# Create network
docker network create traefik-proxy

# Run Traefik
docker run -d \
  --name kalpana-traefik \
  --network traefik-proxy \
  -p 80:80 \
  -p 443:443 \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v kalpana-letsencrypt:/letsencrypt \
  traefik:v2.10 \
  --api.insecure=true \
  --api.dashboard=true \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --providers.docker.network=traefik-proxy \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --certificatesresolvers.letsencrypt.acme.httpchallenge=true \
  --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web \
  --certificatesresolvers.letsencrypt.acme.email=admin@example.com \
  --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
```

### Traefik Dashboard

Access the Traefik dashboard at: `http://localhost:8080`

## GitHub Webhook Integration

### Setup

1. **Enable Auto-rebuild** when creating deployment
2. **Copy Webhook URL** from the deployment card
3. **Configure GitHub Webhook**:
   - Go to your repository → Settings → Webhooks
   - Click "Add webhook"
   - Paste the webhook URL
   - Content type: `application/json`
   - Secret: (optional, but recommended)
   - Select "Just the push event"
   - Click "Add webhook"

### How It Works

1. You push to your GitHub repository
2. GitHub sends webhook to Kalpana
3. Kalpana triggers rebuild automatically
4. Build logs are tracked
5. Application is redeployed

### Webhook Security

- Webhooks are verified using HMAC SHA-256 signatures
- Each deployment has a unique webhook secret
- Only pushes to the configured branch trigger rebuilds

## Build System

### Build Process

1. **Build Phase** (if build command is set):
   - Runs in workspace container
   - Executes build command in working directory
   - Logs are captured and streamed

2. **Deploy Phase**:
   - Creates deployment container from workspace volume
   - Configures networking (Traefik or port mapping)
   - Starts application with start command

### Build Tracking

- Each deployment tracks build history
- Build status: `PENDING`, `BUILDING`, `SUCCESS`, `FAILED`, `CANCELLED`
- Stores commit information (hash, message, branch)
- Tracks trigger source: `manual`, `webhook`, `auto`

### Build Logs

- Real-time streaming during builds
- Historical logs stored in database
- Access via deployment logs endpoint

## API Reference

### Create Deployment

**POST** `/api/workspaces/:workspaceId/deployments`

```json
{
  "name": "my-app",
  "description": "My application",
  "buildCommand": "npm run build",
  "startCommand": "npm start",
  "workingDir": "/workspace",
  "port": 3000,
  "subdomain": "my-app",
  "autoRebuild": true
}
```

### List Deployments

**GET** `/api/workspaces/:workspaceId/deployments`

### Deploy Application

**POST** `/api/deployments/:deploymentId/deploy`

Returns Server-Sent Events stream with deployment logs.

### Stop Deployment

**POST** `/api/deployments/:deploymentId/stop`

### Delete Deployment

**DELETE** `/api/deployments/:deploymentId`

### Get Build History

**GET** `/api/deployments/:deploymentId/builds`

### Webhook Endpoint

**POST** `/api/deployments/:deploymentId/webhook`

## Examples

### Node.js Application

```json
{
  "name": "node-api",
  "buildCommand": "npm install && npm run build",
  "startCommand": "npm start",
  "port": 3000,
  "subdomain": "api"
}
```

### Next.js Application

```json
{
  "name": "nextjs-app",
  "buildCommand": "npm install && npm run build",
  "startCommand": "npm start",
  "port": 3000,
  "subdomain": "app"
}
```

### Python Flask Application

```json
{
  "name": "flask-api",
  "buildCommand": "pip install -r requirements.txt",
  "startCommand": "python app.py",
  "port": 5000,
  "subdomain": "flask"
}
```

### Static Site with HTTP Server

```json
{
  "name": "static-site",
  "buildCommand": "npm run build",
  "startCommand": "npx serve -s build -l 3000",
  "port": 3000,
  "subdomain": "site"
}
```

## Database Schema

### Deployment Model

```prisma
model Deployment {
  id              String            @id @default(auto()) @map("_id") @db.ObjectId
  name            String
  description     String?
  containerId     String?
  port            Int?
  exposedPort     Int?
  status          DeploymentStatus  @default(STOPPED)
  buildCommand    String?
  startCommand    String
  workingDir      String?
  envVars         String?
  subdomain       String?
  baseUrl         String?
  autoRebuild     Boolean           @default(false)
  webhookSecret   String?
  workspaceId     String            @db.ObjectId
  workspace       Workspace         @relation(...)
  builds          Build[]
  lastDeployedAt  DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}
```

### Build Model

```prisma
model Build {
  id              String      @id @default(auto()) @map("_id") @db.ObjectId
  deploymentId    String      @db.ObjectId
  deployment      Deployment  @relation(...)
  status          BuildStatus @default(PENDING)
  logs            String?
  errorMessage    String?
  commitHash      String?
  commitMessage   String?
  branch          String?
  triggeredBy     String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime    @default(now())
}
```

## Troubleshooting

### Deployment Failed

1. Check workspace is running
2. Verify build/start commands are correct
3. Check deployment logs for errors
4. Ensure port is not already in use

### Subdomain Not Working

1. Verify `TRAEFIK_BASE_URL` is set
2. Check DNS points to your server
3. Ensure Traefik container is running
4. Verify deployment is connected to Traefik network

### Webhook Not Triggering

1. Check webhook URL is correct
2. Verify GitHub webhook configuration
3. Check webhook secret matches
4. Review GitHub webhook delivery logs

### Build Fails

1. Verify build command is correct
2. Check workspace has necessary dependencies
3. Review build logs for specific errors
4. Ensure working directory exists

## Best Practices

1. **Use Build Commands**: Pre-build your applications for faster deployments
2. **Set Working Directory**: Specify exact directory for commands
3. **Enable Auto-rebuild**: Automate deployments on code changes
4. **Monitor Logs**: Check deployment logs for issues
5. **Use Subdomains**: Better organization than port numbers
6. **Test Locally First**: Ensure commands work in workspace before deploying

## Security Considerations

1. **Webhook Secrets**: Always use webhook secrets for auto-rebuild
2. **Port Exposure**: Be careful with publicly exposed ports
3. **Environment Variables**: Don't store secrets in deployment config
4. **Network Isolation**: Deployments run in isolated containers
5. **Resource Limits**: Consider setting memory/CPU limits

## Next Steps

- [Working with Workspaces](./WORKSPACES.md)
- [GitHub Integration](./GITHUB_INTEGRATION.md)
- [Container Management](./CONTAINERS.md)