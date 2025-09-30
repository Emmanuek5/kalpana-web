import * as vscode from "vscode";
import * as fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

// Log that module is being loaded
console.log("📦 Kalpana extension module loaded");

const DIAGNOSTICS_FILE = "/tmp/kalpana-diagnostics.json";
const UPDATE_INTERVAL = 2000;
const WS_PORT = 3002; // Extension WebSocket server port

interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
  code?: string | number;
}

interface VSCodeCommand {
  id: string;
  type:
    | "openFile"
    | "runInTerminal"
    | "getCodeActions"
    | "applyCodeAction"
    | "goToDefinition"
    | "findReferences"
    | "searchSymbols"
    | "formatDocument"
    | "getHover";
  payload: any;
}

interface VSCodeResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("🎯 Kalpana VS Code Extension activated!");

  // Write activation to a file so we can verify it ran
  try {
    fs.writeFileSync(
      "/tmp/kalpana-extension-activated.log",
      `Activated at ${new Date().toISOString()}\n`,
      { flag: "a" }
    );
  } catch (e) {
    // Ignore file write errors
  }

  let updateTimer: NodeJS.Timeout | undefined;
  const terminals = new Map<string, vscode.Terminal>();

  // ========== WebSocket Server for Direct Communication ==========
  let wss: WebSocketServer;
  try {
    wss = new WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });
    console.log(
      `🚀 Kalpana VS Code Extension WebSocket server listening on port ${WS_PORT}`
    );
    fs.writeFileSync(
      "/tmp/kalpana-extension-activated.log",
      `WebSocket server started on port ${WS_PORT} at ${new Date().toISOString()}\n`,
      { flag: "a" }
    );
  } catch (error: any) {
    const errorMsg = `Failed to start WebSocket server on port ${WS_PORT}: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    fs.writeFileSync(
      "/tmp/kalpana-extension-activated.log",
      `ERROR: ${errorMsg}\n`,
      { flag: "a" }
    );
    vscode.window.showErrorMessage(`Kalpana: ${errorMsg}`);
    throw error;
  }

  wss.on("connection", (ws: WebSocket) => {
    console.log("✅ Agent bridge connected to VS Code extension");

    ws.on("message", async (data: Buffer) => {
      try {
        const command: VSCodeCommand = JSON.parse(data.toString());
        const response = await handleCommand(command);
        ws.send(JSON.stringify(response));
      } catch (error: any) {
        console.error("Error handling command:", error);
        ws.send(
          JSON.stringify({
            id: "error",
            success: false,
            error: error.message,
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("❌ Agent bridge disconnected from VS Code extension");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  // Handler for all commands
  async function handleCommand(
    command: VSCodeCommand
  ): Promise<VSCodeResponse> {
    try {
      switch (command.type) {
        case "openFile": {
          const { filePath, line } = command.payload;
          await openFile(filePath, line);
          return {
            id: command.id,
            success: true,
            data: { message: `Opened ${filePath}${line ? `:${line}` : ""}` },
          };
        }

        case "runInTerminal": {
          const { command: cmd, terminalName = "Kalpana" } = command.payload;
          let terminal = terminals.get(terminalName);
          if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
            terminals.set(terminalName, terminal);
          }
          terminal.show();
          terminal.sendText(cmd);
          return {
            id: command.id,
            success: true,
            data: { terminal: terminalName, command: cmd },
          };
        }

        case "getCodeActions": {
          const { filePath, line } = command.payload;
          const actions = await getCodeActions(filePath, line);
          return {
            id: command.id,
            success: true,
            data: actions,
          };
        }

        case "applyCodeAction": {
          const { actionId } = command.payload;
          const result = await applyCodeAction(actionId);
          return {
            id: command.id,
            success: true,
            data: result,
          };
        }

        case "goToDefinition": {
          const { filePath, line, character } = command.payload;
          const definitions = await goToDefinition(filePath, line, character);
          return {
            id: command.id,
            success: true,
            data: definitions,
          };
        }

        case "findReferences": {
          const { filePath, line, character } = command.payload;
          const references = await findReferences(filePath, line, character);
          return {
            id: command.id,
            success: true,
            data: references,
          };
        }

        case "searchSymbols": {
          const { query } = command.payload;
          const symbols = await searchSymbols(query);
          return {
            id: command.id,
            success: true,
            data: symbols,
          };
        }

        case "formatDocument": {
          const { filePath } = command.payload;
          const result = await formatDocument(filePath);
          return {
            id: command.id,
            success: true,
            data: result,
          };
        }

        case "getHover": {
          const { filePath, line, character } = command.payload;
          const hover = await getHover(filePath, line, character);
          return {
            id: command.id,
            success: true,
            data: hover,
          };
        }

        default:
          return {
            id: command.id,
            success: false,
            error: `Unknown command type: ${(command as any).type}`,
          };
      }
    } catch (error: any) {
      return {
        id: command.id,
        success: false,
        error: error.message,
      };
    }
  }

  // ========== Command Implementations ==========
  async function openFile(filePath: string, line?: number) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder open");
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const fileUri = vscode.Uri.joinPath(workspaceRoot, filePath);

    try {
      await vscode.workspace.fs.stat(fileUri);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    if (line && line > 0) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }

  async function getCodeActions(filePath: string, line: number) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
    await vscode.workspace.openTextDocument(fileUri);
    const position = new vscode.Position(line - 1, 0);
    const range = new vscode.Range(position, position);

    const codeActions =
      (await vscode.commands.executeCommand<vscode.CodeAction[]>(
        "vscode.executeCodeActionProvider",
        fileUri,
        range
      )) || [];

    const actions = codeActions.map((action, idx) => ({
      id: idx,
      title: action.title,
      kind: action.kind?.value || "unknown",
      isPreferred: action.isPreferred || false,
    }));

    // Store full actions for later use
    const serializedActions = codeActions.map((a) => {
      const changes: Record<string, any[]> = {};
      if (a.edit) {
        a.edit.entries().forEach(([uri, edits]) => {
          changes[uri.toString()] = edits.map((e) => ({
            range: {
              start: {
                line: e.range.start.line,
                character: e.range.start.character,
              },
              end: {
                line: e.range.end.line,
                character: e.range.end.character,
              },
            },
            newText: e.newText,
          }));
        });
      }
      return {
        title: a.title,
        kind: a.kind?.value,
        isPreferred: a.isPreferred,
        edit: Object.keys(changes).length > 0 ? { changes } : undefined,
        command: a.command,
      };
    });

    fs.writeFileSync(
      "/tmp/kalpana-code-actions-full.json",
      JSON.stringify(serializedActions)
    );

    return { actions };
  }

  async function applyCodeAction(actionId: number) {
    const actionsData = fs.readFileSync(
      "/tmp/kalpana-code-actions-full.json",
      "utf-8"
    );
    const actions = JSON.parse(actionsData);

    if (!actions[actionId]) {
      throw new Error("Invalid action ID");
    }

    const action = actions[actionId];

    if (action.edit && action.edit.changes) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      for (const [uriString, edits] of Object.entries(action.edit.changes) as [
        string,
        any[]
      ][]) {
        const uri = vscode.Uri.parse(uriString);
        for (const edit of edits) {
          const range = new vscode.Range(
            edit.range.start.line,
            edit.range.start.character,
            edit.range.end.line,
            edit.range.end.character
          );
          workspaceEdit.replace(uri, range, edit.newText);
        }
      }
      await vscode.workspace.applyEdit(workspaceEdit);
    }

    if (action.command) {
      await vscode.commands.executeCommand(
        action.command.command,
        ...(action.command.arguments || [])
      );
    }

    return { applied: action.title };
  }

  async function goToDefinition(
    filePath: string,
    line: number,
    character: number
  ) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
    const position = new vscode.Position(line - 1, character);

    const locations =
      (await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        fileUri,
        position
      )) || [];

    const definitions = locations.map((loc) => ({
      file: vscode.workspace.asRelativePath(loc.uri),
      line: loc.range.start.line + 1,
      character: loc.range.start.character,
    }));

    return { definitions };
  }

  async function findReferences(
    filePath: string,
    line: number,
    character: number
  ) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
    const position = new vscode.Position(line - 1, character);

    const locations =
      (await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeReferenceProvider",
        fileUri,
        position
      )) || [];

    const references = locations.map((loc) => ({
      file: vscode.workspace.asRelativePath(loc.uri),
      line: loc.range.start.line + 1,
      character: loc.range.start.character,
    }));

    return { count: references.length, references };
  }

  async function searchSymbols(query: string) {
    const symbols =
      (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query
      )) || [];

    const results = symbols.slice(0, 50).map((sym) => ({
      name: sym.name,
      kind: vscode.SymbolKind[sym.kind],
      file: vscode.workspace.asRelativePath(sym.location.uri),
      line: sym.location.range.start.line + 1,
      containerName: sym.containerName,
    }));

    return { count: results.length, symbols: results };
  }

  async function formatDocument(filePath: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
    const document = await vscode.workspace.openTextDocument(fileUri);

    const edits =
      (await vscode.commands.executeCommand<vscode.TextEdit[]>(
        "vscode.executeFormatDocumentProvider",
        fileUri,
        { insertSpaces: true, tabSize: 2 }
      )) || [];

    if (edits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      edits.forEach((edit) =>
        workspaceEdit.replace(fileUri, edit.range, edit.newText)
      );
      await vscode.workspace.applyEdit(workspaceEdit);
      await document.save();
    }

    return {
      message: `Formatted ${filePath}`,
      editsApplied: edits.length,
    };
  }

  async function getHover(filePath: string, line: number, character: number) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
    const position = new vscode.Position(line - 1, character);

    const hovers =
      (await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        fileUri,
        position
      )) || [];

    const hoverInfo = hovers.map((hover) => ({
      contents: hover.contents
        .map((c) => (typeof c === "string" ? c : "value" in c ? c.value : ""))
        .join("\n"),
    }));

    return { hover: hoverInfo[0] || null };
  }

  // ========== Diagnostics Collection (still write to file for compatibility) ==========
  function collectDiagnostics(): DiagnosticInfo[] {
    const diagnostics: DiagnosticInfo[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return diagnostics;
    }

    vscode.languages.getDiagnostics().forEach(([uri, fileDiagnostics]) => {
      const relativeFilePath = vscode.workspace.asRelativePath(uri, false);

      fileDiagnostics.forEach((diag) => {
        let severity: "error" | "warning" | "info" | "hint";
        switch (diag.severity) {
          case vscode.DiagnosticSeverity.Error:
            severity = "error";
            break;
          case vscode.DiagnosticSeverity.Warning:
            severity = "warning";
            break;
          case vscode.DiagnosticSeverity.Information:
            severity = "info";
            break;
          case vscode.DiagnosticSeverity.Hint:
            severity = "hint";
            break;
          default:
            severity = "info";
        }

        diagnostics.push({
          file: relativeFilePath,
          line: diag.range.start.line + 1,
          column: diag.range.start.character + 1,
          severity,
          message: diag.message,
          source: diag.source,
          code:
            typeof diag.code === "object" && diag.code !== null
              ? (diag.code as any).value
              : diag.code,
        });
      });
    });

    return diagnostics;
  }

  function updateDiagnosticsFile() {
    try {
      const diagnostics = collectDiagnostics();
      const data = JSON.stringify(
        {
          timestamp: Date.now(),
          count: diagnostics.length,
          diagnostics,
        },
        null,
        2
      );

      fs.writeFileSync(DIAGNOSTICS_FILE, data, "utf-8");
    } catch (error) {
      console.error("Error updating diagnostics file:", error);
    }
  }

  updateDiagnosticsFile();
  updateTimer = setInterval(updateDiagnosticsFile, UPDATE_INTERVAL);

  const diagnosticListener = vscode.languages.onDidChangeDiagnostics(() => {
    updateDiagnosticsFile();
  });

  context.subscriptions.push(diagnosticListener);

  // Cleanup
  context.subscriptions.push({
    dispose: () => {
      if (updateTimer) {
        clearInterval(updateTimer);
      }
      wss.close();
      try {
        if (fs.existsSync(DIAGNOSTICS_FILE)) {
          fs.unlinkSync(DIAGNOSTICS_FILE);
        }
      } catch (error) {
        console.error("Error cleaning up:", error);
      }
    },
  });
}

export function deactivate() {
  console.log("Kalpana Diagnostics Bridge deactivated");
  if (fs.existsSync(DIAGNOSTICS_FILE)) {
    fs.unlinkSync(DIAGNOSTICS_FILE);
  }
}
