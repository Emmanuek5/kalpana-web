# Bucket Public Access URLs

## Overview
Buckets support public access to files when `publicAccess` is enabled. Files are accessible directly through the MinIO container's port or via custom domains with Traefik routing.

## How It Works

### 1. Direct Port Access
Each bucket runs in its own MinIO container with a dedicated port. When `publicAccess` is enabled, files are accessible directly via:

```
http://localhost:{port}/{bucket-name}/{file-key}
```

**Example:**
- Bucket name: `my-images`
- Bucket port: `9100`
- File key: `photos/vacation.jpg`
- Direct URL: `http://localhost:9100/my-images/photos/vacation.jpg`

### 2. Domain-Based Access (via Traefik)
If a custom domain is linked to the bucket, Traefik automatically routes requests with HTTPS:

```
https://{subdomain}.{domain}/{bucket-name}/{file-key}
```

**Example:**
- Bucket name: `my-images`
- Subdomain: `storage-my-images`
- Domain: `example.com`
- Domain URL: `https://storage-my-images.example.com/my-images/photos/vacation.jpg`

### 3. Access Control
- Files are accessible when:
  - The bucket has `publicAccess: true`
  - The bucket status is `RUNNING`
  - The file exists in the bucket
- No authentication required for public buckets
- MinIO handles all S3 API requests directly

## Architecture

### Direct Port Access
```
Client → http://localhost:9100/bucket-name/file.jpg → MinIO Container
```

### Domain Access (Traefik)
```
Client → https://subdomain.domain.com/bucket-name/file.jpg 
       → Traefik (SSL termination + routing)
       → MinIO Container (port 9000 internal)
```

## Database Schema

### Bucket Model
```prisma
model Bucket {
  // ... other fields
  publicAccess    Boolean        @default(false)  // Enable public access
  subdomain       String?                         // Subdomain for Traefik routing
  domainId        String?        @db.ObjectId     // Linked custom domain
  port            Int                             // Direct access port
  // ... other fields
}
```

## Usage

### Creating a Bucket with Public Access
```typescript
const bucket = await bucketManager.createBucket({
  name: "my-public-bucket",
  publicAccess: true,
  userId: "...",
  // Optional: Link to custom domain
  domainId: "domain-id",
  subdomain: "storage-bucket",
});

// Access via port: http://localhost:{bucket.port}/my-public-bucket/
// Access via domain: https://storage-bucket.example.com/my-public-bucket/
```

### Enabling Public Access on Existing Bucket
```typescript
await bucketManager.updatePublicAccess(bucketId, true);
```

### Linking a Domain to a Bucket
```typescript
await bucketManager.linkBucketDomain(
  bucketId,
  domainId,
  "storage-bucket" // optional custom subdomain
);
// Traefik labels are automatically applied to the container
```

### Getting Public URL for a File
```typescript
const publicFileUrl = await bucketManager.getPublicFileUrl(
  bucketId,
  "path/to/file.jpg"
);
// Returns: http://localhost:9100/bucket-name/path/to/file.jpg
// Or: https://subdomain.domain.com/bucket-name/path/to/file.jpg (if domain linked)
```

## UI Features

### Bucket Detail Page
When a bucket has public access enabled:
1. **Direct Port URL** is displayed showing `http://localhost:{port}/{bucket-name}/`
2. **Domain URL** is displayed if a custom domain is linked
3. Copy buttons for easy URL copying
4. Helper text shows example file access patterns

### Security Considerations
- Files are only accessible when bucket is RUNNING
- Public access can be toggled on/off at any time
- Direct port access is local-only (not exposed to internet)
- Domain access uses HTTPS with automatic SSL via Traefik/Let's Encrypt
- MinIO's built-in access controls apply

## Traefik Configuration

### Automatic Label Generation
When a domain is linked to a bucket, Traefik labels are automatically generated:

```yaml
traefik.enable: "true"
traefik.http.routers.bucket-{id}.rule: "Host(`subdomain.domain.com`)"
traefik.http.routers.bucket-{id}.entrypoints: "web,websecure"
traefik.http.routers.bucket-{id}.tls: "true"
traefik.http.routers.bucket-{id}.tls.certresolver: "letsencrypt"
traefik.http.services.bucket-{id}.loadbalancer.server.port: "9000"
```

### Network Configuration
- Buckets are connected to the `traefik-proxy` network when a domain is linked
- MinIO's internal port 9000 is used for Traefik routing
- External port mapping remains for direct access

## Environment Variables

```env
# Traefik configuration (optional)
TRAEFIK_NETWORK=traefik-proxy
TRAEFIK_EMAIL=admin@example.com

# Docker configuration
DOCKER_HOST=unix:///var/run/docker.sock
```
