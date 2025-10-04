import * as vscode from 'vscode';

interface FileViewer {
  userId: string;
  userName: string;
  userColor: string;
  filePath: string;
}

export class FileViewerDecorator implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  // Map of file path -> list of viewers
  private fileViewers = new Map<string, FileViewer[]>();

  constructor() {}

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const filePath = uri.fsPath;
    const viewers = this.fileViewers.get(filePath);

    if (!viewers || viewers.length === 0) {
      return undefined;
    }

    // Create dots based on number of viewers
    const dotCount = Math.min(viewers.length, 3); // Max 3 dots
    const dots = '●'.repeat(dotCount);
    
    // Use the first viewer's color for the badge
    const color = new vscode.ThemeColor('charts.blue'); // We'll use a custom color later
    
    return {
      badge: dots,
      tooltip: this.getTooltip(viewers),
      color: undefined, // Color doesn't work well for badges, we'll use the dot itself
    };
  }

  private getTooltip(viewers: FileViewer[]): string {
    if (viewers.length === 1) {
      return `${viewers[0].userName} is viewing this file`;
    } else if (viewers.length === 2) {
      return `${viewers[0].userName} and ${viewers[1].userName} are viewing this file`;
    } else {
      return `${viewers[0].userName}, ${viewers[1].userName}, and ${viewers.length - 2} other${viewers.length > 3 ? 's' : ''} are viewing this file`;
    }
  }

  /**
   * Update the viewers for a specific file
   */
  updateFileViewers(filePath: string, viewers: FileViewer[]) {
    if (viewers.length === 0) {
      this.fileViewers.delete(filePath);
    } else {
      this.fileViewers.set(filePath, viewers);
    }

    // Notify VSCode to update decorations for this file
    const uri = vscode.Uri.file(filePath);
    this._onDidChangeFileDecorations.fire(uri);
  }

  /**
   * Add a viewer to a file
   */
  addViewer(filePath: string, viewer: FileViewer) {
    const viewers = this.fileViewers.get(filePath) || [];
    
    // Check if viewer already exists
    const existingIndex = viewers.findIndex(v => v.userId === viewer.userId);
    if (existingIndex >= 0) {
      // Update existing viewer
      viewers[existingIndex] = viewer;
    } else {
      // Add new viewer
      viewers.push(viewer);
    }

    this.updateFileViewers(filePath, viewers);
  }

  /**
   * Remove a viewer from a file
   */
  removeViewer(filePath: string, userId: string) {
    const viewers = this.fileViewers.get(filePath) || [];
    const filtered = viewers.filter(v => v.userId !== userId);
    this.updateFileViewers(filePath, filtered);
  }

  /**
   * Remove a user from all files
   */
  removeUserFromAllFiles(userId: string) {
    const updatedFiles: string[] = [];
    
    for (const [filePath, viewers] of this.fileViewers.entries()) {
      const filtered = viewers.filter(v => v.userId !== userId);
      if (filtered.length !== viewers.length) {
        this.fileViewers.set(filePath, filtered);
        updatedFiles.push(filePath);
      }
    }

    // Fire update for all affected files
    if (updatedFiles.length > 0) {
      const uris = updatedFiles.map(path => vscode.Uri.file(path));
      this._onDidChangeFileDecorations.fire(uris);
    }
  }

  /**
   * Clear all viewers
   */
  clearAllViewers() {
    const allFiles = Array.from(this.fileViewers.keys());
    this.fileViewers.clear();
    
    if (allFiles.length > 0) {
      const uris = allFiles.map(path => vscode.Uri.file(path));
      this._onDidChangeFileDecorations.fire(uris);
    }
  }

  /**
   * Get all viewers for a file
   */
  getViewers(filePath: string): FileViewer[] {
    return this.fileViewers.get(filePath) || [];
  }

  /**
   * Get all files being viewed
   */
  getAllViewedFiles(): Map<string, FileViewer[]> {
    return new Map(this.fileViewers);
  }
}
