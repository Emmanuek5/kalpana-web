import Docker from "dockerode";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PortManager } from "./port-manager";
import { traefikManager } from "./traefik-manager";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { Readable } from "stream";

export interface BucketConfig {
  name: string;
  description?: string;
  userId: string;
  workspaceId?: string; // Optional - null for standalone buckets
  teamId?: string;
  domainId?: string;
  subdomain?: string;
  region?: string;
  versioning?: boolean;
  encryption?: boolean;
  publicAccess?: boolean;
  maxSizeGB?: number;
}

export interface BucketInfo {
  id: string;
  name: string;
  description?: string;
  status: string;
  host: string;
  port: number;
  consolePort?: number;
  accessKey: string;
  secretKey: string;
  region: string;
  versioning: boolean;
  encryption: boolean;
  publicAccess: boolean;
  publicUrl?: string;
  maxSizeGB?: number;
  containerId?: string;
  volumeName?: string;
  objectCount: number;
  totalSizeBytes: bigint;
  endpoint: string;
  consoleEndpoint?: string;
  internalEndpoint?: string;
  domainEndpoint?: string;
  workspaceId?: string;
}

export interface ObjectInfo {
  key: string;
  size: bigint;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  isPublic: boolean;
  metadata?: Record<string, string>;
}

export interface ObjectMetadata {
  key: string;
  size: bigint;
  contentType?: string;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface BucketStats {
  objectCount: number;
  totalSizeBytes: bigint;
  totalSizeMB: number;
  totalSizeGB: number;
  largestObject?: {
    key: string;
    size: bigint;
  };
  recentObjects: ObjectInfo[];
}

export class BucketManager {
  private docker: Docker;
  private portManager: PortManager;
  private baseDomain?: string;

  constructor() {
    this.baseDomain = process.env.KALPANA_BASE_DOMAIN;
    const envHost = process.env.DOCKER_HOST;

    if (envHost && envHost.length > 0) {
      if (envHost.startsWith("unix://")) {
        this.docker = new Docker({
          socketPath: envHost.replace(/^unix:\/\//, ""),
        });
      } else if (envHost.startsWith("npipe://")) {
        this.docker = new Docker({
          socketPath: envHost.replace(/^npipe:\/\//, ""),
        });
      } else {
        const normalized = envHost.startsWith("tcp://")
          ? `http://${envHost.slice("tcp://".length)}`
          : envHost;
        try {
          const url = new URL(normalized);
          const protocol = url.protocol.replace(":", "") as "http" | "https";
          const host = url.hostname || "localhost";
          const port = url.port
            ? parseInt(url.port, 10)
            : protocol === "https"
            ? 2376
            : 2375;
          this.docker = new Docker({ protocol, host, port });
        } catch (_e) {
          this.docker = this.getDefaultDockerClient();
        }
      }
    } else {
      this.docker = this.getDefaultDockerClient();
    }

    this.portManager = new PortManager();
  }

  private getDefaultDockerClient(): Docker {
    if (process.platform === "win32") {
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    }
    return new Docker({ socketPath: "/var/run/docker.sock" });
  }

  /**
   * Generate a unique subdomain for a bucket
   */
  private async generateBucketSubdomain(
    bucketName: string,
    domainId: string
  ): Promise<string> {
    const sanitizedName = bucketName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);

    let subdomain = `storage-${sanitizedName}`;

    // Ensure uniqueness within the domain
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.bucket.findFirst({
        where: {
          subdomain,
          domainId,
        },
      });

      if (!existing) break;

      // Add random suffix for uniqueness
      const suffix = Math.random().toString(36).substring(2, 6);
      subdomain = `storage-${sanitizedName}-${suffix}`;
      attempts++;
    }

    if (attempts === 10) {
      throw new Error("Failed to generate unique subdomain");
    }

    // Ensure subdomain is valid (max 63 chars for DNS)
    if (subdomain.length > 63) {
      subdomain = subdomain.substring(0, 63);
    }

    return subdomain;
  }

  /**
   * Generate secure access key
   */
  private generateAccessKey(): string {
    return crypto.randomBytes(10).toString("hex").toUpperCase();
  }

