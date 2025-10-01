# 🔀 Routing Architecture in Kalpana

## Overview

Kalpana supports **two routing modes** that can work independently or together:

1. **Port-Based Routing** (Default, Always Available)
2. **Domain-Based Routing** (Optional, via Traefik)

---

## 🎯 Mode 1: Port-Based Routing (Default)

### How It Works

Each deployment gets a **unique port** on the host machine. This is the simplest and most reliable method.

```
┌─────────────────────────────────────────────┐
│           User's Browser                     │
│                                              │
│  http://localhost:40001  (Deployment 1)     │
│  http://localhost:40002  (Deployment 2)     │
│  http://localhost:40003  (Deployment 3)     │
│                                              │
└──────────┬──────────────────────────────────┘
           │
           │ Port mappings managed by Docker
           ▼
┌─────────────────────────────────────────────┐
│           Docker Host                        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ Container 1  │  │ Container 2  │         │
│  │              │  │              │         │
│  │ App: 3000 ──►├─►│ 40001:3000   │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
└─────────────────────────────────────────────┘
```

### Code Implementation

```typescript
// lib/docker/port-manager.ts
export class PortManager {
  // Allocates unique ports from a range
  async allocateDeploymentPort(): Promise<number> {
    const minPort = parseInt(
      process.env.DEPLOYMENT_PORT_RANGE_START || "40000"
    );
    const maxPort = parseInt(process.env.DEPLOYMENT_PORT_RANGE_END || "50000");

    // Find next available port
    for (let port = minPort; port <= maxPort; port++) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return port;
      }
    }

    throw new Error("No ports available in range");
  }
}
```

```typescript
// lib/docker/deployment-manager.ts
async createDeployment(workspaceId: string, config: DeploymentConfig) {
  // Allocate a unique port
  const hostPort = await this.portManager.allocateDeploymentPort();

  // Create container with port mapping
  const container = await this.docker.createContainer({
    Image: imageName,
    ExposedPorts: {
      [`${config.port}/tcp`]: {},
    },
    HostConfig: {
      PortBindings: {
        [`${config.port}/tcp`]: [
          { HostPort: hostPort.toString() }
        ],
      },
    },
  });

  // User can now access at http://localhost:${hostPort}
}
```

### Pros & Cons

✅ **Pros:**

- Simple and reliable
- No additional services needed
- Works immediately out of the box
- Perfect for development and testing
- Easy to debug (direct connection)

❌ **Cons:**

- URLs are not user-friendly (localhost:40001)
- Limited by available port range
- Need to remember port numbers
- Not suitable for production domains

---

## 🌐 Mode 2: Domain-Based Routing (Traefik)

### How It Works

**Traefik** acts as a reverse proxy, routing requests based on **subdomains** or **custom domains**.

```
┌────────────────────────────────────────────────┐
│              User's Browser                     │
│                                                 │
│  https://api.example.com                       │
│  https://app.example.com                       │
│  https://blog.example.com                      │
│                                                 │
└──────────┬─────────────────────────────────────┘
           │
           │ DNS resolves to your server IP
           ▼
┌────────────────────────────────────────────────┐
│         Traefik Reverse Proxy                  │
│              (Port 80/443)                     │
│                                                 │
│  Routes based on Host header:                  │
│  ┌─────────────────────────────────┐           │
│  │ Host: api.example.com           │           │
│  │   → Container: deployment-1     │           │
│  │                                 │           │
│  │ Host: app.example.com           │           │
│  │   → Container: deployment-2     │           │
│  │                                 │           │
│  │ Host: blog.example.com          │           │
│  │   → Container: deployment-3     │           │
│  └─────────────────────────────────┘           │
│                                                 │
└──────────┬─────────────────────────────────────┘
           │
           │ Internal Docker network
           ▼
┌────────────────────────────────────────────────┐
│         Docker Network (traefik-proxy)         │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ deployment-1 │  │ deployment-2 │            │
│  │ (api)        │  │ (app)        │            │
│  │              │  │              │            │
│  │ Port: 3000   │  │ Port: 8080   │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
└────────────────────────────────────────────────┘
```

### Code Implementation

