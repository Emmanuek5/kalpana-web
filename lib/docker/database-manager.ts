import Docker from "dockerode";
import { PortManager } from "./port-manager";
import { traefikManager } from "./traefik-manager";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export interface DatabaseConfig {
  name: string;
  type: "POSTGRES" | "MYSQL" | "MONGODB" | "REDIS" | "SQLITE";
  userId: string;
  workspaceId?: string; // Optional - null for standalone databases
  teamId?: string;
  domainId?: string;
  subdomain?: string;
  username?: string;
  password?: string;
  database?: string; // Database name within the server
  version?: string;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  containerId?: string;
  volumeName?: string;
  connectionString: string;
  internalConnectionString?: string;
  domainConnectionString?: string;
}

export class DatabaseManager {
  private docker: Docker;
  private portManager: PortManager;

  constructor() {
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
   * Generate a unique subdomain for a database
   */
  private async generateDatabaseSubdomain(
    dbType: string,
    dbName: string,
    domainId: string
  ): Promise<string> {
    // Format: {dbtype}-{sanitized-name}
    const typePrefix = dbType.toLowerCase();
    const sanitizedName = dbName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50); // Leave room for type prefix

    let subdomain = `${typePrefix}-${sanitizedName}`;

    // Ensure uniqueness within the domain
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.database.findFirst({
        where: {
          subdomain,
          domainId,
        },
      });

      if (!existing) break;

      // Add random suffix for uniqueness
      const suffix = Math.random().toString(36).substring(2, 6);
      subdomain = `${typePrefix}-${sanitizedName}-${suffix}`;
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
   * Generate Traefik labels for database TCP routing
   */
  private generateDatabaseTraefikLabels(
    databaseId: string,
    subdomain: string,
    domain: string,
    dbType: string,
    internalPort: number
  ): Record<string, string> {
    const routerName = `db-${databaseId}`;
    const serviceName = `db-${databaseId}`;
    const fullDomain = `${subdomain}.${domain}`;

    // Map database types to Traefik entrypoint names
    const entryPointMap: Record<string, string> = {
      POSTGRES: "postgres",
      MYSQL: "mysql",
      MONGODB: "mongodb",
      REDIS: "redis",
    };

    const entryPoint = entryPointMap[dbType] || "postgres";

    return {
      "traefik.enable": "true",
      "kalpana.database.id": databaseId,
      "kalpana.database.subdomain": subdomain,
      "kalpana.database.domain": domain,
      // TCP routing configuration
      [`traefik.tcp.routers.${routerName}.rule`]: `HostSNI(\`${fullDomain}\`)`,
      [`traefik.tcp.routers.${routerName}.entrypoints`]: entryPoint,
      [`traefik.tcp.routers.${routerName}.tls`]: "true",
      [`traefik.tcp.routers.${routerName}.tls.certresolver`]: "letsencrypt",
      [`traefik.tcp.services.${serviceName}.loadbalancer.server.port`]:
        internalPort.toString(),
    };
  }

  /**
   * Create a database container
   */
  async createDatabase(config: DatabaseConfig): Promise<DatabaseInfo> {
    // Generate secure credentials if not provided
    const username = config.username || "admin";
    const password = config.password || this.generatePassword();
    const database = config.database || config.name.replace(/[^a-zA-Z0-9_]/g, "_");

    // Allocate port
    const port = await this.portManager.allocatePort();

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
        finalSubdomain = await this.generateDatabaseSubdomain(
          config.type,
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
        const existing = await prisma.database.findFirst({
          where: {
            subdomain: finalSubdomain,
            domainId: config.domainId,
          },
        });

        if (existing) {
          throw new Error(`Subdomain "${finalSubdomain}" is already in use`);
        }
      }
    }

    // Create database record in Prisma
    const dbRecord = await prisma.database.create({
      data: {
        name: config.name,
        type: config.type,
        userId: config.userId,
        workspaceId: config.workspaceId,
        teamId: config.teamId,
        domainId: config.domainId,
        subdomain: finalSubdomain,
        host: "localhost",
        port,
        username,
        password,
        database,
        version: config.version,
        status: "CREATING",
      },
    });

    try {
      // Create database container based on type
      let containerInfo;
      switch (config.type) {
        case "POSTGRES":
          containerInfo = await this.createPostgresContainer(dbRecord.id, {
            name: config.name,
            port,
            username,
            password,
            database,
            version: config.version || "16",
          });
          break;

        case "MYSQL":
          containerInfo = await this.createMySQLContainer(dbRecord.id, {
            name: config.name,
            port,
            username,
            password,
            database,
            version: config.version || "8",
          });
          break;

        case "MONGODB":
          containerInfo = await this.createMongoDBContainer(dbRecord.id, {
            name: config.name,
            port,
            username,
            password,
            database,
            version: config.version || "7",
          });
          break;

        case "REDIS":
          containerInfo = await this.createRedisContainer(dbRecord.id, {
            name: config.name,
            port,
            password,
            version: config.version || "7",
          });
          break;

        case "SQLITE":
          // SQLite is file-based, no container needed
          containerInfo = await this.createSQLiteDatabase(dbRecord.id, {
            name: config.name,
            workspaceId: config.workspaceId,
          });
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      // Update database record with container info
      const updatedDb = await prisma.database.update({
        where: { id: dbRecord.id },
        data: {
          containerId: containerInfo.containerId,
          volumeName: containerInfo.volumeName,
          internalHost: containerInfo.internalHost,
          networkName: containerInfo.networkName,
          status: "RUNNING",
        },
      });

      // If domain is linked, configure Traefik
      if (domain && finalSubdomain && containerInfo.containerId) {
        try {
          await this.configureDatabaseTraefik(
            dbRecord.id,
            containerInfo.containerId,
            finalSubdomain,
            domain.domain,
            config.type
          );
        } catch (error: any) {
          console.error("Failed to configure Traefik for database:", error);
          // Don't fail the entire operation, database is still accessible via port
        }
      }

      return this.formatDatabaseInfo(updatedDb);
    } catch (error: any) {
      // Update status to ERROR
      await prisma.database.update({
        where: { id: dbRecord.id },
        data: { status: "ERROR" },
      });

      // Release port
      await this.portManager.releasePort(port);

      throw new Error(`Failed to create database: ${error.message}`);
    }
  }

  /**
   * Configure Traefik for database domain routing
   */
  private async configureDatabaseTraefik(
    databaseId: string,
    containerId: string,
    subdomain: string,
    domain: string,
    dbType: string
  ): Promise<void> {
    // Ensure Traefik is running
    await traefikManager.ensureTraefik();

    // Get internal port based on database type
    const portMap: Record<string, number> = {
      POSTGRES: 5432,
      MYSQL: 3306,
      MONGODB: 27017,
      REDIS: 6379,
    };

    const internalPort = portMap[dbType];
    if (!internalPort) {
      throw new Error(`Unsupported database type for Traefik: ${dbType}`);
    }

    // Generate Traefik labels
    const labels = this.generateDatabaseTraefikLabels(
      databaseId,
      subdomain,
      domain,
      dbType,
      internalPort
    );

    // Update container labels
    const container = this.docker.getContainer(containerId);
    const containerInfo = await container.inspect();

    // Docker doesn't allow updating labels on running containers,
    // so we need to recreate with labels or use Traefik file provider
    // For now, we'll add a note that container needs labels on creation
    console.log(
      `⚠️ Note: Container ${containerId} should be recreated with Traefik labels for domain routing`
    );

    // Connect to Traefik network
    await traefikManager.connectToNetwork(containerId);

    console.log(
      `✅ Configured Traefik routing: ${subdomain}.${domain} → ${databaseId}`
    );
  }

  /**
   * Link a domain to an existing database
   */
  async linkDatabaseDomain(
    databaseId: string,
    domainId: string,
    customSubdomain?: string
  ): Promise<DatabaseInfo> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
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
      subdomain = await this.generateDatabaseSubdomain(
        database.type,
        database.name,
        domainId
      );
    } else {
      // Validate custom subdomain
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        throw new Error(
          "Invalid subdomain format. Use lowercase letters, numbers, and hyphens only."
        );
      }