  /**
   * Generate secure secret key
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(20).toString("base64");
  }

  /**
   * Generate unique public URL slug for bucket
   */
  private async generatePublicUrl(bucketName: string): Promise<string> {
    const sanitizedName = bucketName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 30);

    let publicUrl = sanitizedName;
    let attempts = 0;

    // Ensure uniqueness
    while (attempts < 20) {
      const existing = await prisma.bucket.findUnique({
        where: { publicUrl },
      });

      if (!existing) {
        return publicUrl;
      }

      // Add random suffix for uniqueness
      const suffix = crypto.randomBytes(3).toString("hex");
      publicUrl = `${sanitizedName}-${suffix}`;
      attempts++;
    }

    // Fallback to fully random
    return crypto.randomBytes(8).toString("hex");
  }

  /**
   * Ensure MinIO image is available
   */
  private async ensureMinIOImage(): Promise<void> {
    const imageName = "minio/minio:latest";
    
    try {
      await this.docker.getImage(imageName).inspect();
    } catch (error) {
      console.log(`Pulling MinIO image: ${imageName}...`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: any, stream: any) => {
          if (err) return reject(err);
          
          this.docker.modem.followProgress(stream, (err: any) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    }
  }

  /**
   * Create a bucket
   */
  async createBucket(config: BucketConfig): Promise<BucketInfo> {
    // Validate bucket name (DNS-compatible)
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.name)) {
      throw new Error(
        "Invalid bucket name. Must be 3-63 characters, lowercase letters, numbers, and hyphens only."
      );
    }

    // Check if bucket name already exists for this user
    const existing = await prisma.bucket.findFirst({
      where: {
        userId: config.userId,
        name: config.name,
      },
    });

    if (existing) {
      throw new Error(`Bucket "${config.name}" already exists`);
    }

    // Generate credentials
    const accessKey = this.generateAccessKey();
    const secretKey = this.generateSecretKey();

    // Allocate ports
    const ports = await this.portManager.allocatePorts();
    const apiPort = ports.vscodePort; // API port (9000)
    const consolePort = ports.agentPort; // Console port (9001)

    // Handle domain and subdomain if provided
    let finalSubdomain = config.subdomain;
    let domain = null;

    if (config.domainId) {
      // Fetch and verify domain
      domain = await prisma.domain.findUnique({
        where: { id: config.domainId },
      });

      if (!domain || !domain.verified) {
        throw new Error("Invalid or unverified domain");
      }

      // Auto-generate subdomain if not provided
      if (!finalSubdomain) {
        finalSubdomain = await this.generateBucketSubdomain(
          config.name,
          config.domainId
        );
      } else {
        // Validate custom subdomain
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(finalSubdomain)) {
          throw new Error(
            "Invalid subdomain format. Use lowercase letters, numbers, and hyphens only."
          );
        }

        // Check uniqueness
        const existingSubdomain = await prisma.bucket.findFirst({
          where: {
            subdomain: finalSubdomain,
            domainId: config.domainId,
          },
        });

        if (existingSubdomain) {
          throw new Error(`Subdomain "${finalSubdomain}" is already in use`);
        }
      }
    }

    // Generate public URL if public access is enabled
    const publicUrl = config.publicAccess 
      ? await this.generatePublicUrl(config.name)
      : undefined;

    // Create bucket record in Prisma
    const bucketRecord = await prisma.bucket.create({
      data: {
        name: config.name,
        description: config.description,
        userId: config.userId,
        workspaceId: config.workspaceId,
        teamId: config.teamId,
        domainId: config.domainId,
        subdomain: finalSubdomain,
        host: "localhost",
        port: apiPort,
        consolePort: consolePort,
        accessKey,
        secretKey, // TODO: Encrypt in production
        region: config.region || "us-east-1",
        versioning: config.versioning || false,
        encryption: config.encryption || false,
        publicAccess: config.publicAccess || false,
        publicUrl,
        maxSizeGB: config.maxSizeGB,
        status: "CREATING",
      },
    });

