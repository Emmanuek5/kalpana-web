import * as vscode from "vscode";

/**
 * Checkpoints Panel - Shows all checkpoints in a tree view
 * Allows users to view checkpoint details and restore them
 */

export interface CheckpointItem {
  stashIndex: number;
  checkpointId: string;
  ref: string;
  message: string;
  timestamp?: string;
}

/**
 * Format checkpoint diff with a nice header and summary
 */
function formatCheckpointDiff(checkpoint: CheckpointItem, diff: string): string {
  const lines = diff.split('\n');
  const fileChanges = new Map<string, { additions: number; deletions: number }>();
  
  // Parse diff to count changes per file
  let currentFile = '';
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        currentFile = match[1];
        if (!fileChanges.has(currentFile)) {
          fileChanges.set(currentFile, { additions: 0, deletions: 0 });
        }
      }
    } else if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      const stats = fileChanges.get(currentFile)!;
      stats.additions++;
    } else if (currentFile && line.startsWith('-') && !line.startsWith('---')) {
      const stats = fileChanges.get(currentFile)!;
      stats.deletions++;
    }
  }

  // Calculate totals
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const stats of fileChanges.values()) {
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;
  }

  // Build formatted output
  const header = [
    '═'.repeat(80),
    `📸 CHECKPOINT: ${checkpoint.checkpointId}`,
    '═'.repeat(80),
    '',
    `Stash Ref: ${checkpoint.ref}`,
    `Message:   ${checkpoint.message}`,
    checkpoint.timestamp ? `Time:      ${checkpoint.timestamp}` : '',
    '',
    '─'.repeat(80),
    `SUMMARY: ${fileChanges.size} file(s) changed`,
    `  +${totalAdditions} additions, -${totalDeletions} deletions`,
    '─'.repeat(80),
    ''
  ].filter(Boolean).join('\n');

  // Add file summary
  const fileSummary = Array.from(fileChanges.entries())
    .map(([file, stats]) => {
      const bar = '+'.repeat(Math.min(stats.additions, 20)) + 
                  '-'.repeat(Math.min(stats.deletions, 20));
      return `  ${file.padEnd(50)} | +${stats.additions} -${stats.deletions} ${bar}`;
    })
    .join('\n');

  return `${header}\n${fileSummary}\n\n${'═'.repeat(80)}\nDETAILED DIFF\n${'═'.repeat(80)}\n\n${diff}`;
}

export class CheckpointsProvider implements vscode.TreeDataProvider<CheckpointTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CheckpointTreeItem | undefined | null | void> = new vscode.EventEmitter<CheckpointTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CheckpointTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private checkpoints: CheckpointItem[] = [];
  private listCheckpointsCallback: () => Promise<CheckpointItem[]>;

  constructor(listCheckpointsCallback: () => Promise<CheckpointItem[]>) {
    this.listCheckpointsCallback = listCheckpointsCallback;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: CheckpointTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: CheckpointTreeItem): Promise<CheckpointTreeItem[]> {
    if (element) {
      return [];
    }

    try {
      this.checkpoints = await this.listCheckpointsCallback();
      
      if (this.checkpoints.length === 0) {
        return [new CheckpointTreeItem(
          "No checkpoints yet",
          "Send a message to create your first checkpoint",
          vscode.TreeItemCollapsibleState.None,
          null
        )];
      }

      return this.checkpoints.map((checkpoint, index) => {
        const checkpointNumber = this.checkpoints.length - index;
        const label = `#${checkpointNumber}`;
        const description = this.formatCheckpointMessage(checkpoint.message);
        const timestamp = checkpoint.timestamp ? 
          new Date(checkpoint.timestamp).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '';
        
        return new CheckpointTreeItem(
          label,
          description,
          vscode.TreeItemCollapsibleState.None,
          checkpoint,
          timestamp
        );
      });
    } catch (error) {
      console.error("Failed to load checkpoints:", error);
      return [new CheckpointTreeItem(
        "Failed to load checkpoints",
        "Click to retry",
        vscode.TreeItemCollapsibleState.None,
        null
      )];
    }
  }

  private formatCheckpointMessage(message: string): string {
    // Extract checkpoint ID from message
    const match = message.match(/kalpana-checkpoint-([^:]+)/);
    if (match) {
      const checkpointId = match[1];
      // Shorten the ID for display
      return `ID: ${checkpointId.substring(0, 8)}...`;
    }
    return message.substring(0, 50);
  }
}