```typescript
// lib/docker/traefik-manager.ts
export class TraefikManager {
  /**
   * Generate Traefik labels for a deployment
   */
  generateLabels(
    deploymentId: string,
    subdomain: string,
    port: number,
    baseUrl?: string
  ): Record<string, string> {
    const routerName = `deployment-${deploymentId}`;
    const serviceName = `deployment-${deploymentId}`;

    const labels: Record<string, string> = {
      "traefik.enable": "true",
      "kalpana.deployment.id": deploymentId,
    };

    if (baseUrl) {
      // Subdomain routing: subdomain.example.com
      const host = `${subdomain}.${baseUrl}`;

      // Route HTTP requests to this container
      labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${host}\`)`;
      labels[`traefik.http.routers.${routerName}.entrypoints`] = "websecure";

      // SSL certificate via Let's Encrypt
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] =
        "letsencrypt";

      // Tell Traefik which port the app listens on
      labels[`traefik.http.services.${serviceName}.loadbalancer.server.port`] =
        port.toString();
    }

    return labels;
  }
}
```

```typescript
// Example: Creating a deployment with domain routing
async createDeployment(workspaceId: string, config: DeploymentConfig) {
  const deployment = await prisma.deployment.create({
    data: {
      name: config.name,
      subdomain: "api", // or auto-generated: "happy-cloud-1234"
      domainId: domain.id, // Links to: example.com
      port: 3000,
      // ...
    },
  });

  // Generate Traefik labels
  const labels = traefikManager.generateLabels(
    deployment.id,
    "api",
    3000,
    "example.com"
  );

  // Container will be accessible at: https://api.example.com
  const container = await this.docker.createContainer({
    Image: imageName,
    Labels: labels, // Traefik reads these labels
    NetworkMode: "traefik-proxy", // Connect to Traefik network
  });
}
```

### Pros & Cons

✅ **Pros:**

- Beautiful, user-friendly URLs
- Automatic SSL certificates (Let's Encrypt)
- Production-ready
- Single entry point (port 80/443)
- WebSocket support
- HTTP/2 and HTTP/3 support

❌ **Cons:**

- Requires additional setup
- Need a domain name
- DNS configuration required
- More complex debugging
- Additional service to maintain (Traefik)

---

## 📋 Database Schema

```prisma
model Domain {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  domain      String       @unique  // e.g., "example.com"
  verified    Boolean      @default(false)
  isDefault   Boolean      @default(false)

  userId      String       @db.ObjectId
  user        User         @relation(fields: [userId], references: [id])

  deployments Deployment[] @relation("DeploymentDomain")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Deployment {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  name         String

  // Port-based routing
  port         Int       // App port inside container
  hostPort     Int?      // Allocated host port (40001, 40002, etc.)

  // Domain-based routing (optional)
  subdomain    String?   // "api", "app", "blog"
  domainId     String?   @db.ObjectId
  domain       Domain?   @relation("DeploymentDomain", fields: [domainId], references: [id])
  customDomain String?   // Full custom domain (overrides subdomain)

  // ...
}
```

---

## 🚀 Usage Examples

### Example 1: Port-Based Routing (Simple)

```typescript
// Create a deployment without domain
const deployment = await deploymentManager.createDeployment(workspaceId, {
  name: "My API",
  startCommand: "npm start",
  port: 3000,
  // No subdomain or domain specified
});

// Access at: http://localhost:40001
// (hostPort is auto-allocated)
```

### Example 2: Subdomain Routing

```typescript
// 1. Add a domain first
const domain = await prisma.domain.create({
  data: {
    domain: "example.com",
    verified: true,
    userId: user.id,
  },
});

// 2. Create deployment with subdomain
const deployment = await deploymentManager.createDeployment(workspaceId, {
  name: "API Server",
  startCommand: "npm start",
  port: 3000,
  subdomain: "api", // Manually specified
  domainId: domain.id,
});

// Access at: https://api.example.com
```

### Example 3: Auto-Generated Subdomain

```typescript
// System generates a unique subdomain
const deployment = await deploymentManager.createDeployment(workspaceId, {
  name: "My App",
  startCommand: "npm start",
  port: 3000,
  domainId: domain.id,
  // No subdomain specified - auto-generates like "happy-cloud-1234"
});

// Access at: https://happy-cloud-1234.example.com
```

### Example 4: Custom Domain

```typescript
// Use a completely custom domain
const deployment = await deploymentManager.createDeployment(workspaceId, {
  name: "Main Site",
  startCommand: "npm start",
  port: 3000,
  customDomain: "www.mysite.com",
  // No subdomain or domainId needed
});

// Access at: https://www.mysite.com
// (Requires DNS A record pointing to your server)
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Port-based routing
DEPLOYMENT_PORT_RANGE_START=40000
DEPLOYMENT_PORT_RANGE_END=50000

# Traefik (domain-based routing)
TRAEFIK_BASE_URL=kalpana.local        # OPTIONAL: For local testing only
                                       # Actual routing uses domains from DATABASE!
TRAEFIK_EMAIL=admin@example.com       # For Let's Encrypt SSL
TRAEFIK_NETWORK=traefik-proxy         # Docker network name
```

**Important:** `TRAEFIK_BASE_URL` is NOT used for routing! It's only used for:

- Initial Traefik setup
- Default domain for local testing
- Checking if Traefik should be enabled

**Actual routing** is 100% driven by domains stored in your **database**. Each user can add their own custom domains via the UI, and Traefik will automatically route them!

### Enable Traefik

```typescript
// Automatically starts Traefik if baseUrl is configured
await traefikManager.ensureTraefik();

// Check if Traefik is enabled
if (traefikManager.isEnabled()) {
  console.log("Domain-based routing is available");
} else {
  console.log("Using port-based routing only");
}
```

---

## 🌍 DNS Configuration

For domain-based routing to work, you need to configure DNS:

### A Record (Apex Domain)

```
example.com   →   A   →   123.45.67.89 (your server IP)
```

### Wildcard Subdomain

```
*.example.com →   A   →   123.45.67.89 (same IP)
```

This allows any subdomain to route to your server, and Traefik will handle the routing internally.

---

## 🔍 How Routing is Determined

```typescript
// lib/docker/deployment-manager.ts (simplified)

async getDeploymentUrl(deployment: Deployment): Promise<string> {
  // Priority 1: Custom domain
  if (deployment.customDomain) {
    return `https://${deployment.customDomain}`;
  }

  // Priority 2: Subdomain + domain
  if (deployment.subdomain && deployment.domain) {
    return `https://${deployment.subdomain}.${deployment.domain.domain}`;
  }

  // Priority 3: Port-based (fallback)
  if (deployment.hostPort) {
    return `http://localhost:${deployment.hostPort}`;
  }

  return "";
}
```

---

## 📊 Comparison Table

| Feature          | Port-Based        | Domain-Based (Traefik)     |
| ---------------- | ----------------- | -------------------------- |
| Setup Complexity | ⭐ Simple         | ⭐⭐⭐ Complex             |
| URL Beauty       | `localhost:40001` | `api.example.com`          |
| SSL/HTTPS        | ❌ No             | ✅ Auto (Let's Encrypt)    |
| Custom Domains   | ❌ No             | ✅ Yes                     |
| Production Ready | ⚠️ Limited        | ✅ Yes                     |
| Debugging        | ✅ Easy           | ⚠️ Moderate                |
| WebSocket        | ✅ Yes            | ✅ Yes                     |
| Cost             | ✅ Free           | ✅ Free (domain cost only) |

---

## 🎯 Recommended Setup

### For Development

Use **port-based routing** - it's simple, fast, and perfect for local development.

### For Production

Use **Traefik with domain routing** - provides beautiful URLs, automatic SSL, and is production-ready.

### For Hybrid

Use **both** - port-based for internal services, domain-based for public-facing deployments.

---

## 🐛 Debugging

### Check Port Allocation

```bash
# See what ports are in use
netstat -an | grep LISTEN | grep 400

# Check Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### Check Traefik Routing

```bash
# Access Traefik dashboard
http://localhost:8080/dashboard/

# Check Traefik logs
docker logs kalpana-traefik

# Inspect container labels
docker inspect deployment-xxx | grep -A 20 Labels
```

### Test Domain Resolution

```bash
# Check DNS
nslookup api.example.com

# Test with curl
curl -H "Host: api.example.com" http://localhost
```

---

## 🔗 Related Files

- `lib/docker/traefik-manager.ts` - Traefik configuration & management
- `lib/docker/deployment-manager.ts` - Deployment creation with routing
- `lib/docker/port-manager.ts` - Port allocation system
- `lib/subdomain-generator.ts` - Auto-generate unique subdomains
- `app/api/domains/*` - Domain management API
- `app/api/deployments/[id]/route.ts` - Deployment API with routing

---

## Summary

Kalpana's routing is **flexible and dual-mode**:

1. **Always works** with port-based routing (localhost:40001)
2. **Optionally** enables beautiful domains with Traefik (api.example.com)
3. **Seamlessly** combines both modes for different use cases

Choose port-based for simplicity, or enable Traefik for production-grade domain routing with automatic SSL! 🚀
