# 🌐 How Traefik Domain Routing Works (Database-Driven)

## Key Concept

**Traefik routing is 100% DATABASE-DRIVEN**, not environment-driven!

The `TRAEFIK_BASE_URL` environment variable is **only** used for:

- ✅ Initial Traefik setup (email for Let's Encrypt)
- ✅ Default domain for local testing
- ✅ Checking if Traefik mode should be enabled

**Actual routing** happens via **Docker labels** generated from **database domains**.

---

## 🎯 How It Actually Works

### Step 1: User Adds Domain to Database

```typescript
// User adds domain via UI or API
const domain = await prisma.domain.create({
  data: {
    domain: "example.com",
    verified: true,
    userId: user.id,
  },
});

// Domain is now in DATABASE ✅
```

### Step 2: User Creates Deployment with That Domain

```typescript
// User creates deployment and selects domain from dropdown
const deployment = await prisma.deployment.create({
  data: {
    name: "My API",
    subdomain: "api",
    domainId: domain.id, // ⬅️ Links to DATABASE domain
    port: 3000,
  },
});
```

### Step 3: System Generates Traefik Labels

```typescript
// lib/docker/deployment-manager.ts
const domain = await prisma.domain.findUnique({
  where: { id: deployment.domainId },
});

// Generate labels using DOMAIN FROM DATABASE
const labels = traefikManager.generateLabels(
  deployment.id,
  "api", // subdomain
  3000, // port
  domain.domain // ⬅️ "example.com" from DATABASE!
);

// Labels generated:
// {
//   "traefik.enable": "true",
//   "traefik.http.routers.deployment-xxx.rule": "Host(`api.example.com`)",
//   "traefik.http.services.deployment-xxx.loadbalancer.server.port": "3000"
// }
```

### Step 4: Container Created with Labels

```typescript
const container = await docker.createContainer({
  Image: imageName,
  Labels: labels, // ⬅️ Traefik reads these!
  NetworkMode: "traefik-proxy",
});
```

### Step 5: Traefik Reads Labels Dynamically

```
┌────────────────────────────────────────┐
│  Traefik Container                     │
│                                        │
│  1. Watches Docker socket              │
│  2. Sees new container with labels     │
│  3. Reads: Host(`api.example.com`)    │
│  4. Creates route automatically        │
│                                        │
└────────────────────────────────────────┘
```

---

## 🔄 Multi-Domain Support

Because routing is database-driven, users can have **multiple custom domains**:

```typescript
// User 1 adds their domains
await prisma.domain.createMany({
  data: [
    { domain: "user1-site.com", verified: true, userId: user1.id },
    { domain: "user1-blog.com", verified: true, userId: user1.id },
  ],
});

// User 2 adds their domains
await prisma.domain.createMany({
  data: [{ domain: "user2-app.com", verified: true, userId: user2.id }],
});

// Each deployment uses its own domain from database:
// Deployment 1: api.user1-site.com
// Deployment 2: blog.user1-blog.com
// Deployment 3: app.user2-app.com

// ALL routed by the SAME Traefik instance!
```

---

## 📊 Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│  DATABASE (Source of Truth)                          │
│                                                       │
│  domains:                                             │
│  - id: 1, domain: "example.com"                      │
│  - id: 2, domain: "mysite.com"                       │
│                                                       │
│  deployments:                                         │
│  - id: 1, subdomain: "api", domainId: 1              │
│  - id: 2, subdomain: "app", domainId: 2              │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                │ 1. Read domain from DB
                ▼
┌──────────────────────────────────────────────────────┐
│  Deployment Manager                                   │
│                                                       │
│  domain = await prisma.domain.findUnique(...)        │
│  labels = generateLabels("api", 3000, domain.domain) │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                │ 2. Create container with labels
                ▼
┌──────────────────────────────────────────────────────┐
│  Docker Container                                     │
│                                                       │
│  Labels:                                              │
│  - traefik.enable=true                               │
│  - rule=Host(`api.example.com`)  ⬅️ From DATABASE!  │
│  - port=3000                                         │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                │ 3. Traefik reads labels
                ▼
┌──────────────────────────────────────────────────────┐
│  Traefik (Reverse Proxy)                             │
│                                                       │
│  Dynamically creates routes:                         │
│  - api.example.com → container-1                    │
│  - app.mysite.com  → container-2                    │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🎓 Why This Approach is Better

### ❌ Old Approach (Env-Based)

```bash
# .env
TRAEFIK_BASE_URL=example.com

# Problem: All deployments MUST use example.com
# - User can't use custom domains
# - Not multi-tenant friendly
# - Requires env change for each domain
```

### ✅ New Approach (Database-Based)

```typescript
// Each user adds their own domains
// Each deployment chooses from user's domains
// Traefik automatically routes ALL domains
// No env changes needed!
```

---

## 🔧 What TRAEFIK_BASE_URL Actually Does

```typescript
// lib/docker/traefik-manager.ts
constructor(config: TraefikConfig = {}) {
  this.config = {
    baseUrl: config.baseUrl || process.env.TRAEFIK_BASE_URL,  // ⬅️ ONLY for initial setup
    email: config.email || process.env.TRAEFIK_EMAIL,
    network: config.network || "traefik-proxy",
  };
}

// Used for:
async ensureTraefik(): Promise<void> {
  // 1. Check if Traefik should be started
  // 2. Set email for Let's Encrypt (if baseUrl exists)
  // 3. That's it!
}

// NOT used for routing! ⬅️ IMPORTANT
```

---

## 🚀 Example: Complete Flow

### 1. User Adds Domain (UI)

```typescript
// POST /api/domains
{
  "domain": "mysite.com"
}

// Stored in database:
domains: {
  id: "xyz",
  domain: "mysite.com",
  verified: true,
  userId: "user123"
}
```

### 2. User Creates Deployment (UI)

```typescript
// POST /api/deployments
{
  "name": "My App",
  "subdomain": "api",
  "domainId": "xyz",  // ⬅️ References database domain
  "port": 3000
}
```

### 3. System Creates Container

```typescript
// Backend code
const deployment = await prisma.deployment.create({ ... });

// Get domain from DATABASE
const domain = await prisma.domain.findUnique({
  where: { id: deployment.domainId },
});

// Generate labels with DATABASE domain
const labels = {
  "traefik.enable": "true",
  "traefik.http.routers.deployment-xyz.rule": `Host(\`api.${domain.domain}\`)`,
  // ⬆️ domain.domain = "mysite.com" from DATABASE!
};

// Create container
await docker.createContainer({
  Labels: labels,
  NetworkMode: "traefik-proxy",
});
```

### 4. Traefik Routes Automatically

```
User visits: https://api.mysite.com
             ↓
Traefik reads Host header: "api.mysite.com"
             ↓
Traefik checks container labels
             ↓
Finds: rule=Host(`api.mysite.com`)
             ↓
Routes to that container ✅
```

---

## 🌟 Benefits

1. **Multi-Tenant Ready**

   - Each user can add unlimited domains
   - No conflicts between users

2. **Zero Downtime**

   - Add/remove domains without restarting Traefik
   - Traefik watches labels in real-time

3. **Flexible**

   - Support subdomains: `api.example.com`
   - Support custom domains: `www.mysite.com`
   - Support wildcards: `*.example.com`

4. **No Environment Changes**

   - Add 100 domains → Zero env changes
   - All managed in database

5. **Automatic SSL**
   - Let's Encrypt handles all domains
   - Certificates auto-renewed

---

## 📝 Summary

```
┌─────────────────────────────────────────────────┐
│  TRAEFIK_BASE_URL (Environment Variable)        │
│  ❌ NOT used for routing                        │
│  ✅ Only for initial Traefik setup              │
│  ✅ Optional (can be empty)                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Database Domains (prisma.domain)                │
│  ✅ Source of truth for routing                 │
│  ✅ Each deployment links to a domain           │
│  ✅ Traefik reads from container labels         │
│  ✅ Fully dynamic, no restarts needed           │
└─────────────────────────────────────────────────┘
```

**Key Takeaway:** Traefik routing is **database-driven** via Docker labels. The environment variable is only a fallback for initial setup!

---

## 🔗 Related Files

- `lib/docker/traefik-manager.ts` - Label generation (uses DB domains)
- `lib/docker/deployment-manager.ts` - Reads domains from DB
- `prisma/schema.prisma` - Domain and Deployment models
- `app/api/domains/route.ts` - Domain management API
