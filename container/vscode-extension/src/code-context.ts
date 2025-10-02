import * as vscode from 'vscode';

export interface CodeContext {
  code: string;
  filePath: string;
  language: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Get the currently selected code with context information
 */
export function getSelectedCodeContext(): CodeContext | null {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor || editor.selection.isEmpty) {
    return null;
  }

  const selection = editor.selection;
  const code = editor.document.getText(selection);
  const filePath = vscode.workspace.asRelativePath(editor.document.uri);
  const language = editor.document.languageId;

  return {
    code,
    filePath,
    language,
    lineStart: selection.start.line + 1,
    lineEnd: selection.end.line + 1,
  };
}

/**
 * Format code context as @filepath:LNstart-LNend reference for chat
 * The agent will use readFileLines tool to fetch the actual code
 */
export function formatCodeContext(context: CodeContext): string {
  return `@${context.filePath}:${context.lineStart}-${context.lineEnd}\n\n`;
}

/**
 * Format code context with instruction for agent using @filepath:LNstart-LNend reference
 * The agent will use readFileLines tool to fetch the actual code
 */
export function formatCodeWithInstruction(context: CodeContext, instruction: string): string {
  return `${instruction}\n\n@${context.filePath}:${context.lineStart}-${context.lineEnd}`;
}

/**
 * Send message to web UI via WebSocket
 * This will be called by the extension with the WebSocket client
 */
export function createWebUIMessageSender(wsClient: any) {
  return async (message: any): Promise<void> => {
    try {
      if (!wsClient || wsClient.readyState !== 1) { // 1 = OPEN
        return;
      }

      const payload = {
        ...message,
        timestamp: Date.now(),
      };

      wsClient.send(JSON.stringify(payload));
    } catch (error) {
      // Silently fail - logging handled by caller
    }
  };
}