export class CheckpointTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly checkpoint: CheckpointItem | null,
    public readonly timestamp?: string
  ) {
    super(label, collapsibleState);

    this.description = timestamp ? `${timestamp} • ${description}` : description;
    this.tooltip = checkpoint ? this.createTooltip(checkpoint, timestamp) : description;
    
    if (checkpoint) {
      this.contextValue = "checkpoint";
      this.iconPath = new vscode.ThemeIcon("history");
      
      // Make it clickable
      this.command = {
        command: "kalpana.viewCheckpoint",
        title: "View Checkpoint",
        arguments: [checkpoint]
      };
    } else {
      this.iconPath = new vscode.ThemeIcon("info");
    }
  }

  private createTooltip(checkpoint: CheckpointItem, timestamp?: string): string {
    const parts = [
      `📸 Checkpoint: ${checkpoint.checkpointId.substring(0, 12)}...`,
      `🔖 Stash: ${checkpoint.ref}`,
      timestamp ? `🕐 Time: ${timestamp}` : '',
      '',
      '💡 Click to view detailed diff',
      '🔄 Right-click to restore'
    ].filter(Boolean);
    
    return parts.join('\n');
  }
}

/**
 * Register checkpoints view and commands
 */
export function registerCheckpointsView(
  context: vscode.ExtensionContext,
  listCheckpointsCallback: () => Promise<CheckpointItem[]>,
  getCheckpointDiffCallback: (stashRef: string) => Promise<string>,
  restoreCheckpointCallback: (checkpointId: string, stashRef: string) => Promise<any>
): void {
  // Create tree data provider
  const checkpointsProvider = new CheckpointsProvider(listCheckpointsCallback);

  // Register tree view
  const treeView = vscode.window.createTreeView("kalpanaCheckpoints", {
    treeDataProvider: checkpointsProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(treeView);

  // Command: Refresh checkpoints
  const refreshCommand = vscode.commands.registerCommand(
    "kalpana.refreshCheckpoints",
    () => {
      checkpointsProvider.refresh();
      vscode.window.showInformationMessage("Checkpoints refreshed");
    }
  );
  context.subscriptions.push(refreshCommand);

  // Command: View checkpoint (opens formatted diff in editor)
  const viewCheckpointCommand = vscode.commands.registerCommand(
    "kalpana.viewCheckpoint",
    async (checkpoint: CheckpointItem) => {
      try {
        // Get the diff for this checkpoint
        const diff = await getCheckpointDiffCallback(checkpoint.ref);

        if (!diff || diff.trim().length === 0) {
          vscode.window.showInformationMessage(
            `Checkpoint ${checkpoint.checkpointId.substring(0, 8)} has no changes`
          );
          return;
        }

        // Format the diff with a nice header
        const formattedContent = formatCheckpointDiff(checkpoint, diff);

        // Create a new untitled document with the formatted diff
        const doc = await vscode.workspace.openTextDocument({
          content: formattedContent,
          language: "diff"
        });

        // Show the document in a new editor with custom title
        const editor = await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside
        });

        // Set a custom title for the editor tab
        vscode.window.showInformationMessage(
          `📸 Viewing checkpoint: ${checkpoint.checkpointId.substring(0, 8)}`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to view checkpoint: ${error.message}`
        );
      }
    }
  );
  context.subscriptions.push(viewCheckpointCommand);

  // Command: Restore checkpoint
  const restoreCheckpointCommand = vscode.commands.registerCommand(
    "kalpana.restoreCheckpointFromPanel",
    async (item: CheckpointTreeItem) => {
      if (!item.checkpoint) {
        return;
      }

      const checkpoint = item.checkpoint;
      const answer = await vscode.window.showWarningMessage(
        `Restore to checkpoint ${checkpoint.checkpointId.substring(0, 8)}?\n\nThis will revert all changes after this checkpoint.`,
        { modal: true },
        "Restore",
        "Cancel"
      );

      if (answer !== "Restore") {
        return;
      }

      try {
        await restoreCheckpointCallback(checkpoint.checkpointId, checkpoint.ref);
        checkpointsProvider.refresh();
        vscode.window.showInformationMessage(
          `✅ Restored to checkpoint: ${checkpoint.checkpointId.substring(0, 8)}`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to restore checkpoint: ${error.message}`
        );
      }
    }
  );
  context.subscriptions.push(restoreCheckpointCommand);

  // Auto-refresh every 10 seconds
  const refreshInterval = setInterval(() => {
    checkpointsProvider.refresh();
  }, 10000);

  context.subscriptions.push({
    dispose: () => clearInterval(refreshInterval)
  });

  console.log("✅ Checkpoints panel registered");
}
