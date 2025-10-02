import * as vscode from 'vscode';
import { getSelectedCodeContext, createWebUIMessageSender } from './code-context';

/**
 * Selection Menu - Shows floating action buttons when code is selected
 * Similar to Cursor/Windsurf inline code actions
 * 
 * This shows:
 * 1. Status bar buttons (bottom bar) - always visible when text selected
 * 2. Context menu items (right-click menu) - "Kalpana: Add to Chat" and "Kalpana: Send to Agent"
 * 3. Quick pick menu (Ctrl+Shift+P or right-click) for quick access
 */

let sendToWebUI: ((message: any) => Promise<void>) | null = null;

export function registerSelectionMenu(
  context: vscode.ExtensionContext,
  webUIMessageSender: ((message: any) => Promise<void>) | null
) {
  sendToWebUI = webUIMessageSender;

  // Create status bar items that appear when text is selected
  const chatButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  chatButton.text = "$(comment) Add to Chat";
  chatButton.tooltip = "Add selected code to Kalpana chat";
  chatButton.command = "kalpana.addToChat";
  chatButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

  const editButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    999
  );
  editButton.text = "$(edit) Send to Agent";
  editButton.tooltip = "Send selected code to Kalpana agent";
  editButton.command = "kalpana.sendToAgent";
  editButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

  // Show/hide buttons based on selection
  vscode.window.onDidChangeTextEditorSelection((event) => {
    const editor = event.textEditor;
    const selection = editor.selection;

    if (!selection.isEmpty) {
      // Show status bar buttons when text is selected
      chatButton.show();
      editButton.show();
    } else {
      // Hide buttons when no selection
      chatButton.hide();
      editButton.hide();
    }
  });

  // Hide on editor change
  vscode.window.onDidChangeActiveTextEditor(() => {
    chatButton.hide();
    editButton.hide();
  });

  // Register a command to show quick pick menu for selected code
  const showSelectionMenu = vscode.commands.registerCommand(
    'kalpana.showSelectionMenu',
    async () => {
      const context = getSelectedCodeContext();
      if (!context) {
        vscode.window.showWarningMessage('No code selected');
        return;
      }

      const items: vscode.QuickPickItem[] = [
        {
          label: '$(comment) Add to Chat',
          description: 'Add selected code to chat context',
          detail: `${context.filePath}:${context.lineStart}-${context.lineEnd}`
        },
        {
          label: '$(edit) Send to Agent',
          description: 'Send to agent for editing',
          detail: `${context.filePath}:${context.lineStart}-${context.lineEnd}`
        }
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'What would you like to do with the selected code?'
      });

      if (selected) {
        if (selected.label.includes('Chat')) {
          vscode.commands.executeCommand('kalpana.addToChat');
        } else {
          vscode.commands.executeCommand('kalpana.sendToAgent');
        }
      }
    }
  );

  context.subscriptions.push(chatButton, editButton, showSelectionMenu);
}

export function setWebUIMessageSender(sender: ((message: any) => Promise<void>) | null) {
  sendToWebUI = sender;
}
