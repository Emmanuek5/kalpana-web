import * as vscode from "vscode";
import * as fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { KalpanaInlineCompletionProvider } from "./autocomplete-provider";
import { registerCheckpointsView } from "./checkpoints-panel";
import { generateCommitMessage, getGitRepository } from "./commit-generator";
import { getSelectedCodeContext, formatCodeContext, formatCodeWithInstruction, createWebUIMessageSender } from "./code-context";
import { registerSelectionMenu, setWebUIMessageSender } from "./selection-menu";
import { registerBrowserPanel } from "./browser-panel";
import { LiveShareMonitor } from "./liveshare-monitor";

// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel("Kalpana");

// Log that module is being loaded
outputChannel.appendLine("📦 Kalpana extension module loaded");

const DIAGNOSTICS_FILE = "/tmp/kalpana-diagnostics.json";
const CONFIG_FILE = "/tmp/kalpana-config.json";
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
    | "runInTerminalAndCapture"
    | "getTerminalOutput"
    | "getCodeActions"
    | "applyCodeAction"
    | "goToDefinition"
    | "findReferences"
    | "searchSymbols"
    | "formatDocument"
    | "getHover"
    | "updateAutocompleteConfig"
    | "createCheckpoint"
    | "restoreCheckpoint"
    | "listCheckpoints"
    | "getCheckpointDiff"
    | "startLiveShare"
    | "endLiveShare"
    | "getLiveShareParticipants";
  payload: any;
}

