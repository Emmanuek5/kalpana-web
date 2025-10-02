import { prisma } from "@/lib/db";

/**
 * Checkpoint Service - Manages workspace checkpoints using Git Stash
 * 
 * Strategy: Use git stash to create isolated snapshots that don't interfere
 * with the user's git workflow. Each checkpoint is a stash entry with a
 * special naming convention: "kalpana-checkpoint-{messageId}"
 */

export interface CheckpointMetadata {
  id: string;
  messageId: string;
  workspaceId: string;
  timestamp: Date;
  stashRef: string;
  stashHash: string;
  strategy: "git-stash" | "filesystem";
  fileCount?: number;
  previewText?: string;
}

export interface CheckpointListItem {
  id: string;
  messageId: string;
  timestamp: Date;
  userMessage: string;
  stashRef: string;
  canRestore: boolean;
}

export class CheckpointService {
  /**
   * Send command to VS Code extension via workspace
   */
  private async sendToVSCodeExtension(
    workspaceId: string,
    command: any
  ): Promise<any> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.status !== "RUNNING") {
      throw new Error("Workspace must be running to create checkpoints");
    }

    if (!workspace.agentPort) {
      throw new Error("Workspace port not available");
    }

    // Send command to agent-bridge which forwards to VS Code extension
    const response = await fetch(
      `http://localhost:${workspace.agentPort}/vscode-command`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }
    );

    if (!response.ok) {
      throw new Error(`VS Code command failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a checkpoint before processing a message
   */
  async createCheckpoint(
    workspaceId: string,
    messageId: string,
    previewText?: string
  ): Promise<CheckpointMetadata> {
    console.log(`📸 Creating checkpoint for message ${messageId}`);

    try {
      // Send checkpoint creation command to VS Code extension
      const result = await this.sendToVSCodeExtension(workspaceId, {
        type: "createCheckpoint",
        payload: {
          checkpointId: messageId,
          strategy: "git-stash",
        },
      });

      const metadata: CheckpointMetadata = {
        id: result.checkpointId || messageId,
        messageId,
        workspaceId,
        timestamp: new Date(),
        stashRef: result.stashRef,
        stashHash: result.hash,
        strategy: "git-stash",
        fileCount: result.fileCount,
        previewText,
      };

      // Store checkpoint metadata in message
      await prisma.message.update({
        where: { id: messageId },
        data: {
          checkpointData: JSON.stringify(metadata),
        },
      });

      console.log(`✅ Checkpoint created: ${result.stashRef}`);
      return metadata;
    } catch (error: any) {
      console.error(`❌ Failed to create checkpoint:`, error);
      throw new Error(`Checkpoint creation failed: ${error.message}`);
    }
  }

  /**
   * Restore workspace to a checkpoint
   */
  async restoreCheckpoint(
    workspaceId: string,
    checkpointId: string
  ): Promise<void> {
    console.log(`🔄 Restoring checkpoint ${checkpointId}`);

    try {
      // Validate checkpoint ID format (MongoDB ObjectID is 24 hex characters)
      if (!/^[0-9a-fA-F]{24}$/.test(checkpointId)) {
        throw new Error(
          `Invalid checkpoint ID format: "${checkpointId}". This checkpoint was created with an old version and cannot be restored. Please create a new checkpoint.`
        );
      }

      // Get checkpoint metadata
      const message = await prisma.message.findUnique({
        where: { id: checkpointId },
      });

      if (!message || !message.checkpointData) {
        throw new Error("Checkpoint not found");
      }

      const metadata: CheckpointMetadata = JSON.parse(message.checkpointData);

      // Send restore command to VS Code extension
      await this.sendToVSCodeExtension(workspaceId, {
        type: "restoreCheckpoint",
        payload: {
          checkpointId: metadata.messageId,
          stashRef: metadata.stashRef,
          strategy: metadata.strategy,
        },
      });

      // Delete all messages after this checkpoint
      await prisma.message.deleteMany({
        where: {
          workspaceId,
          createdAt: {
            gt: message.createdAt,
          },
        },
      });

      console.log(`✅ Checkpoint restored successfully`);
    } catch (error: any) {
      console.error(`❌ Failed to restore checkpoint:`, error);
      throw new Error(`Checkpoint restoration failed: ${error.message}`);
    }
  }

  /**
   * List all checkpoints for a workspace
   */
  async listCheckpoints(workspaceId: string): Promise<CheckpointListItem[]> {
    try {
      // Get all messages with checkpoints
      const messages = await prisma.message.findMany({
        where: {
          workspaceId,
          checkpointData: { not: null },
          role: "user", // Only user messages have checkpoints
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const checkpoints: CheckpointListItem[] = messages.map((msg) => {
        const metadata: CheckpointMetadata = JSON.parse(
          msg.checkpointData || "{}"
        );
        const parts = JSON.parse(msg.content);
        const textPart = parts.find((p: any) => p.type === "text");

        return {
          id: msg.id,
          messageId: msg.id,
          timestamp: msg.createdAt,
          userMessage: textPart?.text || "No message",
          stashRef: metadata.stashRef || "",
          canRestore: !!metadata.stashRef,
        };
      });

      return checkpoints;
    } catch (error: any) {
      console.error(`❌ Failed to list checkpoints:`, error);
      throw new Error(`Failed to list checkpoints: ${error.message}`);
    }
  }

  /**
   * Delete old checkpoints (cleanup)
   */
  async pruneCheckpoints(
    workspaceId: string,
    keepLast: number = 50
  ): Promise<number> {
    try {
      // Get all checkpoints
      const messages = await prisma.message.findMany({
        where: {
          workspaceId,
          checkpointData: { not: null },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Keep only the last N checkpoints
      const toDelete = messages.slice(keepLast);

      if (toDelete.length === 0) {
        return 0;
      }

      // Delete checkpoint data from old messages
      await prisma.message.updateMany({
        where: {
          id: {
            in: toDelete.map((m) => m.id),
          },
        },
        data: {
          checkpointData: null,
        },
      });

      console.log(`🗑️  Pruned ${toDelete.length} old checkpoints`);
      return toDelete.length;
    } catch (error: any) {
      console.error(`❌ Failed to prune checkpoints:`, error);
      return 0;
    }
  }

  /**
   * Get checkpoint details
   */
  async getCheckpoint(checkpointId: string): Promise<CheckpointMetadata | null> {
    try {
      const message = await prisma.message.findUnique({
        where: { id: checkpointId },
      });

      if (!message || !message.checkpointData) {
        return null;
      }

      return JSON.parse(message.checkpointData);
    } catch (error) {
      return null;
    }
  }
}

export const checkpointService = new CheckpointService();
