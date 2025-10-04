# Base Domain Configuration

## Overview
Kalpana now supports automatic subdomain mapping for all resources (buckets, deployments, edge functions) when a base domain is configured. Each resource gets its own subdomain based on its ID, with custom domains still available as an override.

## Configuration

### Environment Variable
```env
KALPANA_BASE_DOMAIN=kalpana.dev
```

When set, all resources are automatically mapped to:
- **Buckets**: `{bucket-id}.kalpana.dev`
- **Deployments**: `{deployment-id}.kalpana.dev`
- **Edge Functions**: `{function-id}.kalpana.dev`

## How It Works

### Priority System
For each resource type, the system follows this priority:

1. **Custom Domain** (highest priority)
   - If a custom domain is explicitly linked to the resource
   - Uses the configured subdomain + custom domain
   - Example: `storage.example.com`

2. **Base Domain** (automatic fallback)
   - If `KALPANA_BASE_DOMAIN` is set and no custom domain is linked
   - Uses resource ID as subdomain
   - Example: `abc123def456.kalpana.dev`

3. **Direct Port Access** (local only)
   - If no domains are configured
   - Uses `localhost:{port}`
   - Example: `http://localhost:9100`

## Resource Types

### Buckets (S3-Compatible Storage)

**Automatic Mapping:**
```
https://{bucket-id}.kalpana.dev/{bucket-name}/{file-key}
```

**Example:**
- Bucket ID: `65f1a2b3c4d5e6f7g8h9i0j1`
- Bucket Name: `my-images`
- File: `photos/vacation.jpg`
- URL: `https://65f1a2b3c4d5e6f7g8h9i0j1.kalpana.dev/my-images/photos/vacation.jpg`

**Custom Domain Override:**
```typescript
await bucketManager.linkBucketDomain(
  bucketId,
  domainId,
  "storage" // custom subdomain
);
// Result: https://storage.example.com/my-images/photos/vacation.jpg
```

### Deployments (Web Applications)

**Automatic Mapping:**
```
https://{deployment-id}.kalpana.dev
```

**Example:**
- Deployment ID: `dep_abc123xyz789`
- URL: `https://dep_abc123xyz789.kalpana.dev`

**Custom Domain Override:**
```typescript
await deploymentManager.createDeployment(workspaceId, {
  name: "my-app",
  domainId: "domain-id",
  subdomain: "app", // custom subdomain
  // ... other config
});
// Result: https://app.example.com
```

### Edge Functions (Serverless Functions)

**Automatic Mapping:**
```
https://{function-id}.kalpana.dev[/path]
```

**Example:**
- Function ID: `func_xyz789abc123`
- URL: `https://func_xyz789abc123.kalpana.dev`
- With path: `https://func_xyz789abc123.kalpana.dev/webhook`

**Custom Domain Override:**
```typescript
// When creating or updating edge function
await prisma.edgeFunction.update({
  where: { id: functionId },
  data: {
    domainId: "domain-id",
    subdomain: "api",
    path: "/webhook"
  }
});
// Result: https://api.example.com/webhook
```

**Note:** Edge functions share a single runtime container but get individual Traefik routing rules based on their subdomain and path configuration.

## Traefik Configuration

### Automatic Setup
When `KALPANA_BASE_DOMAIN` is set:
1. Traefik is automatically started if not running
2. All resource containers are connected to `traefik-proxy` network
3. Traefik labels are automatically generated and applied
4. SSL certificates are automatically provisioned via Let's Encrypt

### Generated Labels Example
```yaml
traefik.enable: "true"
traefik.http.routers.{resource-id}.rule: "Host(`{id}.kalpana.dev`)"
traefik.http.routers.{resource-id}.entrypoints: "web,websecure"
traefik.http.routers.{resource-id}.tls: "true"
traefik.http.routers.{resource-id}.tls.certresolver: "letsencrypt"
traefik.http.services.{resource-id}.loadbalancer.server.port: "{port}"
```

### Network Architecture
```
Internet → Traefik (ports 80/443)
          ↓
    traefik-proxy network
          ↓
    Resource Containers
    - Buckets (MinIO on port 9000)
    - Deployments (app port)
    - Edge Functions (runtime port)
```

