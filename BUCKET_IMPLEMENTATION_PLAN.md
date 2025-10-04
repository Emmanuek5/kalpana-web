# Bucket (Object Storage) Implementation Plan

## Overview

This document outlines the plan to implement S3-compatible object storage buckets in Kalpana using MinIO containers. The implementation follows the existing patterns used for databases, deployments, and edge functions.

---

## Architecture Analysis

### Existing Patterns

Based on the codebase analysis, Kalpana follows these patterns:

1. **Database Schema**: Prisma models with MongoDB
   - User ownership with optional team ownership
   - Optional workspace linking
   - Optional domain integration with Traefik routing
   - Status tracking (CREATING, RUNNING, STOPPED, ERROR)

2. **Docker Management**:
   - Manager classes in `lib/docker/` (DatabaseManager, DeploymentManager)
   - Port allocation via PortManager (40000-50000 range)
   - Docker container lifecycle management
   - Volume management for persistence
   - Traefik integration for domain routing

3. **API Routes**:
   - RESTful endpoints in `app/api/`
   - Authentication via Better Auth
   - CRUD operations + lifecycle methods (start, stop, delete)

4. **UI Components**:
   - Dashboard pages in `app/dashboard/`
   - shadcn/ui components with oil black & green theme
   - Real-time status updates

---

## Bucket Implementation Design

### 1. Database Schema

```prisma
model Bucket {
  id              String         @id @default(auto()) @map("_id") @db.ObjectId
  name            String         // Bucket name (must be DNS-compatible)
  description     String?
  
  // Ownership (can be user-owned or team-owned)
  userId          String         @db.ObjectId
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  teamId          String?        @db.ObjectId
  team            Team?          @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  // Optional workspace link (null = standalone bucket)
  workspaceId     String?        @db.ObjectId
  workspace       Workspace?     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  // MinIO container configuration
  containerId     String?        // Docker container ID
  
  // Connection details
  host            String         @default("localhost")
  port            Int            // API port (9000)
  consolePort     Int?           // Console UI port (9001)
  accessKey       String         // MinIO access key
  secretKey       String         // MinIO secret key (encrypt in production)
  
  // Domain integration (optional)
  domainId        String?        @db.ObjectId
  domain          Domain?        @relation(fields: [domainId], references: [id], onDelete: SetNull)
  subdomain       String?        // e.g., "storage-mybucket"
  
  // Docker networking
  networkName     String?        // Docker network name
  internalHost    String?        // Internal hostname for Docker network
  
  // Configuration
  region          String         @default("us-east-1") // S3 region (for compatibility)
  versioning      Boolean        @default(false)       // Enable versioning
  encryption      Boolean        @default(false)       // Enable encryption at rest
  publicAccess    Boolean        @default(false)       // Allow public read access
  
  // Storage limits
  maxSizeGB       Int?           // Maximum storage size in GB (null = unlimited)
  
  // Status
  status          BucketStatus   @default(STOPPED)
  
  // Metadata
  volumeName      String?        // Persistent volume name
  objectCount     Int            @default(0)           // Cached object count
  totalSizeBytes  BigInt         @default(0)           // Cached total size
  
  // Relations
  objects         BucketObject[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@unique([userId, name])
  @@index([userId])
  @@index([workspaceId])
  @@index([teamId])
  @@index([status])
  @@index([domainId])
}

enum BucketStatus {
  CREATING
  RUNNING
  STOPPED
  ERROR
}

model BucketObject {
  id              String         @id @default(auto()) @map("_id") @db.ObjectId
  bucketId        String         @db.ObjectId
  bucket          Bucket         @relation(fields: [bucketId], references: [id], onDelete: Cascade)
  
  // Object metadata
  key             String         // Object key/path (e.g., "folder/file.jpg")
  size            BigInt         // Size in bytes
  contentType     String?        // MIME type
  etag            String?        // ETag for versioning
  
  // Metadata
  metadata        String?        // JSON stringified custom metadata
  
  // Versioning
  versionId       String?        // Version ID if versioning enabled
  isLatest        Boolean        @default(true)
  
  // Access control
  isPublic        Boolean        @default(false)
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@unique([bucketId, key, versionId])
  @@index([bucketId])
  @@index([bucketId, key])
  @@index([createdAt])
}
```

### 2. BucketManager Class

Location: `lib/docker/bucket-manager.ts`

**Key Methods**:

```typescript
class BucketManager {
  // Lifecycle
  async createBucket(config: BucketConfig): Promise<BucketInfo>
  async startBucket(bucketId: string): Promise<void>
  async stopBucket(bucketId: string): Promise<void>
  async deleteBucket(bucketId: string, deleteVolume?: boolean): Promise<void>
  
  // Object operations
  async uploadObject(bucketId: string, key: string, file: Buffer, metadata?: ObjectMetadata): Promise<void>
  async downloadObject(bucketId: string, key: string): Promise<Buffer>
  async deleteObject(bucketId: string, key: string): Promise<void>
  async listObjects(bucketId: string, prefix?: string, maxKeys?: number): Promise<ObjectInfo[]>
  async getObjectMetadata(bucketId: string, key: string): Promise<ObjectMetadata>
  
  // Presigned URLs (for direct client uploads/downloads)
  async getPresignedUploadUrl(bucketId: string, key: string, expiresIn?: number): Promise<string>
  async getPresignedDownloadUrl(bucketId: string, key: string, expiresIn?: number): Promise<string>
  
  // Bucket management
  async getBucketInfo(bucketId: string): Promise<BucketInfo>
  async listUserBuckets(userId: string): Promise<BucketInfo[]>
  async listWorkspaceBuckets(workspaceId: string): Promise<BucketInfo[]>
  async updateBucketConfig(bucketId: string, config: Partial<BucketConfig>): Promise<void>
  
  // Domain integration
  async linkBucketDomain(bucketId: string, domainId: string, subdomain?: string): Promise<BucketInfo>
  async unlinkBucketDomain(bucketId: string): Promise<BucketInfo>
  
  // Statistics
  async getBucketStats(bucketId: string): Promise<BucketStats>
  async syncBucketMetadata(bucketId: string): Promise<void> // Sync object count and size
  
  // Internal methods
  private async createMinIOContainer(bucketId: string, config: MinIOConfig): Promise<ContainerInfo>
  private async ensureMinIOImage(): Promise<void>
  private getS3Client(bucketInfo: BucketInfo): S3Client
  private generateAccessKey(): string
  private generateSecretKey(): string
}
```

**MinIO Container Configuration**:

- Image: `minio/minio:latest`
- Ports: 9000 (API), 9001 (Console)
- Volume: Persistent storage for objects
- Environment variables: Access key, secret key, region
- Command: `server /data --console-address ":9001"`
- Labels: Kalpana metadata for tracking

### 3. API Routes

**Bucket CRUD**:
- `POST /api/buckets` - Create bucket
- `GET /api/buckets` - List user's buckets
- `GET /api/buckets/[id]` - Get bucket info
- `PATCH /api/buckets/[id]` - Update bucket config
- `DELETE /api/buckets/[id]` - Delete bucket
- `POST /api/buckets/[id]/start` - Start bucket
- `POST /api/buckets/[id]/stop` - Stop bucket

**Object Operations**:
- `POST /api/buckets/[id]/objects` - Upload object (multipart form)
- `GET /api/buckets/[id]/objects` - List objects (with prefix filtering)
- `GET /api/buckets/[id]/objects/[key]` - Download object
- `DELETE /api/buckets/[id]/objects/[key]` - Delete object
- `GET /api/buckets/[id]/objects/[key]/metadata` - Get object metadata

**Presigned URLs**:
- `POST /api/buckets/[id]/presigned-upload` - Get presigned upload URL
- `POST /api/buckets/[id]/presigned-download` - Get presigned download URL

**Domain Integration**:
- `POST /api/buckets/[id]/domain` - Link domain
- `DELETE /api/buckets/[id]/domain` - Unlink domain

**Statistics**:
- `GET /api/buckets/[id]/stats` - Get bucket statistics

### 4. UI Components

**Components** (`components/buckets/`):

1. **bucket-list.tsx**
   - Display user's buckets in a grid/list
   - Status indicators (running, stopped, error)
   - Quick actions (start, stop, delete)

2. **create-bucket-dialog.tsx**
   - Form to create new bucket
   - Name validation (DNS-compatible)
   - Optional workspace linking
   - Optional domain configuration
   - Storage limits

3. **bucket-details.tsx**
   - Bucket information panel
   - Connection details (endpoint, access key, secret key)
   - Statistics (object count, total size)
   - Configuration options

4. **bucket-file-browser.tsx**
   - File/folder tree view
   - Upload button (with drag & drop)
   - Download/delete actions
   - Breadcrumb navigation
   - Search/filter

5. **bucket-settings-dialog.tsx**
   - Update bucket configuration
   - Versioning toggle
   - Encryption toggle
   - Public access toggle
   - Storage limits

