import * as vscode from 'vscode';
import { getSelectedCodeContext } from './code-context';

/**
 * Selection Menu - Shows floating action buttons when code is selected
 * Similar to Cursor/Windsurf inline code actions
 * 
 * This shows:
 * 1. Status bar buttons (bottom bar) - always visible when text selected
 * 2. Context menu items (right-click menu) - "Kalpana: Add to Chat" and "Kalpana: Send to Agent"
 * 3. Quick pick menu (Ctrl+Shift+P or right-click) for quick access
 * 4. CodeLens buttons above the selection line for quick inline access
 */

let sendToWebUI: ((message: any) => Promise<void>) | null = null;

let currentSelection: {
  uri: vscode.Uri;
  range: vscode.Range;
} | null = null;

const codeLensEmitter = new vscode.EventEmitter<void>();

const selectionDocumentSelectors: vscode.DocumentSelector = [
  { pattern: '**/*' },
  { scheme: 'file' },
  { scheme: 'untitled' },
  { scheme: 'vscode-remote' },
  { scheme: 'vscode-vfs' },
  { scheme: 'vscode-test' },
];

const selectionCodeLensProvider: vscode.CodeLensProvider = {
  onDidChangeCodeLenses: codeLensEmitter.event,
  provideCodeLenses(document: vscode.TextDocument) {
    if (!currentSelection) {
      return [];
    }

    if (document.uri.toString() !== currentSelection.uri.toString()) {
      return [];
    }

    const line = currentSelection.range.start.line;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));

    return [
      new vscode.CodeLens(range, {
        title: '$(sparkle) Send to Chat',
        command: 'kalpana.addToChat',
        tooltip: 'Send selected code to Kalpana chat',
      }),
      new vscode.CodeLens(range, {
        title: '$(wand) Send to Agent',
        command: 'kalpana.sendToAgent',
        tooltip: 'Send selected code to Kalpana agent for editing',
      }),
    ];
  },
};

export function registerSelectionMenu(
  context: vscode.ExtensionContext,
  webUIMessageSender: ((message: any) => Promise<void>) | null
) {
  sendToWebUI = webUIMessageSender;

  // Create status bar items that appear when text is selected
  // Made them more compact and prominent with better alignment
  const chatButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1001  // Slightly higher priority for better ordering
  );
  chatButton.text = "$(sparkle) Chat";
  chatButton.tooltip = "Add selected code to Kalpana chat";
  chatButton.command = "kalpana.addToChat";
  chatButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
  chatButton.color = new vscode.ThemeColor('statusBarItem.prominentForeground');

  const editButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  editButton.text = "$(wand) Agent";
  editButton.tooltip = "Send selected code to Kalpana agent";
  editButton.command = "kalpana.sendToAgent";
  editButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
  editButton.color = new vscode.ThemeColor('statusBarItem.prominentForeground');

  const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
    const editor = event.textEditor;
    const selection = editor.selection;

    if (!selection.isEmpty) {
      chatButton.show();
      editButton.show();
      currentSelection = {
        uri: editor.document.uri,
        range: selection,
      };
      // Trigger CodeLens refresh
      codeLensEmitter.fire();
    } else {
      chatButton.hide();
      editButton.hide();
      currentSelection = null;
      // Clear CodeLenses
      codeLensEmitter.fire();
    }
  });

  // Register CodeLens provider for inline actions above the selection
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    selectionDocumentSelectors,
    selectionCodeLensProvider
  );

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
          label: '$(sparkle) Add to Chat',
          description: 'Add selected code to chat context',
          detail: `$(file-code) ${context.filePath}:${context.lineStart + 1}-${context.lineEnd + 1}`,
        },
        {
          label: '$(wand) Send to Agent',
          description: 'Send to agent for editing/refactoring',
          detail: `$(file-code) ${context.filePath}:${context.lineStart + 1}-${context.lineEnd + 1}`,
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'What would you like to do with the selected code?',
        ignoreFocusOut: true,
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

  // Optional: Register context menu items for right-click on selection
  // (Assuming these are handled in a separate registration, but can be added here if needed)
  // vscode.commands.registerCommand('kalpana.addToChat', ...); // Handled elsewhere

  // Initialize current selection for active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && !activeEditor.selection.isEmpty) {
    currentSelection = {
      uri: activeEditor.document.uri,
      range: activeEditor.selection,
    };
    chatButton.show();
    editButton.show();
    codeLensEmitter.fire();
  }

  context.subscriptions.push(
    chatButton,
    editButton,
    showSelectionMenu,
    selectionChangeDisposable,
    codeLensDisposable,
    codeLensEmitter
  );
}

export function setWebUIMessageSender(sender: ((message: any) => Promise<void>) | null) {
  sendToWebUI = sender;
}