## DNS Configuration

### Wildcard DNS Record
To use base domain mapping, configure a wildcard DNS record:

```
Type: A
Name: *.kalpana.dev
Value: <your-server-ip>
TTL: 3600
```

Or for CNAME:
```
Type: CNAME
Name: *.kalpana.dev
Value: your-server.com
TTL: 3600
```

### Verification
Test DNS propagation:
```bash
dig abc123.kalpana.dev
nslookup xyz789.kalpana.dev
```

## Benefits

### 1. **Automatic HTTPS**
- All resources get SSL certificates automatically
- No manual certificate management
- Automatic renewal via Let's Encrypt

### 2. **Consistent URLs**
- Predictable URL structure
- Easy to share and reference
- No port numbers in URLs

### 3. **Custom Domain Support**
- Base domain provides instant access
- Custom domains can be added later
- Seamless migration between domains

### 4. **Development to Production**
- Same URL structure in all environments
- Easy to test with base domain
- Add custom domains for production

## Migration Guide

### Existing Resources
Resources created before base domain configuration:
1. Continue to work with port-based access
2. Automatically get base domain URL on next restart
3. Custom domains remain unchanged

### Enabling Base Domain
1. Set `KALPANA_BASE_DOMAIN` environment variable
2. Configure wildcard DNS record
3. Restart Kalpana application
4. Existing resources: restart to apply new configuration

```bash
# Set environment variable
export KALPANA_BASE_DOMAIN=kalpana.dev

# Restart application
npm run dev  # or your start command
```

## Troubleshooting

### Resource Not Accessible via Domain
1. Check DNS configuration: `dig {id}.kalpana.dev`
2. Verify Traefik is running: `docker ps | grep traefik`
3. Check container is on traefik-proxy network: `docker inspect {container-id}`
4. Review Traefik logs: `docker logs kalpana-traefik`

### SSL Certificate Issues
1. Ensure ports 80 and 443 are accessible
2. Check Let's Encrypt rate limits
3. Verify email is configured: `TRAEFIK_EMAIL`
4. Review certificate resolver logs in Traefik

### Port Access Still Works
- Port-based access remains available for local development
- Domain access is additive, not replacement
- Both methods work simultaneously

## Security Considerations

### Public Buckets
- Base domain URLs are publicly accessible when `publicAccess: true`
- Resource IDs are UUIDs (not easily guessable)
- MinIO access controls still apply

### Deployments
- Deployments are publicly accessible via domain
- Implement authentication in your application
- Use environment variables for secrets

### Network Isolation
- Resources remain isolated in Docker networks
- Traefik provides reverse proxy layer
- Internal communication uses Docker networking

## Example: Complete Setup

```bash
# 1. Configure environment
export KALPANA_BASE_DOMAIN=kalpana.dev
export TRAEFIK_EMAIL=admin@kalpana.dev

# 2. Configure DNS (at your DNS provider)
# Add wildcard A record: *.kalpana.dev → your-server-ip

# 3. Start Kalpana
npm run dev

# 4. Create a bucket
# Automatically accessible at: https://{bucket-id}.kalpana.dev

# 5. Deploy an application
# Automatically accessible at: https://{deployment-id}.kalpana.dev

# 6. (Optional) Add custom domain
# Link custom domain via API or UI
# Result: https://custom.example.com
```

## API Changes

### Bucket Info Response
```json
{
  "id": "bucket-id",
  "name": "my-bucket",
  "port": 9100,
  "endpoint": "http://localhost:9100",
  "domainEndpoint": "https://bucket-id.kalpana.dev",
  "publicAccess": true
}
```

### Deployment Info Response
```json
{
  "id": "deployment-id",
  "name": "my-app",
  "port": 3000,
  "exposedPort": null,
  "url": "https://deployment-id.kalpana.dev",
  "customDomain": null
}
```

## Related Documentation
- [Bucket Public Access](./BUCKET_PUBLIC_ACCESS.md)
- [Traefik Configuration](./TRAEFIK_SETUP.md)
- [Custom Domains](./CUSTOM_DOMAINS.md)