6. **bucket-domain-config.tsx**
   - Link/unlink domain
   - Subdomain configuration
   - DNS instructions

**Dashboard Page** (`app/dashboard/buckets/page.tsx`):

```tsx
export default function BucketsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Object Storage Buckets</h1>
        <CreateBucketDialog />
      </div>
      
      <BucketList />
    </div>
  );
}
```

**Bucket Detail Page** (`app/dashboard/buckets/[id]/page.tsx`):

```tsx
export default function BucketDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto p-6">
      <BucketDetails bucketId={params.id} />
      
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="files">
          <BucketFileBrowser bucketId={params.id} />
        </TabsContent>
        
        <TabsContent value="settings">
          <BucketSettingsDialog bucketId={params.id} />
        </TabsContent>
        
        <TabsContent value="stats">
          <BucketStatsPanel bucketId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Implementation Steps

### Phase 1: Database Schema (30 minutes)

1. Add `Bucket` and `BucketObject` models to `prisma/schema.prisma`
2. Add bucket relations to `User`, `Team`, `Workspace`, `Domain` models
3. Run `bunx prisma generate` and `bunx prisma db push`

### Phase 2: BucketManager Class (2-3 hours)

1. Create `lib/docker/bucket-manager.ts`
2. Implement MinIO container lifecycle methods
3. Implement S3 client integration using AWS SDK
4. Implement object operations (upload, download, delete, list)
5. Implement presigned URL generation
6. Implement domain integration with Traefik
7. Add comprehensive error handling and logging

### Phase 3: API Routes (2 hours)

1. Create bucket CRUD routes
2. Create object operation routes
3. Create presigned URL routes
4. Create domain integration routes
5. Add authentication and authorization checks
6. Add input validation with Zod

### Phase 4: UI Components (3-4 hours)

1. Create bucket list component
2. Create bucket creation dialog
3. Create bucket details panel
4. Create file browser component with upload/download
5. Create settings dialog
6. Create domain configuration component
7. Style with oil black & green theme

### Phase 5: Dashboard Pages (1 hour)

1. Create buckets list page
2. Create bucket detail page
3. Add navigation links

### Phase 6: Testing & Documentation (1-2 hours)

1. Test bucket creation and lifecycle
2. Test object upload/download
3. Test domain integration
4. Test presigned URLs
5. Write usage documentation
6. Update README

---

## Technical Considerations

### 1. MinIO vs AWS S3

**Why MinIO?**
- Self-hosted, no AWS account required
- S3-compatible API (works with AWS SDK)
- Lightweight Docker container
- Free and open source
- Perfect for development and small-scale production

**Future Enhancement**: Add option to use real AWS S3 for production

### 2. Security

- **Access Keys**: Generate secure random keys, encrypt in database
- **Secret Keys**: Never expose in API responses (show once on creation)
- **Presigned URLs**: Time-limited, secure direct access
- **Public Access**: Optional, disabled by default
- **Container Isolation**: Each bucket in separate container (optional) or shared MinIO instance

### 3. Performance

- **Caching**: Cache object metadata in database
- **Streaming**: Use streams for large file uploads/downloads
- **Pagination**: Implement pagination for object listing
- **Presigned URLs**: Offload uploads/downloads to client-side

### 4. Storage Management

- **Volumes**: Docker volumes for persistence
- **Quotas**: Optional storage limits per bucket
- **Cleanup**: Automatic cleanup on bucket deletion
- **Monitoring**: Track object count and total size

### 5. Domain Integration

- **Traefik Routing**: Route subdomain to MinIO container
- **SSL/TLS**: Automatic HTTPS via Let's Encrypt
- **CORS**: Configure CORS for browser uploads

---

## Alternative Architectures

### Option A: One MinIO Container Per Bucket (Current Plan)

**Pros**:
- Complete isolation between buckets
- Easy to manage lifecycle (start/stop individual buckets)
- Follows existing pattern (like databases)
- Resource limits per bucket

**Cons**:
- More resource usage (one container per bucket)
- More complex management

### Option B: Shared MinIO Instance

**Pros**:
- Single container for all buckets
- Lower resource usage
- Simpler management

**Cons**:
- No isolation between buckets
- Can't start/stop individual buckets
- Single point of failure

**Recommendation**: Start with **Option A** (one container per bucket) for consistency with existing patterns. Add Option B as an optimization later if needed.

---

## Integration Points

### 1. Workspace Integration

Buckets can be linked to workspaces for:
- Storing build artifacts
- Hosting static assets
- Storing logs and backups
- Sharing files between team members

### 2. Deployment Integration

Deployments can use buckets for:
- Serving static assets (CDN-like)
- Storing user uploads
- Caching build outputs

### 3. Edge Function Integration

Edge functions can access buckets for:
- Reading/writing objects
- Generating presigned URLs
- Processing uploaded files

### 4. Agent Integration

AI agents can use buckets for:
- Storing generated files
- Reading input data
- Backing up code changes

---

## Example Usage

### Creating a Bucket

```typescript
const bucket = await fetch('/api/buckets', {
  method: 'POST',
  body: JSON.stringify({
    name: 'my-app-assets',
    description: 'Static assets for my app',
    workspaceId: 'workspace-123',
    domainId: 'domain-456',
    subdomain: 'assets',
    versioning: true,
    maxSizeGB: 10,
  }),
});
```

### Uploading a File

```typescript
// Option 1: Direct upload via API
const formData = new FormData();
formData.append('file', file);
formData.append('key', 'images/logo.png');