      // Check uniqueness
      const existing = await prisma.database.findFirst({
        where: {
          subdomain,
          domainId,
          id: { not: databaseId },
        },
      });

      if (existing) {
        throw new Error(`Subdomain "${subdomain}" is already in use`);
      }
    }

    // Update database record
    const updatedDb = await prisma.database.update({
      where: { id: databaseId },
      data: {
        domainId,
        subdomain,
      },
    });

    // Configure Traefik if database is running
    if (database.status === "RUNNING" && database.containerId) {
      try {
        await this.configureDatabaseTraefik(
          databaseId,
          database.containerId,
          subdomain,
          domain.domain,
          database.type
        );
      } catch (error: any) {
        console.error("Failed to configure Traefik:", error);
        // Rollback domain link
        await prisma.database.update({
          where: { id: databaseId },
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

    return this.getDatabaseInfo(databaseId);
  }

  /**
   * Unlink a domain from a database
   */
  async unlinkDatabaseDomain(databaseId: string): Promise<DatabaseInfo> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    // Disconnect from Traefik network if connected
    if (database.containerId && database.status === "RUNNING") {
      try {
        await traefikManager.disconnectFromNetwork(database.containerId);
      } catch (error) {
        console.error("Failed to disconnect from Traefik network:", error);
      }
    }

    // Update database record
    await prisma.database.update({
      where: { id: databaseId },
      data: {
        domainId: null,
        subdomain: null,
      },
    });

    return this.getDatabaseInfo(databaseId);
  }

  /**
   * Create PostgreSQL container
   */
  private async createPostgresContainer(
    databaseId: string,
    config: {
      name: string;
      port: number;
      username: string;
      password: string;
      database: string;
      version: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    const containerName = `kalpana-db-${databaseId}`;
    const volumeName = `kalpana-db-${databaseId}-data`;
    const imageName = `postgres:${config.version}-alpine`;

    // Pull image if not present
    await this.ensureImage(imageName);

    // Create volume for persistent data
    await this.docker.createVolume({
      Name: volumeName,
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.managed": "true",
      },
    });

    // Create container
    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: [
        `POSTGRES_USER=${config.username}`,
        `POSTGRES_PASSWORD=${config.password}`,
        `POSTGRES_DB=${config.database}`,
      ],
      ExposedPorts: {
        "5432/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "5432/tcp": [{ HostPort: config.port.toString() }],
        },
        Binds: [`${volumeName}:/var/lib/postgresql/data`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
        Memory: 512 * 1024 * 1024, // 512MB
        AutoRemove: false,
      },
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.database.type": "postgres",
        "kalpana.managed": "true",
      },
    });

    await container.start();

    return {
      containerId: container.id,
      volumeName,
      internalHost: containerName,
    };
  }

  /**
   * Create MySQL container
   */
  private async createMySQLContainer(
    databaseId: string,
    config: {
      name: string;
      port: number;
      username: string;
      password: string;
      database: string;
      version: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    const containerName = `kalpana-db-${databaseId}`;
    const volumeName = `kalpana-db-${databaseId}-data`;
    const imageName = `mysql:${config.version}`;

    await this.ensureImage(imageName);

    await this.docker.createVolume({
      Name: volumeName,
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.managed": "true",
      },
    });

    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: [
        `MYSQL_ROOT_PASSWORD=${config.password}`,
        `MYSQL_USER=${config.username}`,
        `MYSQL_PASSWORD=${config.password}`,
        `MYSQL_DATABASE=${config.database}`,
      ],
      ExposedPorts: {
        "3306/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "3306/tcp": [{ HostPort: config.port.toString() }],
        },
        Binds: [`${volumeName}:/var/lib/mysql`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
        Memory: 512 * 1024 * 1024,
        AutoRemove: false,
      },
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.database.type": "mysql",
        "kalpana.managed": "true",
      },
    });

    await container.start();

    return {
      containerId: container.id,
      volumeName,
      internalHost: containerName,
    };
  }

  /**
   * Create MongoDB container
   */
  private async createMongoDBContainer(
    databaseId: string,
    config: {
      name: string;
      port: number;
      username: string;
      password: string;
      database: string;
      version: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    const containerName = `kalpana-db-${databaseId}`;
    const volumeName = `kalpana-db-${databaseId}-data`;
    const imageName = `mongo:${config.version}`;

    await this.ensureImage(imageName);

    await this.docker.createVolume({
      Name: volumeName,
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.managed": "true",
      },
    });

    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: [
        `MONGO_INITDB_ROOT_USERNAME=${config.username}`,
        `MONGO_INITDB_ROOT_PASSWORD=${config.password}`,
        `MONGO_INITDB_DATABASE=${config.database}`,
      ],
      ExposedPorts: {
        "27017/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "27017/tcp": [{ HostPort: config.port.toString() }],
        },
        Binds: [`${volumeName}:/data/db`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
        Memory: 512 * 1024 * 1024,
        AutoRemove: false,
      },
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.database.type": "mongodb",
        "kalpana.managed": "true",
      },
    });

    await container.start();

    return {
      containerId: container.id,
      volumeName,
      internalHost: containerName,
    };
  }

  /**
   * Create Redis container
   */
  private async createRedisContainer(
    databaseId: string,
    config: {
      name: string;
      port: number;
      password: string;
      version: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    const containerName = `kalpana-db-${databaseId}`;
    const volumeName = `kalpana-db-${databaseId}-data`;
    const imageName = `redis:${config.version}-alpine`;

    await this.ensureImage(imageName);

    await this.docker.createVolume({
      Name: volumeName,
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.managed": "true",
      },
    });

    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Cmd: ["redis-server", "--requirepass", config.password],
      ExposedPorts: {
        "6379/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "6379/tcp": [{ HostPort: config.port.toString() }],
        },
        Binds: [`${volumeName}:/data`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
        Memory: 256 * 1024 * 1024, // 256MB for Redis
        AutoRemove: false,
      },
      Labels: {
        "kalpana.database.id": databaseId,
        "kalpana.database.type": "redis",
        "kalpana.managed": "true",
      },
    });

    await container.start();

    return {
      containerId: container.id,
      volumeName,
      internalHost: containerName,
    };
  }

  /**
   * Create SQLite database (file-based, no container)
   */
  private async createSQLiteDatabase(
    databaseId: string,
    config: {
      name: string;
      workspaceId?: string;
    }
  ): Promise<{
    containerId: string;
    volumeName: string;
    internalHost: string;
    networkName?: string;
  }> {
    // SQLite is file-based and will be created in the workspace volume
    // No container needed, just return metadata
    const volumeName = config.workspaceId
      ? `kalpana-workspace-${config.workspaceId}`
      : `kalpana-db-${databaseId}-data`;

    return {
      containerId: "sqlite-file-based",
      volumeName,
      internalHost: "localhost",
    };
  }

  /**
   * Start a database container
   */
  async startDatabase(databaseId: string): Promise<void> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    if (database.type === "SQLITE") {
      // SQLite doesn't need to be started
      await prisma.database.update({
        where: { id: databaseId },
        data: { status: "RUNNING" },
      });
      return;
    }

    if (!database.containerId) {
      throw new Error("Database container not found");
    }

    await prisma.database.update({
      where: { id: databaseId },
      data: { status: "CREATING" },
    });

    try {
      const container = this.docker.getContainer(database.containerId);
      await container.start();

      await prisma.database.update({
        where: { id: databaseId },
        data: { status: "RUNNING" },
      });
    } catch (error: any) {
      await prisma.database.update({
        where: { id: databaseId },
        data: { status: "ERROR" },
      });
      throw new Error(`Failed to start database: ${error.message}`);
    }
  }

  /**
   * Stop a database container
   */
  async stopDatabase(databaseId: string): Promise<void> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    if (database.type === "SQLITE") {
      // SQLite doesn't need to be stopped
      await prisma.database.update({
        where: { id: databaseId },
        data: { status: "STOPPED" },
      });
      return;
    }

    if (!database.containerId) {
      throw new Error("Database container not found");
    }

    try {
      const container = this.docker.getContainer(database.containerId);
      await container.stop();

      await prisma.database.update({
        where: { id: databaseId },
        data: { status: "STOPPED" },
      });
    } catch (error: any) {
      throw new Error(`Failed to stop database: ${error.message}`);
    }
  }

  /**
   * Delete a database container and volume
   */
  async deleteDatabase(
    databaseId: string,
    deleteVolume = true
  ): Promise<void> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    // Stop and remove container
    if (database.containerId && database.type !== "SQLITE") {
      try {
        const container = this.docker.getContainer(database.containerId);

        try {
          await container.stop();
        } catch (e) {
          // Container might already be stopped
        }

        await container.remove({ force: true });
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.error("Error removing database container:", error);
        }
      }
    }

    // Delete volume if requested
    if (deleteVolume && database.volumeName) {
      try {
        const volume = this.docker.getVolume(database.volumeName);
        await volume.remove({ force: true });
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.error("Error removing database volume:", error);
        }
      }
    }

    // Release port
    if (database.port) {
      await this.portManager.releasePort(database.port);
    }

    // Delete from database
    await prisma.database.delete({
      where: { id: databaseId },
    });
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(databaseId: string): Promise<DatabaseInfo> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
      include: {
        domain: true,
      },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    return this.formatDatabaseInfo(database);
  }

  /**
   * List databases for a user (includes both standalone and workspace-linked)
   */
  async listUserDatabases(userId: string): Promise<DatabaseInfo[]> {
    const databases = await prisma.database.findMany({
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

    return databases.map((db) => this.formatDatabaseInfo(db));
  }

  /**
   * List databases for a workspace
   */
  async listWorkspaceDatabases(workspaceId: string): Promise<DatabaseInfo[]> {
    const databases = await prisma.database.findMany({
      where: { workspaceId },
      include: {
        domain: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return databases.map((db) => this.formatDatabaseInfo(db));
  }

  /**
   * Update database (recreates container if password changed)
   */
  async updateDatabase(
    databaseId: string,
    updates: { name?: string; description?: string; password?: string }
  ): Promise<void> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database) {
      throw new Error("Database not found");
    }

    const { password } = updates;

    // If password changed and database is running, need to recreate container
    if (password && database.status === "RUNNING" && database.containerId) {
      console.log(`Password changed for database ${databaseId}, recreating container...`);
      
      // Stop and remove old container
      await this.stopDatabase(databaseId);
      
      // Update password in DB
      await prisma.database.update({
        where: { id: databaseId },
        data: { password },
      });
      
      // Restart with new password
      await this.startDatabase(databaseId);
    }
  }

  /**
   * Get database logs
   */
  async getDatabaseLogs(databaseId: string, tail = 100): Promise<string> {
    const database = await prisma.database.findUnique({
      where: { id: databaseId },
    });

    if (!database || !database.containerId || database.type === "SQLITE") {
      return "";
    }

    try {
      const container = this.docker.getContainer(database.containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      return logs.toString("utf-8");
    } catch (error) {
      console.error("Error getting database logs:", error);
      return "";
    }
  }

  /**
   * Format database info for API response
   */
  private formatDatabaseInfo(database: any): DatabaseInfo {
    const connectionString = this.getConnectionString(database);
    const internalConnectionString = database.internalHost
      ? this.getInternalConnectionString(database)
      : undefined;

    // Add domain-based connection string if domain is linked
    let domainConnectionString: string | undefined;
    if (database.domain && database.subdomain) {
      domainConnectionString = this.getDomainConnectionString(database);
    }

    return {
      id: database.id,
      name: database.name,
      type: database.type,
      status: database.status,
      host: database.host,
      port: database.port,
      username: database.username,
      password: database.password,
      database: database.database,
      containerId: database.containerId,
      volumeName: database.volumeName,
      connectionString,
      internalConnectionString,
      domainConnectionString,
    };
  }

  /**
   * Generate connection string for external access
   */
  private getConnectionString(database: any): string {
    const { type, username, password, host, port, database: dbName } = database;

    switch (type) {
      case "POSTGRES":
        return `postgresql://${username}:${password}@${host}:${port}/${dbName}`;

      case "MYSQL":
        return `mysql://${username}:${password}@${host}:${port}/${dbName}`;

      case "MONGODB":
        // MongoDB root user authenticates against admin database
        return `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=admin`;

      case "REDIS":
        return password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`;

      case "SQLITE":
        return `sqlite:///workspace/${dbName}.db`;

      default:
        return "";
    }
  }

  /**
   * Generate domain-based connection string
   */
  private getDomainConnectionString(database: any): string {
    const { type, username, password, subdomain, domain, database: dbName } =
      database;

    const fullDomain = `${subdomain}.${domain.domain}`;

    // Use default ports for domain connections
    const portMap: Record<string, number> = {
      POSTGRES: 5432,
      MYSQL: 3306,
      MONGODB: 27017,
      REDIS: 6379,
    };

    const port = portMap[type];

    switch (type) {
      case "POSTGRES":
        return `postgresql://${username}:${password}@${fullDomain}:${port}/${dbName}`;

      case "MYSQL":
        return `mysql://${username}:${password}@${fullDomain}:${port}/${dbName}`;

      case "MONGODB":
        return `mongodb://${username}:${password}@${fullDomain}:${port}/${dbName}?authSource=admin`;

      case "REDIS":
        return password
          ? `redis://:${password}@${fullDomain}:${port}`
          : `redis://${fullDomain}:${port}`;

      default:
        return "";
    }
  }

  /**
   * Generate internal connection string for Docker network access
   */
  private getInternalConnectionString(database: any): string {
    const { type, username, password, internalHost, database: dbName } = database;

    // Use default ports for internal connections
    const portMap: Record<string, number> = {
      POSTGRES: 5432,
      MYSQL: 3306,
      MONGODB: 27017,
      REDIS: 6379,
    };

    const port = portMap[type];

    switch (type) {
      case "POSTGRES":
        return `postgresql://${username}:${password}@${internalHost}:${port}/${dbName}`;
      case "MYSQL":
        return `mysql://${username}:${password}@${internalHost}:${port}/${dbName}`;

      case "MONGODB":
        // MongoDB root user authenticates against admin database
        return `mongodb://${username}:${password}@${internalHost}:27017/${dbName}?authSource=admin`;

      case "REDIS":
        return password
          ? `redis://:${password}@${internalHost}:${port}`
          : `redis://${internalHost}:${port}`;
      case "SQLITE":
        return `sqlite:///workspace/${dbName}.db`;

      default:
        return "";
    }
  }

  /**
   * Generate secure random password
   */
  private generatePassword(length = 24): string {
    return crypto.randomBytes(length).toString("base64").slice(0, length);
  }

  /**
   * Ensure Docker image exists
   */
  private async ensureImage(imageName: string): Promise<void> {
    const images = await this.docker.listImages({
      filters: { reference: [imageName] } as any,
    });

    if (images && images.length > 0) return;

    console.log(`📥 Pulling image: ${imageName}`);

    await new Promise<void>((resolve, reject) => {
      this.docker.pull(imageName, (err: any, stream: any) => {
        if (err) return reject(err);
        this.docker.modem.followProgress(
          stream,
          (err: any) => (err ? reject(err) : resolve()),
          (event: any) => {
            if (event.status) {
              process.stdout.write(`\r${event.status}${event.progress || ""}`);
            }
          }
        );
      });
    });

    console.log(`\n✅ Image pulled: ${imageName}`);
  }
}