interface VSCodeResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel.appendLine("🚀 Kalpana extension activating...");

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
  const terminalOutputs = new Map<string, { output: string; isRunning: boolean; exitCode?: number }>();

  // ========== Initialize Autocomplete Provider ==========
  const autocompleteProvider = new KalpanaInlineCompletionProvider();
  
  // Register inline completion provider for all languages
  const completionDisposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    autocompleteProvider
  );
  
  context.subscriptions.push(completionDisposable);
  console.log("✅ Autocomplete provider registered");

  // ========== Initialize Live Share Monitor ==========
  const liveShareMonitor = new LiveShareMonitor();

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

        case "runInTerminalAndCapture": {
          const { command: cmd, terminalName = "Kalpana", terminalId, waitForOutput = true, timeout = 5000 } = command.payload;
          
          // Create a new terminal with shell integration for output capture
          const terminal = vscode.window.createTerminal({
            name: terminalName,
            shellArgs: [],
          });
          
          terminals.set(terminalId, terminal);
          terminal.show();
          
          // Initialize output storage
          terminalOutputs.set(terminalId, {
            output: "",
            isRunning: true,
          });
          
          // Send command
          terminal.sendText(cmd);
          
          if (waitForOutput) {
            // Wait for output with timeout
            await new Promise(resolve => setTimeout(resolve, timeout));
            
            const stored = terminalOutputs.get(terminalId);
            return {
              id: command.id,
              success: true,
              data: {
                terminalId,
                terminal: terminalName,
                output: stored?.output || "",
                isRunning: stored?.isRunning ?? false,
                exitCode: stored?.exitCode,
              },
            };
          } else {
            return {
              id: command.id,
              success: true,
              data: {
                terminalId,
                terminal: terminalName,
                isRunning: true,
                output: "",
                message: "Command started in background",
              },
            };
          }
        }

        case "getTerminalOutput": {
          const { terminalId } = command.payload;
          const stored = terminalOutputs.get(terminalId);
          
          if (!stored) {
            return {
              id: command.id,
              success: false,
              error: `Terminal ID "${terminalId}" not found`,
            };
          }
          
          return {
            id: command.id,
            success: true,
            data: {
              terminalId,
              output: stored.output,
              isRunning: stored.isRunning,
              exitCode: stored.exitCode,
            },
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

        case "updateAutocompleteConfig": {
          const { apiKey, model } = command.payload;
          autocompleteProvider.updateApiKey(apiKey, model);
          
          // Also write to config file for persistence
          try {
            fs.writeFileSync(
              CONFIG_FILE,
              JSON.stringify({ openrouterApiKey: apiKey, autocompleteModel: model }, null, 2)
            );
          } catch (error) {
            console.error("Failed to write config:", error);
          }
          
          return {
            id: command.id,
            success: true,
            data: { message: "Autocomplete config updated" },
          };
        }

        case "createCheckpoint": {
          const { checkpointId, strategy } = command.payload;
          const result = await createCheckpoint(checkpointId, strategy);
          return {
            id: command.id,
            success: true,
            data: result,
          };
        }

        case "restoreCheckpoint": {
          const { checkpointId, stashRef, strategy } = command.payload;
          const result = await restoreCheckpoint(checkpointId, stashRef, strategy);
          return {
            id: command.id,
            success: true,
            data: result,
          };
        }

        case "listCheckpoints": {
          const checkpoints = await listCheckpoints();
          return {
            id: command.id,
            success: true,
            data: { checkpoints },
          };
        }

        case "getCheckpointDiff": {
          const { stashRef } = command.payload;
          const diff = await getCheckpointDiff(stashRef);
          return {
            id: command.id,
            success: true,
            data: { diff },
          };
        }

        case "startLiveShare": {
          console.log('🚀 Starting Live Share session...');
          try {
            const shareLink = await liveShareMonitor.startSession();
            return {
              id: command.id,
              success: true,
              data: { shareLink },
            };
          } catch (error: any) {
            return {
              id: command.id,
              success: false,
              error: error.message,
            };
          }
        }

        case "endLiveShare": {
          console.log('🛑 Ending Live Share session...');
          try {
            await liveShareMonitor.endSession();
            return {
              id: command.id,
              success: true,
            };
          } catch (error: any) {
            return {
              id: command.id,
              success: false,
              error: error.message,
            };
          }
        }

        case "getLiveShareParticipants": {
          const participants = liveShareMonitor.getParticipants();
          return {
            id: command.id,
            success: true,
            data: { participants, count: participants.length },
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

  // ========== Checkpoint Functions ==========
  async function execGit(command: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error("No workspace open");

    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`git ${command}`, {
        cwd: workspaceFolders[0].uri.fsPath,
      });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  async function createCheckpoint(
    checkpointId: string,
    strategy: string = "git-stash"
  ): Promise<any> {
    console.log(`📸 Creating checkpoint: ${checkpointId}`);

    try {
      // 1. Stage all changes (including untracked files)
      await execGit("add -A");

      // 2. Create stash with checkpoint name
      const stashMessage = `kalpana-checkpoint-${checkpointId}`;
      await execGit(`stash push -u -m "${stashMessage}"`);

      // 3. Immediately pop it back (so user's work is unchanged)
      await execGit("stash apply stash@{0}");

      // 4. Get stash hash
      const stashHash = await execGit("rev-parse stash@{0}");

      // 5. Count files
      const fileCount = await countWorkspaceFiles();

      console.log(`✅ Checkpoint created: stash@{0} (${stashHash})`);

      return {
        checkpointId,
        stashRef: "stash@{0}",
        hash: stashHash,
        strategy: "git-stash",
        fileCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Checkpoint creation failed:`, error);
      throw new Error(`Failed to create checkpoint: ${error.message}`);
    }
  }

  async function restoreCheckpoint(
    checkpointId: string,
    stashRef: string,
    strategy: string = "git-stash"
  ): Promise<any> {
    console.log(`🔄 Restoring checkpoint: ${checkpointId} (${stashRef})`);

    try {
      // 1. Find the stash by message
      const stashList = await execGit("stash list");
      const stashLine = stashList
        .split("\n")
        .find((line) => line.includes(`kalpana-checkpoint-${checkpointId}`));

      if (!stashLine) {
        throw new Error("Checkpoint not found in stash list");
      }

      // Extract stash reference (e.g., "stash@{3}")
      const match = stashLine.match(/stash@\{(\d+)\}/);
      if (!match) {
        throw new Error("Invalid stash reference");
      }
      const actualStashRef = match[0];

      // 2. Reset to clean state
      await execGit("reset --hard HEAD");
      await execGit("clean -fd");

      // 3. Apply the checkpoint stash
      await execGit(`checkout ${actualStashRef} -- .`);

      // 4. Reload all open editors
      await reloadAllEditors();

      console.log(`✅ Checkpoint restored: ${actualStashRef}`);

      vscode.window.showInformationMessage(
        `✅ Restored to checkpoint: ${checkpointId.substring(0, 8)}`
      );

      return {
        restored: true,
        checkpointId,
        stashRef: actualStashRef,
      };
    } catch (error: any) {
      console.error(`❌ Checkpoint restoration failed:`, error);
      vscode.window.showErrorMessage(
        `Failed to restore checkpoint: ${error.message}`
      );
      throw new Error(`Failed to restore checkpoint: ${error.message}`);
    }
  }

  async function listCheckpoints(): Promise<any[]> {
    try {
      const stashList = await execGit("stash list");
      const checkpoints = stashList
        .split("\n")
        .filter((line) => line.includes("kalpana-checkpoint-"))
        .map((line) => {
          const match = line.match(
            /stash@\{(\d+)\}.*kalpana-checkpoint-([^:]+)/
          );
          if (!match) return null;

          return {
            stashIndex: parseInt(match[1]),
            checkpointId: match[2],
            ref: `stash@{${match[1]}}`,
            message: line,
          };
        })
        .filter((c) => c !== null);

      return checkpoints;
    } catch (error: any) {
      console.error("Failed to list checkpoints:", error);
      return [];
    }
  }

  async function getCheckpointDiff(stashRef: string): Promise<string> {
    try {
      const diff = await execGit(`stash show -p ${stashRef}`);
      return diff;
    } catch (error: any) {
      return "";
    }
  }

  async function reloadAllEditors(): Promise<void> {
    const openEditors = vscode.window.visibleTextEditors;
    for (const editor of openEditors) {
      const uri = editor.document.uri;
      try {
        // Close and reopen to force reload
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
      } catch (error) {
        console.error(`Failed to reload editor for ${uri.fsPath}:`, error);
      }
    }
  }

  async function closeAllEditors(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    } catch (error) {
      console.error('Failed to close all editors:', error);
    }
  }

  const closeEditorsCommand = vscode.commands.registerCommand(
    'kalpana.closeAllEditors',
    async () => {
      await closeAllEditors();
    }
  );

  async function countWorkspaceFiles(): Promise<number> {
    try {
      const files = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**"
      );
      return files.length;
    } catch (error) {
      return 0;
    }
  }

  // ========== Register Checkpoints Panel ==========
  registerCheckpointsView(
    context,
    listCheckpoints,
    getCheckpointDiff,
    restoreCheckpoint
  );

  // ========== Register Mini Browser Panel ==========
  registerBrowserPanel(context);
  outputChannel.appendLine("✅ Mini Browser registered");

  // ========== AI Commit Message Generator ==========
  const generateCommitCmd = vscode.commands.registerCommand(
    'kalpana.generateCommitMessage',
    async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: '✨ Generating commit message...',
            cancellable: false,
          },
          async () => {
            const message = await generateCommitMessage();
            
            // Get git extension and set commit message
            const git = await getGitRepository();
            git.inputBox.value = message;
            
            vscode.window.showInformationMessage('✨ Commit message generated!');
          }
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to generate commit message: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(generateCommitCmd, closeEditorsCommand);

  // ========== Code Selection Context Commands ==========
  // Create WebSocket message sender for code context
  let sendToWebUI: ((message: any) => Promise<void>) | null = null;
  let connectedClients: Set<WebSocket> = new Set();

  // ========== Initialize Live Share Event Broadcasting ==========
  liveShareMonitor.initialize().then((success) => {
    if (success) {
      outputChannel.appendLine('✅ Live Share monitoring enabled');
      
      // Broadcast Live Share events to all connected clients
      liveShareMonitor.onEvent((event) => {
        outputChannel.appendLine(`📡 Broadcasting Live Share event: ${event.type}`);
        connectedClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(event));
          }
        });
      });
    } else {
      outputChannel.appendLine('⚠️ Live Share monitoring not available (extension may not be installed)');
    }
  });

  // Track all connected WebSocket clients
  wss.on('connection', (ws: WebSocket) => {
    connectedClients.add(ws);
    sendToWebUI = createWebUIMessageSender(ws);
    setWebUIMessageSender(sendToWebUI);
    
    outputChannel.appendLine(`📡 WebSocket client connected, total clients: ${connectedClients.size}`);

    ws.on('close', () => {
      connectedClients.delete(ws);
      outputChannel.appendLine(`📡 WebSocket client disconnected, remaining: ${connectedClients.size}`);
      
      // Update sendToWebUI to use another client if available
      if (connectedClients.size > 0) {
        const nextClient = Array.from(connectedClients)[0];
        sendToWebUI = createWebUIMessageSender(nextClient);
        setWebUIMessageSender(sendToWebUI);
      } else {
        sendToWebUI = null;
        setWebUIMessageSender(null);
      }
    });
  });

  // Register selection menu (floating buttons)
  registerSelectionMenu(context, sendToWebUI);

  // Add to chat context
  const addToChatCmd = vscode.commands.registerCommand(
    'kalpana.addToChat',
    async () => {
      const context = getSelectedCodeContext();
      if (!context) {
        vscode.window.showWarningMessage('No code selected');
        return;
      }

      // Get the current sendToWebUI (might have changed)
      if (connectedClients.size === 0) {
        vscode.window.showWarningMessage('Web UI not connected');
        return;
      }

      // Send to all connected clients
      const message = {
        type: 'codeContext',
        action: 'addToChat',
        payload: context,
      };

      outputChannel.appendLine(`📤 Sending to web UI: ${JSON.stringify(message)}`);

      for (const client of connectedClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }

      vscode.window.showInformationMessage('💬 Code added to chat context');
    }
  );

  // Send to agent with instruction
  const sendToAgentCmd = vscode.commands.registerCommand(
    'kalpana.sendToAgent',
    async () => {
      const context = getSelectedCodeContext();
      if (!context) {
        vscode.window.showWarningMessage('No code selected');
        return;
      }

      if (connectedClients.size === 0) {
        vscode.window.showWarningMessage('Web UI not connected');
        return;
      }

      // Show input box for instruction
      const instruction = await vscode.window.showInputBox({
        prompt: 'What should the agent do with this code?',
        placeHolder: 'e.g., Add error handling, Refactor this function, Add tests',
      });

      if (!instruction) {
        return;
      }

      const message = {
        type: 'codeContext',
        action: 'sendToAgent',
        payload: {
          ...context,
          instruction,
        },
      };

      outputChannel.appendLine(`📤 Sending to web UI: ${JSON.stringify(message)}`);

      for (const client of connectedClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }

      vscode.window.showInformationMessage('✨ Sent to Kalpana Agent');
    }
  );

  context.subscriptions.push(addToChatCmd, sendToAgentCmd);

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