await fetch(`/api/buckets/${bucketId}/objects`, {
  method: 'POST',
  body: formData,
});

// Option 2: Presigned URL (better for large files)
const { url } = await fetch(`/api/buckets/${bucketId}/presigned-upload`, {
  method: 'POST',
  body: JSON.stringify({ key: 'images/logo.png' }),
}).then(r => r.json());

await fetch(url, {
  method: 'PUT',
  body: file,
});
```

### Accessing Files

```typescript
// Public bucket
const imageUrl = `https://assets.example.com/images/logo.png`;

// Private bucket (presigned URL)
const { url } = await fetch(`/api/buckets/${bucketId}/presigned-download`, {
  method: 'POST',
  body: JSON.stringify({ key: 'images/logo.png', expiresIn: 3600 }),
}).then(r => r.json());

// Use URL for 1 hour
```

---

## Success Metrics

- ✅ Users can create and manage buckets
- ✅ Users can upload/download files via UI
- ✅ Buckets can be linked to custom domains
- ✅ Presigned URLs work for direct uploads/downloads
- ✅ Bucket statistics are accurate
- ✅ Integration with workspaces works
- ✅ UI follows oil black & green theme
- ✅ Documentation is complete

---

## Future Enhancements

1. **AWS S3 Support**: Option to use real AWS S3 instead of MinIO
2. **CDN Integration**: CloudFlare/Fastly integration for edge caching
3. **Image Processing**: Automatic image optimization and resizing
4. **Backup/Restore**: Automated backups to external storage
5. **Access Logs**: Track object access for analytics
6. **Lifecycle Policies**: Automatic deletion of old objects
7. **Replication**: Cross-region replication for redundancy
8. **Shared MinIO**: Option for shared MinIO instance to save resources
9. **Bucket Templates**: Pre-configured buckets for common use cases
10. **CLI Tool**: Command-line tool for bucket management

---

## Estimated Timeline

- **Phase 1**: 30 minutes
- **Phase 2**: 2-3 hours
- **Phase 3**: 2 hours
- **Phase 4**: 3-4 hours
- **Phase 5**: 1 hour
- **Phase 6**: 1-2 hours

**Total**: ~10-13 hours for complete implementation

---

## Questions to Consider

1. **Container Strategy**: One MinIO per bucket or shared instance?
   - **Recommendation**: Start with one per bucket for consistency

2. **Default Storage Limits**: Should buckets have default size limits?
   - **Recommendation**: No default limit, but allow users to set limits

3. **Public Access**: Should public buckets be allowed by default?
   - **Recommendation**: No, require explicit opt-in for security

4. **Versioning**: Should versioning be enabled by default?
   - **Recommendation**: No, opt-in feature for advanced users

5. **Pricing Model**: How to charge for storage (if applicable)?
   - **Recommendation**: Track usage, implement billing later

6. **Integration Priority**: Which integration to build first?
   - **Recommendation**: Workspace integration (most useful)

---

## Conclusion

This implementation plan provides a comprehensive approach to adding S3-compatible object storage to Kalpana. The design follows existing patterns in the codebase, ensuring consistency and maintainability. The phased approach allows for incremental development and testing.

The bucket feature will significantly enhance Kalpana's capabilities, enabling users to:
- Store and serve static assets
- Share files between team members
- Integrate with deployments and edge functions
- Build more complex applications

**Next Step**: Review this plan and proceed with implementation starting with Phase 1 (Database Schema).
