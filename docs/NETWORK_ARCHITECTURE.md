# Network Architecture

## Overview
Kalpana uses a dual-network approach to support both direct port access and domain-based routing through Traefik.

## Network Strategy

### Primary Network: Bridge (Default)
All containers are created on Docker's default **bridge** network with port bindings. This ensures:
- ✅ Direct port access always works (`localhost:port`)
- ✅ Internal application communication
- ✅ Development and debugging access
- ✅ Backward compatibility

### Secondary Network: traefik-proxy (Optional)
When domain routing is configured (base domain or custom domain), containers are **additionally connected** to the `traefik-proxy` network. This enables:
- ✅ Domain-based routing via Traefik
- ✅ HTTPS with automatic SSL
- ✅ Subdomain routing
- ✅ Path-based routing (for edge functions)

## Why Dual Networks?

### Problem with Single Network Approach
If we use **only** `traefik-proxy` network:
- ❌ Port bindings don't work (Docker limitation)
- ❌ `localhost:port` access fails
- ❌ Internal API calls fail
- ❌ Development workflow breaks

If we use **only** `bridge` network:
- ❌ Traefik can't route to containers
- ❌ Domain-based access doesn't work
- ❌ No HTTPS support

### Solution: Both Networks
Containers are on **both** networks simultaneously:
1. **Bridge** (primary) - for port bindings
2. **traefik-proxy** (secondary) - for domain routing

## Implementation

### Bucket Containers (MinIO)
```typescript
// 1. Create on bridge network with port bindings
const container = await docker.createContainer({
  HostConfig: {
    NetworkMode: "bridge",
    PortBindings: {
      "9000/tcp": [{ HostPort: apiPort }],
      "9001/tcp": [{ HostPort: consolePort }],
    },
  },
});

// 2. Connect to Traefik network if domain is configured
if (domain || baseDomain) {
  await traefikManager.connectToNetwork(container.id);
}
```

**Result:**
- Direct access: `http://localhost:9100`
- Domain access: `https://bucket-id.kalpana.dev`

### Deployment Containers
```typescript
// 1. Create on bridge network
const container = await docker.createContainer({
  HostConfig: {
    NetworkMode: "bridge",
    PortBindings: exposedPort ? {
      [`${port}/tcp`]: [{ HostPort: exposedPort }],
    } : undefined,
  },
});

// 2. Connect to Traefik if domain configured
if (domain || baseDomain) {
  await traefikManager.connectToNetwork(container.id);
}
```

**Result:**
- Direct access: `http://localhost:3000` (if port allocated)
- Domain access: `https://deployment-id.kalpana.dev`

### Edge Runtime Container
```typescript
// 1. Create on bridge network with port binding
const container = await docker.createContainer({
  HostConfig: {
    NetworkMode: "bridge",
    PortBindings: {
      "3003/tcp": [{ HostPort: "3003" }],
    },
  },
});

// 2. Connect to Traefik if base domain configured
if (baseDomain) {
  await traefikManager.connectToNetwork(container.id);
}
```

**Result:**
- Direct access: `http://localhost:3003` (internal API)
- Domain access: `https://function-id.kalpana.dev` (per-function routing)

## Network Flow Diagrams

### Without Domain Configuration
```
Client
  ↓
localhost:port
  ↓
Container (bridge network)
  ↓
Application
```

### With Domain Configuration
```
Client (Domain Request)
  ↓
https://id.kalpana.dev
  ↓
Traefik (ports 80/443)
  ↓
traefik-proxy network
  ↓
Container (on both networks)
  ↓
Application

Client (Direct Access)
  ↓
http://localhost:port
  ↓
bridge network
  ↓
Container (on both networks)
  ↓
Application
```

## Docker Network Commands

### View Container Networks
```bash
# Inspect container networks
docker inspect <container-id> | grep -A 10 Networks

# Expected output shows both networks:
# - bridge (with port bindings)
# - traefik-proxy (for domain routing)
```

### Verify Traefik Connection
```bash
# List containers on traefik-proxy network
docker network inspect traefik-proxy

# Should show:
# - kalpana-traefik
# - kalpana-bucket-* (if domain configured)
# - deployment-* (if domain configured)
# - kalpana-edge-runtime (if base domain set)
```

### Troubleshooting Network Issues

#### Port Access Not Working
```bash
# Check if container is on bridge network
docker inspect <container-id> | grep -A 5 '"bridge"'

# Check port bindings
docker port <container-id>
```

#### Domain Access Not Working
```bash
# Check if container is on traefik-proxy network
docker network inspect traefik-proxy | grep <container-name>

# Check Traefik labels
docker inspect <container-id> | grep -A 20 Labels
```

## Benefits of This Approach

### 1. **Flexibility**
- Works with or without domain configuration
- Seamless migration between modes
- No breaking changes

### 2. **Reliability**
- Port access always available for debugging
- Domain access optional enhancement
- Fallback to ports if Traefik fails

### 3. **Development Experience**
- Local development uses ports
- Production uses domains
- Same container works in both modes

### 4. **Zero Downtime**
- Containers don't need recreation
- Networks can be added/removed dynamically
- No service interruption

## Configuration Summary

| Resource Type | Primary Network | Secondary Network | Port Bindings | Domain Routing |
|--------------|----------------|-------------------|---------------|----------------|
| Buckets | bridge | traefik-proxy* | Always | Optional |
| Deployments | bridge | traefik-proxy* | Conditional** | Optional |
| Edge Runtime | bridge | traefik-proxy* | Always | Optional |

\* Only connected when domain is configured (custom or base)  
\** Port allocated only when no custom domain is configured

## Best Practices

### 1. **Always Test Port Access First**
Before configuring domains, ensure port access works:
```bash
curl http://localhost:9100/bucket-name/
```

### 2. **Verify Traefik Connection**
After domain configuration:
```bash
docker network inspect traefik-proxy
```

### 3. **Check Traefik Labels**
Ensure labels are correctly applied:
```bash
docker inspect <container-id> | grep traefik
```

### 4. **Monitor Both Access Methods**
Keep both access methods functional:
- Port access for internal/development use
- Domain access for production/public use

## Related Documentation
- [Base Domain Configuration](./BASE_DOMAIN_CONFIGURATION.md)
- [Bucket Public Access](./BUCKET_PUBLIC_ACCESS.md)
- [Traefik Setup](./TRAEFIK_SETUP.md)
