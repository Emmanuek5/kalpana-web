import * as vscode from "vscode";

/**
 * Mini Browser Panel for viewing container ports
 * Allows users to access web apps running inside the container
 */
export class BrowserPanel {
  private static currentPanel: BrowserPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private currentUrl: string = "";
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    // Set initial content
    this.update();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "navigate":
            this.currentUrl = message.url;
            this.update();
            break;
          case "refresh":
            this.update();
            break;
          case "back":
            this.panel.webview.postMessage({ type: "goBack" });
            break;
          case "forward":
            this.panel.webview.postMessage({ type: "goForward" });
            break;
        }
      },
      null,
      this.disposables
    );

    // Clean up when panel is closed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, url?: string) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (BrowserPanel.currentPanel) {
      BrowserPanel.currentPanel.panel.reveal(column);
      if (url) {
        BrowserPanel.currentPanel.navigate(url);
      }
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "kalpanaBrowser",
      "Mini Browser",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    BrowserPanel.currentPanel = new BrowserPanel(panel, extensionUri);
    
    if (url) {
      BrowserPanel.currentPanel.navigate(url);
    }
  }

  public navigate(url: string) {
    this.currentUrl = url;
    this.update();
  }

  private update() {
    this.panel.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
    const defaultUrl = this.currentUrl || "http://localhost:3000";
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini Browser</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .toolbar button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
        }
        
        .toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .toolbar button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .url-bar {
            flex: 1;
            display: flex;
            gap: 4px;
        }
        
        .url-input {
            flex: 1;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            font-size: 13px;
            border-radius: 2px;
        }
        
        .url-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        .browser-container {
            flex: 1;
            position: relative;
            background-color: white;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--vscode-editor-foreground);
        }
        
        .quick-links {
            display: flex;
            gap: 4px;
            padding: 4px 8px;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-wrap: wrap;
        }
        
        .quick-link {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }
        
        .quick-link:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="back" title="Back">←</button>
        <button id="forward" title="Forward">→</button>
        <button id="refresh" title="Refresh">↻</button>
        <div class="url-bar">
            <input 
                type="text" 
                id="urlInput" 
                class="url-input" 
                placeholder="Enter URL (e.g., http://localhost:3000)"
                value="${defaultUrl}"
            />
            <button id="go">Go</button>
        </div>
    </div>
    
    <div class="quick-links">
        <span style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-right: 8px;">Quick Access:</span>
        <button class="quick-link" data-url="http://localhost:3000">:3000</button>
        <button class="quick-link" data-url="http://localhost:3001">:3001</button>
        <button class="quick-link" data-url="http://localhost:4000">:4000</button>
        <button class="quick-link" data-url="http://localhost:5000">:5000</button>
        <button class="quick-link" data-url="http://localhost:5173">:5173 (Vite)</button>
        <button class="quick-link" data-url="http://localhost:8000">:8000</button>
        <button class="quick-link" data-url="http://localhost:8080">:8080</button>
    </div>
    
    <div class="browser-container">
        <iframe id="browserFrame" src="${defaultUrl}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const urlInput = document.getElementById('urlInput');
        const browserFrame = document.getElementById('browserFrame');
        const backBtn = document.getElementById('back');
        const forwardBtn = document.getElementById('forward');
        const refreshBtn = document.getElementById('refresh');
        const goBtn = document.getElementById('go');
        
        // Navigation history
        let history = ['${defaultUrl}'];
        let historyIndex = 0;
        
        function updateButtons() {
            backBtn.disabled = historyIndex <= 0;
            forwardBtn.disabled = historyIndex >= history.length - 1;
        }
        
        function navigate(url) {
            // Ensure URL has protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
            
            browserFrame.src = url;
            urlInput.value = url;
            
            // Add to history
            history = history.slice(0, historyIndex + 1);
            history.push(url);
            historyIndex = history.length - 1;
            updateButtons();
            
            vscode.postMessage({ type: 'navigate', url });
        }
        
        // Go button
        goBtn.addEventListener('click', () => {
            navigate(urlInput.value);
        });
        
        // Enter key in URL bar
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                navigate(urlInput.value);
            }
        });
        
        // Back button
        backBtn.addEventListener('click', () => {
            if (historyIndex > 0) {
                historyIndex--;
                const url = history[historyIndex];
                browserFrame.src = url;
                urlInput.value = url;
                updateButtons();
            }
        });
        
        // Forward button
        forwardBtn.addEventListener('click', () => {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                const url = history[historyIndex];
                browserFrame.src = url;
                urlInput.value = url;
                updateButtons();
            }
        });
        
        // Refresh button
        refreshBtn.addEventListener('click', () => {
            browserFrame.src = browserFrame.src;
        });
        
        // Quick links
        document.querySelectorAll('.quick-link').forEach(link => {
            link.addEventListener('click', () => {
                const url = link.getAttribute('data-url');
                navigate(url);
            });
        });
        
        // Update URL bar when iframe navigates (if possible)
        browserFrame.addEventListener('load', () => {
            try {
                const frameUrl = browserFrame.contentWindow.location.href;
                if (frameUrl && frameUrl !== 'about:blank') {
                    urlInput.value = frameUrl;
                }
            } catch (e) {
                // Cross-origin restriction - can't access iframe URL
            }
        });
        
        updateButtons();
    </script>
</body>
</html>`;
  }

  public dispose() {
    BrowserPanel.currentPanel = undefined;

    // Clean up resources
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

/**
 * Register browser panel commands
 */
export function registerBrowserPanel(context: vscode.ExtensionContext) {
  // Command to open browser
  context.subscriptions.push(
    vscode.commands.registerCommand("kalpana.openBrowser", (url?: string) => {
      BrowserPanel.createOrShow(context.extensionUri, url);
    })
  );

  // Command to open browser with specific port
  context.subscriptions.push(
    vscode.commands.registerCommand("kalpana.openPort", async () => {
      const port = await vscode.window.showInputBox({
        prompt: "Enter port number to open",
        placeHolder: "3000",
        validateInput: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > 65535) {
            return "Please enter a valid port number (1-65535)";
          }
          return null;
        },
      });

      if (port) {
        const url = `http://localhost:${port}`;
        BrowserPanel.createOrShow(context.extensionUri, url);
      }
    })
  );

  // Status bar item for quick browser access
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(globe) Browser";
  statusBarItem.tooltip = "Open Mini Browser";
  statusBarItem.command = "kalpana.openBrowser";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}