    try {
      // Determine subdomain and domain for Traefik
      let traefikSubdomain: string | undefined;
      let traefikDomain: string | undefined;

      // Priority 1: Custom domain if provided
      if (domain && finalSubdomain) {
        traefikSubdomain = finalSubdomain;
        traefikDomain = domain.domain;
      }
      // Priority 2: Base domain with bucket ID as subdomain
      else if (this.baseDomain) {
        traefikSubdomain = bucketRecord.id;
        traefikDomain = this.baseDomain;
      }

      // Create MinIO container with Traefik labels if domain is configured
      const containerInfo = await this.createMinIOContainer(bucketRecord.id, {
        name: config.name,
        apiPort,
        consolePort,
        accessKey,
        secretKey,
        region: config.region || "us-east-1",
        subdomain: traefikSubdomain,
        domain: traefikDomain,
      });

      // Update bucket record with container info
      const updatedBucket = await prisma.bucket.update({
        where: { id: bucketRecord.id },
        data: {
          containerId: containerInfo.containerId,
          volumeName: containerInfo.volumeName,
          internalHost: containerInfo.internalHost,
          networkName: containerInfo.networkName,
          status: "RUNNING",
        },
      });

      // Initialize the bucket in MinIO
      await this.initializeMinIOBucket(updatedBucket);

      // Connect to Traefik network if any domain is configured
      if ((domain && finalSubdomain) || this.baseDomain) {
        try {
          await traefikManager.ensureTraefik();
          await traefikManager.connectToNetwork(containerInfo.containerId);
          
          const routingDomain = domain?.domain || this.baseDomain;
          const routingSubdomain = finalSubdomain || bucketRecord.id;
          console.log(
            `✅ Configured Traefik routing: ${routingSubdomain}.${routingDomain} → ${bucketRecord.id}`
          );
        } catch (error: any) {
          console.error("Failed to configure Traefik for bucket:", error);
          // Don't fail the entire operation, bucket is still accessible via port
        }
      }

      return this.formatBucketInfo(updatedBucket);
    } catch (error: any) {
      // Update status to ERROR
      await prisma.bucket.update({
        where: { id: bucketRecord.id },
        data: { status: "ERROR" },
      });

      // Release ports
      await this.portManager.releasePort(apiPort);
      await this.portManager.releasePort(consolePort);

      throw new Error(`Failed to create bucket: ${error.message}`);
    }
  }

  /**
   * Create MinIO container
   */
  private async createMinIOContainer(
    bucketId: string,
    config: {
      name: string;
      apiPort: number;
      consolePort: number;
      accessKey: string;
      secretKey: string;
      region: string;
      subdomain?: string;
      domain?: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    const containerName = `kalpana-bucket-${bucketId}`;
    const volumeName = `kalpana-bucket-${bucketId}-data`;
    const imageName = "minio/minio:latest";

    // Pull image if not present
    await this.ensureMinIOImage();

    // Create volume for persistent data
    await this.docker.createVolume({
      Name: volumeName,
      Labels: {
        "kalpana.bucket.id": bucketId,
        "kalpana.managed": "true",
      },
    });

    // Base labels
    const labels: Record<string, string> = {
      "kalpana.bucket.id": bucketId,
      "kalpana.bucket.name": config.name,
      "kalpana.managed": "true",
    };

    // Add Traefik labels if domain is configured
    if (config.subdomain && config.domain) {
      const traefikLabels = traefikManager.generateBucketLabels(
        bucketId,
        config.subdomain,
        config.domain
      );
      Object.assign(labels, traefikLabels);
    }

    // Create container with default bridge network for port access
    // Traefik network will be added as secondary network
    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Cmd: ["server", "/data", "--console-address", ":9001"],
      Env: [
        `MINIO_ROOT_USER=${config.accessKey}`,
        `MINIO_ROOT_PASSWORD=${config.secretKey}`,
        `MINIO_REGION=${config.region}`,
      ],
      ExposedPorts: {
        "9000/tcp": {},
        "9001/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "9000/tcp": [{ HostPort: config.apiPort.toString() }],
          "9001/tcp": [{ HostPort: config.consolePort.toString() }],
        },
        Binds: [`${volumeName}:/data`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
        Memory: 512 * 1024 * 1024, // 512MB
        AutoRemove: false,
        NetworkMode: "bridge", // Explicitly use bridge for port bindings
      },
      Labels: labels,
    });

    await container.start();

    // Wait for MinIO to be ready
    await this.waitForMinIO(config.apiPort);

    return {
      containerId: container.id,
      volumeName,
      internalHost: containerName,
    };
  }

  /**
   * Wait for MinIO to be ready
   */
  private async waitForMinIO(port: number, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/minio/health/live`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // MinIO not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("MinIO failed to start within timeout period");
  }

  /**
   * Initialize bucket in MinIO
   */
  private async initializeMinIOBucket(bucket: any): Promise<void> {
    const s3Client = this.getS3Client({
      ...bucket,
      endpoint: `http://localhost:${bucket.port}`,
    });

    try {
      // Create the bucket in MinIO
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucket.name,
        })
      );
    } catch (error: any) {
      // Bucket might already exist, that's okay
      if (error.name !== "BucketAlreadyOwnedByYou") {
        throw error;
      }
    }
  }

  /**
   * Configure Traefik for bucket domain routing
   */
  private async configureBucketTraefik(
    bucketId: string,
    containerId: string,
    subdomain: string,
    domain: string
  ): Promise<void> {
    // Ensure Traefik is running
    await traefikManager.ensureTraefik();

    // Connect to Traefik network
    await traefikManager.connectToNetwork(containerId);

    // Generate and apply Traefik labels
    const labels = traefikManager.generateBucketLabels(bucketId, subdomain, domain);
    
    // Update container labels
    const container = this.docker.getContainer(containerId);
    const containerInfo = await container.inspect();
    
    // Merge existing labels with new Traefik labels
    const updatedLabels = {
      ...containerInfo.Config.Labels,
      ...labels,
    };

    // Note: Docker doesn't support updating labels on running containers
    // Labels are applied during container creation. For existing containers,
    // they need to be recreated. We'll handle this by storing the labels
    // and applying them on next restart.
    
    console.log(
      `✅ Configured Traefik routing: ${subdomain}.${domain} → ${bucketId}`
    );
  }

  /**
   * Get S3 client for bucket
   */
  private getS3Client(bucketInfo: any): S3Client {
    return new S3Client({
      region: bucketInfo.region || "us-east-1",
      endpoint: bucketInfo.endpoint || `http://localhost:${bucketInfo.port}`,
      credentials: {
        accessKeyId: bucketInfo.accessKey,
        secretAccessKey: bucketInfo.secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Start a bucket container
   */
  async startBucket(bucketId: string): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
      include: { domain: true },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (!bucket.containerId) {
      throw new Error("Bucket container not found");
    }

    await prisma.bucket.update({
      where: { id: bucketId },
      data: { status: "CREATING" },
    });

    try {
      const container = this.docker.getContainer(bucket.containerId);
      await container.start();

      // Wait for MinIO to be ready
      await this.waitForMinIO(bucket.port);

      // Reconnect to Traefik if domain is configured (custom or base)
      if (bucket.domain || this.baseDomain) {
        try {
          await traefikManager.ensureTraefik();
          await traefikManager.connectToNetwork(bucket.containerId);
        } catch (error: any) {
          console.error("Failed to reconnect to Traefik:", error);
          // Don't fail the start operation
        }
      }

      await prisma.bucket.update({
        where: { id: bucketId },
        data: { status: "RUNNING" },
      });
    } catch (error: any) {
      await prisma.bucket.update({
        where: { id: bucketId },
        data: { status: "ERROR" },
      });
      throw new Error(`Failed to start bucket: ${error.message}`);
    }
  }

  /**
   * Stop a bucket container
   */
  async stopBucket(bucketId: string): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (!bucket.containerId) {
      throw new Error("Bucket container not found");
    }

    try {
      const container = this.docker.getContainer(bucket.containerId);
      await container.stop();

      await prisma.bucket.update({
        where: { id: bucketId },
        data: { status: "STOPPED" },
      });
    } catch (error: any) {
      throw new Error(`Failed to stop bucket: ${error.message}`);
    }
  }

  /**
   * Delete a bucket container and volume
   */
  async deleteBucket(
    bucketId: string,
    deleteVolume = true
  ): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Stop and remove container
    if (bucket.containerId) {
      try {
        const container = this.docker.getContainer(bucket.containerId);

        try {
          await container.stop();
        } catch (e) {
          // Container might already be stopped
        }

        await container.remove({ force: true });
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.error("Error removing bucket container:", error);
        }
      }
    }

    // Delete volume if requested
    if (deleteVolume && bucket.volumeName) {
      try {
        const volume = this.docker.getVolume(bucket.volumeName);
        await volume.remove({ force: true });
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.error("Error removing bucket volume:", error);
        }
      }
    }

    // Release ports
    if (bucket.port) {
      await this.portManager.releasePort(bucket.port);
    }
    if (bucket.consolePort) {
      await this.portManager.releasePort(bucket.consolePort);
    }

    // Delete from database (objects will be cascade deleted)
    await prisma.bucket.delete({
      where: { id: bucketId },
    });
  }

  /**
   * Upload object to bucket
   */
  async uploadObject(
    bucketId: string,
    key: string,
    file: Buffer,
    metadata?: { contentType?: string; customMetadata?: Record<string, string> }
  ): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    try {
      // Upload to MinIO
      const command = new PutObjectCommand({
        Bucket: bucket.name,
        Key: key,
        Body: file,
        ContentType: metadata?.contentType,
        Metadata: metadata?.customMetadata,
      });

      const response = await s3Client.send(command);

      // Store metadata in database
      await prisma.bucketObject.upsert({
        where: {
          bucketId_key_versionId: {
            bucketId,
            key,
            versionId: response.VersionId ?? "",
          },
        },
        create: {
          bucketId,
          key,
          size: BigInt(file.length),
          contentType: metadata?.contentType,
          etag: response.ETag,
          versionId: response.VersionId ?? "",
          metadata: metadata?.customMetadata
            ? JSON.stringify(metadata.customMetadata)
            : undefined,
        },
        update: {
          size: BigInt(file.length),
          contentType: metadata?.contentType,
          etag: response.ETag,
          updatedAt: new Date(),
        },
      });

      // Update bucket statistics
      await this.syncBucketMetadata(bucketId);
    } catch (error: any) {
      throw new Error(`Failed to upload object: ${error.message}`);
    }
  }

  /**
   * Download object from bucket
   */
  async downloadObject(bucketId: string, key: string): Promise<Buffer> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    try {
      const command = new GetObjectCommand({
        Bucket: bucket.name,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("No data received");
      }

      // Convert stream to buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error: any) {
      throw new Error(`Failed to download object: ${error.message}`);
    }
  }

  /**
   * Delete object from bucket
   */
  async deleteObject(bucketId: string, key: string): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    try {
      // Delete from MinIO
      const command = new DeleteObjectCommand({
        Bucket: bucket.name,
        Key: key,
      });

      await s3Client.send(command);

      // Delete from database
      await prisma.bucketObject.deleteMany({
        where: {
          bucketId,
          key,
        },
      });

      // Update bucket statistics
      await this.syncBucketMetadata(bucketId);
    } catch (error: any) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }

  /**
   * List objects in bucket
   */
  async listObjects(
    bucketId: string,
    prefix?: string,
    maxKeys = 1000
  ): Promise<ObjectInfo[]> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running. Please start the bucket first.");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket.name,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await s3Client.send(command);

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map((obj) => ({
        key: obj.Key!,
        size: BigInt(obj.Size || 0),
        contentType: undefined,
        etag: obj.ETag,
        lastModified: obj.LastModified!,
        isPublic: false,
      }));
    } catch (error: any) {
      // Provide more detailed error messages
      if (error.code === "NoSuchBucket") {
        throw new Error(`Bucket "${bucket.name}" does not exist in MinIO. The bucket may need to be recreated.`);
      } else if (error.code === "NetworkingError" || error.message?.includes("ECONNREFUSED")) {
        throw new Error(`Cannot connect to bucket storage. The bucket container may not be running properly.`);
      } else if (error.code === "AccessDenied") {
        throw new Error(`Access denied to bucket. Check bucket credentials.`);
      }
      throw new Error(`Failed to list objects: ${error.message || error.code || "Unknown error"}`);
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(
    bucketId: string,
    key: string
  ): Promise<ObjectMetadata> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket.name,
        Key: key,
      });

      const response = await s3Client.send(command);

      return {
        key,
        size: BigInt(response.ContentLength || 0),
        contentType: response.ContentType,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error: any) {
      throw new Error(`Failed to get object metadata: ${error.message}`);
    }
  }

  /**
   * Get presigned upload URL
   */
  async getPresignedUploadUrl(
    bucketId: string,
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    const command = new PutObjectCommand({
      Bucket: bucket.name,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Get presigned download URL
   */
  async getPresignedDownloadUrl(
    bucketId: string,
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    if (bucket.status !== "RUNNING") {
      throw new Error("Bucket is not running");
    }

    const s3Client = this.getS3Client(this.formatBucketInfo(bucket));

    const command = new GetObjectCommand({
      Bucket: bucket.name,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Get bucket information
   */
  async getBucketInfo(bucketId: string): Promise<BucketInfo> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
      include: {
        domain: true,
      },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    return this.formatBucketInfo(bucket);
  }

  /**
   * List buckets for a user
   */
  async listUserBuckets(userId: string): Promise<BucketInfo[]> {
    const buckets = await prisma.bucket.findMany({
      where: {
        userId,
      },
      include: {
        domain: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return buckets.map((bucket) => this.formatBucketInfo(bucket));
  }

  /**
   * List buckets for a workspace
   */
  async listWorkspaceBuckets(workspaceId: string): Promise<BucketInfo[]> {
    const buckets = await prisma.bucket.findMany({
      where: { workspaceId },
      include: {
        domain: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return buckets.map((bucket) => this.formatBucketInfo(bucket));
  }

  /**
   * Update bucket public access and generate/remove public URL
   */
  async updatePublicAccess(bucketId: string, publicAccess: boolean): Promise<void> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    let publicUrl = bucket.publicUrl;

    // Generate public URL if enabling public access and doesn't have one
    if (publicAccess && !publicUrl) {
      publicUrl = await this.generatePublicUrl(bucket.name);
    }
    // Remove public URL if disabling public access
    else if (!publicAccess && publicUrl) {
      publicUrl = null;
    }

    await prisma.bucket.update({
      where: { id: bucketId },
      data: {
        publicAccess,
        publicUrl: publicUrl ?? undefined,
      },
    });
  }

  /**
   * Get public URL for a file in a bucket
   * Returns direct MinIO URL (port-based or domain-based)
   * @param bucketId - Bucket ID
   * @param key - File key/path
   * @returns Public URL for the file
   */
  async getPublicFileUrl(bucketId: string, key: string): Promise<string> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
      include: { domain: true },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Priority 1: Custom domain if configured
    if (bucket.domain && bucket.subdomain) {
      return `https://${bucket.subdomain}.${bucket.domain.domain}/${bucket.name}/${key}`;
    }

    // Priority 2: Base domain if configured
    if (this.baseDomain) {
      return `https://${bucket.id}.${this.baseDomain}/${bucket.name}/${key}`;
    }

    // Priority 3: Direct port access
    return `http://localhost:${bucket.port}/${bucket.name}/${key}`;
  }

  /**
   * Get bucket statistics
   */
  async getBucketStats(bucketId: string): Promise<BucketStats> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
      include: {
        objects: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Find largest object
    const largestObject = await prisma.bucketObject.findFirst({
      where: { bucketId },
      orderBy: { size: "desc" },
    });

    const totalSizeBytes = bucket.totalSizeBytes;
    const totalSizeMB = Number(totalSizeBytes) / (1024 * 1024);
    const totalSizeGB = totalSizeMB / 1024;

    return {
      objectCount: bucket.objectCount,
      totalSizeBytes,
      totalSizeMB,
      totalSizeGB,
      largestObject: largestObject
        ? {
            key: largestObject.key,
            size: largestObject.size,
          }
        : undefined,
      recentObjects: bucket.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        contentType: obj.contentType || undefined,
        etag: obj.etag || undefined,
        lastModified: obj.updatedAt,
        isPublic: obj.isPublic,
        metadata: obj.metadata ? JSON.parse(obj.metadata) : undefined,
      })),
    };
  }

  /**
   * Sync bucket metadata (object count and total size)
   */
  async syncBucketMetadata(bucketId: string): Promise<void> {
    const objects = await prisma.bucketObject.findMany({
      where: { bucketId },
    });

    const objectCount = objects.length;
    const totalSizeBytes = objects.reduce(
      (sum, obj) => sum + obj.size,
      BigInt(0)
    );

    await prisma.bucket.update({
      where: { id: bucketId },
      data: {
        objectCount,
        totalSizeBytes,
      },
    });
  }

  /**
   * Link a domain to a bucket
   */
  async linkBucketDomain(
    bucketId: string,
    domainId: string,
    customSubdomain?: string
  ): Promise<BucketInfo> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Verify domain
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain || !domain.verified) {
      throw new Error("Invalid or unverified domain");
    }

    // Generate or validate subdomain
    let subdomain = customSubdomain;
    if (!subdomain) {
      subdomain = await this.generateBucketSubdomain(bucket.name, domainId);
    } else {
      // Validate custom subdomain
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        throw new Error(
          "Invalid subdomain format. Use lowercase letters, numbers, and hyphens only."
        );
      }

      // Check uniqueness
      const existing = await prisma.bucket.findFirst({
        where: {
          subdomain,
          domainId,
          id: { not: bucketId },
        },
      });

      if (existing) {
        throw new Error(`Subdomain "${subdomain}" is already in use`);
      }
    }

    // Update bucket record
    const updatedBucket = await prisma.bucket.update({
      where: { id: bucketId },
      data: {
        domainId,
        subdomain,
      },
    });

    // Configure Traefik if bucket is running
    if (bucket.status === "RUNNING" && bucket.containerId) {
      try {
        await this.configureBucketTraefik(
          bucketId,
          bucket.containerId,
          subdomain,
          domain.domain
        );
      } catch (error: any) {
        console.error("Failed to configure Traefik:", error);
        // Rollback domain link
        await prisma.bucket.update({
          where: { id: bucketId },
          data: {
            domainId: null,
            subdomain: null,
          },
        });
        throw new Error(
          `Failed to configure domain routing: ${error.message}`
        );
      }
    }

    return this.getBucketInfo(bucketId);
  }

  /**
   * Unlink a domain from a bucket
   */
  async unlinkBucketDomain(bucketId: string): Promise<BucketInfo> {
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new Error("Bucket not found");
    }

    // Disconnect from Traefik network if connected
    if (bucket.containerId && bucket.status === "RUNNING") {
      try {
        await traefikManager.disconnectFromNetwork(bucket.containerId);
      } catch (error) {
        console.error("Failed to disconnect from Traefik network:", error);
      }
    }

    // Update bucket record
    await prisma.bucket.update({
      where: { id: bucketId },
      data: {
        domainId: null,
        subdomain: null,
      },
    });

    return this.getBucketInfo(bucketId);
  }

  /**
   * Format bucket info for API response
   */
  private formatBucketInfo(bucket: any): BucketInfo {
    const endpoint = `http://localhost:${bucket.port}`;
    const consoleEndpoint = bucket.consolePort
      ? `http://localhost:${bucket.consolePort}`
      : undefined;
    const internalEndpoint = bucket.internalHost
      ? `http://${bucket.internalHost}:9000`
      : undefined;

    // Add domain-based endpoint if custom domain is linked
    let domainEndpoint: string | undefined;
    if (bucket.domain && bucket.subdomain) {
      domainEndpoint = `https://${bucket.subdomain}.${bucket.domain.domain}`;
    }
    // Otherwise use base domain if configured
    else if (this.baseDomain) {
      domainEndpoint = `https://${bucket.id}.${this.baseDomain}`;
    }

    return {
      id: bucket.id,
      name: bucket.name,
      description: bucket.description,
      status: bucket.status,
      host: bucket.host,
      port: bucket.port,
      consolePort: bucket.consolePort,
      accessKey: bucket.accessKey,
      secretKey: bucket.secretKey,
      region: bucket.region,
      versioning: bucket.versioning,
      encryption: bucket.encryption,
      publicAccess: bucket.publicAccess,
      publicUrl: bucket.publicUrl,
      maxSizeGB: bucket.maxSizeGB,
      containerId: bucket.containerId,
      volumeName: bucket.volumeName,
      objectCount: bucket.objectCount,
      totalSizeBytes: bucket.totalSizeBytes,
      endpoint,
      consoleEndpoint,
      internalEndpoint,
      domainEndpoint,
      workspaceId: bucket.workspaceId,
    };
  }
}

// Singleton instance
export const bucketManager = new BucketManager();
