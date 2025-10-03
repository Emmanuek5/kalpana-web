import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, readdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);
const WORKSPACE_ROOT = "/workspace";

/**
 * Sanitize and validate file paths to prevent traversal
 */
function sanitizePath(filePath: string): string {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(WORKSPACE_ROOT, normalized);

  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("Path traversal detected - access denied");
  }

  return resolved;
}

/**
 * Track file edits for reporting
 */
interface FileEdit {
  path: string;
  operation: "created" | "modified" | "deleted";
  timestamp: string;
  originalContent?: string;
  newContent?: string;
  diff?: string;
}

let filesEdited: FileEdit[] = [];
let fileEditCallback: ((edit: FileEdit) => void) | null = null;

/**
 * Set callback for file edit events
 */
export function setFileEditCallback(callback: (edit: FileEdit) => void) {
  fileEditCallback = callback;
}

/**
 * Get all edited files
 */
export function getEditedFiles(): FileEdit[] {
  return filesEdited;
}

/**
 * Clear edited files tracking
 */
export function clearEditedFiles(): void {
  filesEdited = [];
  fileEditCallback = null;
}

/**
 * Generate a simple diff between two strings (optimized to show only changes with context)
 */
function generateDiff(original: string, updated: string): string {
  const originalLines = original.split("\n");
  const updatedLines = updated.split("\n");

  // Find changed lines
  const changes: number[] = [];
  const maxLines = Math.max(originalLines.length, updatedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const updLine = updatedLines[i];

    if (origLine !== updLine) {
      changes.push(i);
    }
  }

  // If no changes, return simple message
  if (changes.length === 0) {
    return "No changes";
  }

  // Build diff with context (3 lines before/after changes)
  const CONTEXT_LINES = 3;
  const diff: string[] = [];
  const includedLines = new Set<number>();

  // Mark lines to include (changes + context)
  changes.forEach(lineNum => {
    for (let i = Math.max(0, lineNum - CONTEXT_LINES); 
         i <= Math.min(maxLines - 1, lineNum + CONTEXT_LINES); 
         i++) {
      includedLines.add(i);
    }
  });

  // Generate diff output
  const sortedLines = Array.from(includedLines).sort((a, b) => a - b);
  let lastLine = -10;

  sortedLines.forEach(i => {
    // Add separator if there's a gap
    if (i > lastLine + 1) {
      diff.push("...");
    }

    const origLine = originalLines[i];
    const updLine = updatedLines[i];

    if (origLine === undefined) {
      diff.push(`+ ${updLine}`);
    } else if (updLine === undefined) {
      diff.push(`- ${origLine}`);
    } else if (origLine !== updLine) {
      diff.push(`- ${origLine}`);
      diff.push(`+ ${updLine}`);
    } else {
      diff.push(`  ${origLine}`);
    }

    lastLine = i;
  });

  return diff.join("\n");
}

/**
 * File System Tools
 */
export const read_file = tool({
  description: "Read the contents of a file in the workspace",
  inputSchema: z.object({
    path: z.string().describe("Path to the file relative to workspace root"),
  }),
  execute: async ({ path: filePath }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] read_file: ${fullPath}`);

    if (!existsSync(fullPath)) {
      return { error: "File not found" };
    }

    const content = await readFile(fullPath, "utf-8");
    return { content };
  },
});

export const read_file_lines = tool({
  description: "Read specific lines from a file. Useful when you have a file reference like @filepath:10-20 and need to see the actual code.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file relative to workspace root"),
    startLine: z.number().describe("Starting line number (1-indexed)"),
    endLine: z.number().describe("Ending line number (1-indexed)"),
  }),
  execute: async ({ path: filePath, startLine, endLine }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] read_file_lines: ${fullPath}:${startLine}-${endLine}`);

    if (!existsSync(fullPath)) {
      return { error: "File not found" };
    }

    const content = await readFile(fullPath, "utf-8");
    const lines = content.split('\n');
    
    // Validate line numbers
    if (startLine < 1 || endLine < 1) {
      return { 
        error: "Line numbers must be >= 1",
      };
    }
    
    if (startLine > endLine) {
      return { 
        error: "Start line must be <= end line",
      };
    }
    
    // Extract the requested lines (convert to 0-indexed)
    const selectedLines = lines.slice(startLine - 1, endLine);
    const selectedContent = selectedLines.join('\n');
    
    return { 
      content: selectedContent,
      path: filePath,
      startLine,
      endLine,
      totalLines: lines.length,
    };
  },
});

export const write_file = tool({
  description:
    "Write content to a file in the workspace. Creates parent directories if needed.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file relative to workspace root"),
    content: z.string().describe("Content to write to the file"),
  }),
  execute: async ({ path: filePath, content }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] write_file: ${fullPath}`);

    const existed = existsSync(fullPath);

    // Read original content if file exists
    let originalContent = "";
    if (existed) {
      try {
        originalContent = await readFile(fullPath, "utf-8");
      } catch (e) {
        originalContent = "";
      }
    }

    // Create directory if needed
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      await execAsync(`mkdir -p "${dir}"`);
    }

    await writeFile(fullPath, content, "utf-8");

    // Generate diff
    const diff = existed
      ? generateDiff(originalContent, content)
      : `+ ${content}`;

    const fileEdit: FileEdit = {
      path: filePath,
      operation: (existed ? "modified" : "created") as "created" | "modified",
      timestamp: new Date().toISOString(),
      originalContent: existed ? originalContent : "",
      newContent: content,
      diff,
    };

    filesEdited.push(fileEdit);

    // Emit file edit event in real-time
    console.log(`[write_file] File edit tracked: ${fileEdit.path} (${fileEdit.operation})`);
    console.log(`[write_file] Callback exists: ${!!fileEditCallback}`);
    if (fileEditCallback) {
      console.log(`[write_file] Calling fileEditCallback...`);
      fileEditCallback(fileEdit);
      console.log(`[write_file] fileEditCallback called successfully`);
    } else {
      console.warn(`[write_file] ⚠️ fileEditCallback is null! File edit will not be emitted.`);
    }

    return { success: true, operation: existed ? "modified" : "created" };
  },
});

export const list_directory = tool({
  description: "List files and directories in a directory",
  inputSchema: z.object({
    path: z
      .string()
      .describe("Path to the directory relative to workspace root")
      .default("."),
  }),
  execute: async ({ path: dirPath }) => {
    const fullPath = sanitizePath(dirPath || ".");
    console.log(`[Tool] list_directory: ${fullPath}`);

    if (!existsSync(fullPath)) {
      return { error: "Directory not found" };
    }

    const entries = await readdir(fullPath, { withFileTypes: true });
    return {
      entries: entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      })),
    };
  },
});

/**
 * Search Tools
 */
export const search_files = tool({
  description: "Search for text in files using ripgrep (fast regex search)",
  inputSchema: z.object({
    query: z.string().describe("Text or regex pattern to search for"),
    filePattern: z
      .string()
      .optional()
      .describe("File pattern to search (e.g., '*.ts', '*.js')"),
    caseSensitive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether search should be case sensitive"),
  }),
  execute: async ({ query, filePattern, caseSensitive }) => {
    console.log(`[Tool] search_files: ${query}`);

    try {
      const pattern = filePattern ? `-g "${filePattern}"` : "";
      const caseFlag = caseSensitive ? "" : "-i";
      const { stdout } = await execAsync(
        `rg ${caseFlag} "${query}" ${pattern} --json || true`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 5, // 5MB
        }
      );

      // Parse ripgrep JSON output
      const matches = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            const result = JSON.parse(line);
            if (result.type === "match") {
              return {
                file: result.data.path.text,
                line: result.data.line_number,
                content: result.data.lines.text.trim(),
              };
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((m) => m !== null);

      return { matches, count: matches.length };
    } catch (error: any) {
      return { error: error.message, matches: [], count: 0 };
    }
  },
});

/**
 * Command Execution Tools
 */

// Track running terminal commands
const terminalOutputs = new Map<string, { output: string; isRunning: boolean; startTime: number }>();

export const run_command = tool({
  description:
    "Run a shell command in the VS Code integrated terminal and get immediate output. For quick commands (<5s), returns output directly. For long-running commands, returns a terminalId to fetch output later using get_terminal_output.",
  inputSchema: z.object({
    command: z.string().describe("Command to run"),
    terminalName: z.string().optional().describe("Name of the terminal (defaults to 'Kalpana Agent')"),
    waitForOutput: z.boolean().optional().default(true).describe("Wait for command to complete (default: true). Set false for long-running commands."),
    timeout: z.number().optional().default(5000).describe("Timeout in milliseconds to wait for output (default: 5000ms)"),
  }),
  execute: async ({ command, terminalName, waitForOutput, timeout }) => {
    console.log(`[Tool] run_command: ${command}`);

    // Security: Whitelist allowed commands
    const allowedCommands = [
      "ls",
      "cat",
      "echo",
      "pwd",
      "cd",
      "git",
      "npm",
      "bun",
      "pnpm",
      "yarn",
      "python",
      "python3",
      "node",
      "rustc",
      "cargo",
      "go",
      "make",
      "mkdir",
      "touch",
      "rm",
      "cp",
      "mv",
      "grep",
      "find",
      "test",
      "jest",
      "vitest",
    ];

    const cmdName = command.trim().split(" ")[0];
    if (!allowedCommands.includes(cmdName)) {
      return {
        error: `Command not allowed: ${cmdName}. Allowed: ${allowedCommands.join(
          ", "
        )}`,
      };
    }

    const terminalLabel = terminalName || "Kalpana Agent";
    const terminalId = `${terminalLabel}-${Date.now()}`;

    // Try to run in VS Code terminal first and get output
    try {
      const response = await fetch("http://localhost:3001/vscode-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "runInTerminalAndCapture",
          payload: { 
            command, 
            terminalName: terminalLabel,
            terminalId,
            waitForOutput,
            timeout 
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Store terminal info for later retrieval
        terminalOutputs.set(terminalId, {
          output: result.output || "",
          isRunning: result.isRunning || false,
          startTime: Date.now(),
        });

        if (result.isRunning) {
          return {
            success: true,
            terminalId,
            terminal: terminalLabel,
            isRunning: true,
            partialOutput: result.output || "",
            message: `Command "${command}" is running in terminal. Use get_terminal_output with terminalId "${terminalId}" to fetch output.`,
          };
        } else {
          return {
            success: true,
            terminalId,
            terminal: terminalLabel,
            output: result.output || "",
            exitCode: result.exitCode || 0,
            message: `Command completed in terminal "${terminalLabel}"`,
          };
        }
      }
    } catch (terminalError: any) {
      console.warn(`[run_command] Terminal not available, falling back to direct execution: ${terminalError.message}`);
    }

    // Fallback: Execute directly if terminal not available
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
        timeout: timeout || 30000,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      return { 
        success: true, 
        stdout, 
        stderr, 
        exitCode: 0,
        terminalFallback: true,
        message: "Terminal unavailable, executed command directly inside container"
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        exitCode: error.code || 1,
      };
    }
  },
});

export const get_terminal_output = tool({
  description:
    "Get the current output from a running or completed terminal command. Use the terminalId returned from run_command.",
  inputSchema: z.object({
    terminalId: z.string().describe("Terminal ID from run_command"),
  }),
  execute: async ({ terminalId }) => {
    console.log(`[Tool] get_terminal_output: ${terminalId}`);

    // Try to get output from VS Code terminal
    try {
      const response = await fetch("http://localhost:3001/vscode-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "getTerminalOutput",
          payload: { terminalId },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update stored output
        if (terminalOutputs.has(terminalId)) {
          terminalOutputs.set(terminalId, {
            output: result.output || "",
            isRunning: result.isRunning || false,
            startTime: terminalOutputs.get(terminalId)!.startTime,
          });
        }

        return {
          success: true,
          terminalId,
          output: result.output || "",
          isRunning: result.isRunning || false,
          exitCode: result.exitCode,
        };
      }
    } catch (error: any) {
      console.error(`[get_terminal_output] Error: ${error.message}`);
    }

    // Fallback: Check local storage
    const stored = terminalOutputs.get(terminalId);
    if (stored) {
      return {
        success: true,
        terminalId,
        output: stored.output,
        isRunning: stored.isRunning,
        message: "Retrieved from local storage (terminal may not be available)",
      };
    }

    return {
      success: false,
      error: `Terminal ID "${terminalId}" not found`,
    };
  },
});

/**
 * Git Tools
 */
export const git_status = tool({
  description: "Get git status showing modified, added, and deleted files",
  inputSchema: z.object({}),
  execute: async () => {
    console.log(`[Tool] git_status`);

    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: WORKSPACE_ROOT,
      });

      const files = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return { status, file };
        });

      return { files, count: files.length };
    } catch (error: any) {
      return { error: error.message, files: [], count: 0 };
    }
  },
});

export const git_diff = tool({
  description:
    "Get git diff showing changes made to files. Shows what was changed, added, or removed.",
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe("Optional file path to get diff for specific file"),
    staged: z
      .boolean()
      .optional()
      .default(false)
      .describe("Show staged changes instead of unstaged"),
  }),
  execute: async ({ path: filePath, staged }) => {
    console.log(`[Tool] git_diff${filePath ? `: ${filePath}` : ""}`);

    try {
      const stagedFlag = staged ? "--staged" : "";
      const { stdout } = await execAsync(
        `git diff ${stagedFlag} ${filePath || ""}`,
        {
          cwd: WORKSPACE_ROOT,
        }
      );

      return { diff: stdout, hasChanges: stdout.length > 0 };
    } catch (error: any) {
      return { error: error.message, diff: "", hasChanges: false };
    }
  },
});

export const git_log = tool({
  description: "Get recent git commit history",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Number of commits to show"),
  }),
  execute: async ({ limit }) => {
    console.log(`[Tool] git_log (limit: ${limit})`);

    try {
      const { stdout } = await execAsync(`git log --oneline -n ${limit}`, {
        cwd: WORKSPACE_ROOT,
      });

      const commits = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, ...messageParts] = line.split(" ");
          return {
            hash,
            message: messageParts.join(" "),
          };
        });

      return { commits, count: commits.length };
    } catch (error: any) {
      return { error: error.message, commits: [], count: 0 };
    }
  },
});

/**
 * Enhanced file operations
 */
export const read_multiple_files = tool({
  description: "Read multiple files at once for efficiency",
  inputSchema: z.object({
    paths: z.array(z.string()).describe("Array of file paths to read"),
  }),
  execute: async ({ paths }) => {
    console.log(`[Tool] read_multiple_files: ${paths.length} files`);

    const results = await Promise.all(
      paths.map(async (filePath) => {
        const fullPath = sanitizePath(filePath);
        try {
          if (!existsSync(fullPath)) {
            return { path: filePath, error: "File not found" };
          }
          const content = await readFile(fullPath, "utf-8");
          return { path: filePath, content };
        } catch (error: any) {
          return { path: filePath, error: error.message };
        }
      })
    );

    return {
      files: results,
      successCount: results.filter((r) => !r.error).length,
      totalCount: results.length,
    };
  },
});

export const find_files = tool({
  description:
    "Find files by pattern. Examples: '*.ts', 'src/**/*.tsx', '**/test*.js'",
  inputSchema: z.object({
    pattern: z.string().describe("File pattern to search for"),
    maxResults: z.number().optional().default(100),
  }),
  execute: async ({ pattern, maxResults }) => {
    console.log(`[Tool] find_files: ${pattern}`);

    try {
      const { stdout } = await execAsync(
        `find ${WORKSPACE_ROOT} -type f -name '${pattern}' 2>/dev/null | head -n ${maxResults}`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 5,
        }
      );

      const files = stdout
        .split("\n")
        .filter((f) => f.trim())
        .map((f) => f.replace(WORKSPACE_ROOT + "/", ""));

      return { files, count: files.length, pattern };
    } catch (error: any) {
      return { error: error.message, files: [], count: 0 };
    }
  },
});

export const get_file_info = tool({
  description: "Get file metadata (size, modified time, line count)",
  inputSchema: z.object({
    path: z.string().describe("File path to inspect"),
  }),
  execute: async ({ path: filePath }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] get_file_info: ${fullPath}`);

    try {
      const [statResult, wcResult] = await Promise.all([
        execAsync(`stat -c '%s %Y' "${fullPath}"`),
        execAsync(`wc -l "${fullPath}" 2>/dev/null || echo "0"`),
      ]);

      const [size, mtime] = statResult.stdout.trim().split(" ");
      const lines = parseInt(wcResult.stdout.trim().split(" ")[0]) || 0;

      return {
        path: filePath,
        size: parseInt(size),
        sizeKB: (parseInt(size) / 1024).toFixed(2),
        lastModified: new Date(parseInt(mtime) * 1000).toISOString(),
        lines,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

/**
 * Enhanced git operations
 */
export const git_branch = tool({
  description: "Manage git branches (list, create, switch, delete)",
  inputSchema: z.object({
    action: z.enum(["list", "create", "switch", "delete"]),
    branchName: z.string().optional(),
  }),
  execute: async ({ action, branchName }) => {
    console.log(`[Tool] git_branch: ${action} ${branchName || ""}`);

    try {
      let command = "";
      switch (action) {
        case "list":
          command = "git branch -a";
          break;
        case "create":
          if (!branchName) return { error: "Branch name required" };
          command = `git checkout -b ${branchName}`;
          break;
        case "switch":
          if (!branchName) return { error: "Branch name required" };
          command = `git checkout ${branchName}`;
          break;
        case "delete":
          if (!branchName) return { error: "Branch name required" };
          command = `git branch -d ${branchName}`;
          break;
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
      });

      return { action, branchName, output: stdout || stderr };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

export const git_stash = tool({
  description: "Stash uncommitted changes (save, list, pop, apply, drop)",
  inputSchema: z.object({
    action: z.enum(["save", "list", "pop", "apply", "drop"]),
    message: z.string().optional(),
  }),
  execute: async ({ action, message }) => {
    console.log(`[Tool] git_stash: ${action}`);

    try {
      let command = "";
      switch (action) {
        case "save":
          command = message ? `git stash save "${message}"` : "git stash save";
          break;
        case "list":
          command = "git stash list";
          break;
        case "pop":
          command = "git stash pop";
          break;
        case "apply":
          command = "git stash apply";
          break;
        case "drop":
          command = "git stash drop";
          break;
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
      });

      return { action, output: stdout || stderr };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

/**
 * Package management
 */
export const install_packages = tool({
  description:
    "Install npm/yarn/pnpm/bun packages (auto-detects package manager)",
  inputSchema: z.object({
    packages: z.array(z.string()).describe("Package names to install"),
    dev: z.boolean().optional().default(false),
  }),
  execute: async ({ packages, dev }) => {
    console.log(`[Tool] install_packages: ${packages.join(", ")}`);

    try {
      // Detect package manager
      const { stdout: detectOut } = await execAsync(
        "ls package-lock.json yarn.lock pnpm-lock.yaml bun.lockb 2>/dev/null || echo 'npm'",
        { cwd: WORKSPACE_ROOT }
      );

      let packageManager = "npm";
      let installCmd = "";

      if (detectOut.includes("yarn.lock")) {
        packageManager = "yarn";
        installCmd = dev
          ? `yarn add -D ${packages.join(" ")}`
          : `yarn add ${packages.join(" ")}`;
      } else if (detectOut.includes("pnpm-lock.yaml")) {
        packageManager = "pnpm";
        installCmd = dev
          ? `pnpm add -D ${packages.join(" ")}`
          : `pnpm add ${packages.join(" ")}`;
      } else if (detectOut.includes("bun.lockb")) {
        packageManager = "bun";
        installCmd = dev
          ? `bun add -d ${packages.join(" ")}`
          : `bun add ${packages.join(" ")}`;
      } else {
        packageManager = "npm";
        installCmd = dev
          ? `npm install --save-dev ${packages.join(" ")}`
          : `npm install ${packages.join(" ")}`;
      }

      const { stdout, stderr } = await execAsync(installCmd, {
        cwd: WORKSPACE_ROOT,
        timeout: 120000, // 2 minutes for package installation
        maxBuffer: 1024 * 1024 * 20,
      });

      return {
        success: true,
        packageManager,
        packages,
        dev,
        output: stdout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  },
});

export const run_tests = tool({
  description: "Run project tests (npm test, yarn test, etc.)",
  inputSchema: z.object({
    testPattern: z.string().optional(),
  }),
  execute: async ({ testPattern }) => {
    console.log(`[Tool] run_tests${testPattern ? `: ${testPattern}` : ""}`);

    try {
      const command = testPattern ? `npm test -- ${testPattern}` : "npm test";

      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
        timeout: 60000, // 1 minute for tests
        maxBuffer: 1024 * 1024 * 10,
      });

      return {
        success: true,
        output: stdout,
        errors: stderr,
        testPattern,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || "",
        errors: error.stderr || "",
      };
    }
  },
});

/**
 * Advanced search and inspection tools
 */
export const grep_in_file = tool({
  description: "Search for a pattern within a specific file using grep. Returns matching lines with line numbers.",
  inputSchema: z.object({
    path: z.string().describe("File path to search in"),
    pattern: z.string().describe("Pattern to search for (supports regex)"),
    caseInsensitive: z.boolean().optional().default(false).describe("Case-insensitive search"),
    contextLines: z.number().optional().default(0).describe("Number of context lines before/after match"),
  }),
  execute: async ({ path: filePath, pattern, caseInsensitive, contextLines }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] grep_in_file: ${pattern} in ${fullPath}`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "File not found" };
      }

      const caseFlag = caseInsensitive ? "-i" : "";
      const contextFlag = contextLines > 0 ? `-C ${contextLines}` : "";
      
      const { stdout } = await execAsync(
        `grep -n ${caseFlag} ${contextFlag} "${pattern}" "${fullPath}" || true`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 5,
        }
      );

      const matches = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const lineNum = line.substring(0, colonIndex);
            const content = line.substring(colonIndex + 1);
            return { line: parseInt(lineNum), content };
          }
          return { line: 0, content: line };
        });

      return {
        path: filePath,
        pattern,
        matches,
        count: matches.length,
      };
    } catch (error: any) {
      return { error: error.message, matches: [], count: 0 };
    }
  },
});

export const grep_in_directory = tool({
  description: "Search for a pattern recursively in all files within a directory using grep. Returns matching files and lines.",
  inputSchema: z.object({
    path: z.string().optional().default(".").describe("Directory path to search in"),
    pattern: z.string().describe("Pattern to search for (supports regex)"),
    filePattern: z.string().optional().describe("File pattern to filter (e.g., '*.ts', '*.js')"),
    caseInsensitive: z.boolean().optional().default(false).describe("Case-insensitive search"),
    maxResults: z.number().optional().default(100).describe("Maximum number of matches to return"),
  }),
  execute: async ({ path: dirPath, pattern, filePattern, caseInsensitive, maxResults }) => {
    const fullPath = sanitizePath(dirPath || ".");
    console.log(`[Tool] grep_in_directory: ${pattern} in ${fullPath}`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "Directory not found" };
      }

      const caseFlag = caseInsensitive ? "-i" : "";
      const includeFlag = filePattern ? `--include="${filePattern}"` : "";
      
      const { stdout } = await execAsync(
        `grep -rn ${caseFlag} ${includeFlag} "${pattern}" "${fullPath}" 2>/dev/null | head -n ${maxResults} || true`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 5,
        }
      );

      const matches = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(":");
          if (parts.length >= 3) {
            const file = parts[0].replace(fullPath + "/", "");
            const lineNum = parseInt(parts[1]);
            const content = parts.slice(2).join(":");
            return { file, line: lineNum, content };
          }
          return null;
        })
        .filter((m) => m !== null);

      return {
        path: dirPath,
        pattern,
        matches,
        count: matches.length,
      };
    } catch (error: any) {
      return { error: error.message, matches: [], count: 0 };
    }
  },
});

export const count_lines = tool({
  description: "Count lines in a file or all files in a directory. Useful for understanding code size.",
  inputSchema: z.object({
    path: z.string().describe("File or directory path"),
    filePattern: z.string().optional().describe("File pattern to filter (e.g., '*.ts')"),
  }),
  execute: async ({ path: targetPath, filePattern }) => {
    const fullPath = sanitizePath(targetPath);
    console.log(`[Tool] count_lines: ${fullPath}`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "Path not found" };
      }

      const stats = await execAsync(`stat -c '%F' "${fullPath}"`);
      const isDirectory = stats.stdout.trim().includes("directory");

      if (isDirectory) {
        const findPattern = filePattern ? `-name "${filePattern}"` : "-type f";
        const { stdout } = await execAsync(
          `find "${fullPath}" ${findPattern} -exec wc -l {} + 2>/dev/null || echo "0"`,
          {
            cwd: WORKSPACE_ROOT,
            maxBuffer: 1024 * 1024 * 5,
          }
        );

        const lines = stdout.split("\n").filter((l) => l.trim());
        const files = lines.slice(0, -1).map((line) => {
          const parts = line.trim().split(/\s+/);
          const count = parseInt(parts[0]);
          const file = parts.slice(1).join(" ").replace(fullPath + "/", "");
          return { file, lines: count };
        });

        const total = files.reduce((sum, f) => sum + f.lines, 0);

        return {
          path: targetPath,
          isDirectory: true,
          files,
          totalFiles: files.length,
          totalLines: total,
        };
      } else {
        const { stdout } = await execAsync(`wc -l "${fullPath}"`);
        const lines = parseInt(stdout.trim().split(/\s+/)[0]) || 0;

        return {
          path: targetPath,
          isDirectory: false,
          lines,
        };
      }
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

export const file_diff = tool({
  description: "Compare two files and show the differences using diff command.",
  inputSchema: z.object({
    file1: z.string().describe("First file path"),
    file2: z.string().describe("Second file path"),
    unified: z.boolean().optional().default(true).describe("Use unified diff format"),
  }),
  execute: async ({ file1, file2, unified }) => {
    const fullPath1 = sanitizePath(file1);
    const fullPath2 = sanitizePath(file2);
    console.log(`[Tool] file_diff: ${file1} vs ${file2}`);

    try {
      if (!existsSync(fullPath1)) {
        return { error: `File not found: ${file1}` };
      }
      if (!existsSync(fullPath2)) {
        return { error: `File not found: ${file2}` };
      }

      const diffFlag = unified ? "-u" : "";
      const { stdout } = await execAsync(
        `diff ${diffFlag} "${fullPath1}" "${fullPath2}" || true`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 5,
        }
      );

      return {
        file1,
        file2,
        diff: stdout,
        hasDifferences: stdout.length > 0,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

export const head_file = tool({
  description: "Read the first N lines of a file. Useful for quickly inspecting file headers.",
  inputSchema: z.object({
    path: z.string().describe("File path"),
    lines: z.number().optional().default(10).describe("Number of lines to read"),
  }),
  execute: async ({ path: filePath, lines }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] head_file: ${fullPath} (${lines} lines)`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "File not found" };
      }

      const { stdout } = await execAsync(`head -n ${lines} "${fullPath}"`, {
        cwd: WORKSPACE_ROOT,
        maxBuffer: 1024 * 1024 * 5,
      });

      return {
        path: filePath,
        lines: lines,
        content: stdout,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

export const tail_file = tool({
  description: "Read the last N lines of a file. Useful for checking logs or file endings.",
  inputSchema: z.object({
    path: z.string().describe("File path"),
    lines: z.number().optional().default(10).describe("Number of lines to read"),
  }),
  execute: async ({ path: filePath, lines }) => {
    const fullPath = sanitizePath(filePath);
    console.log(`[Tool] tail_file: ${fullPath} (${lines} lines)`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "File not found" };
      }

      const { stdout } = await execAsync(`tail -n ${lines} "${fullPath}"`, {
        cwd: WORKSPACE_ROOT,
        maxBuffer: 1024 * 1024 * 5,
      });

      return {
        path: filePath,
        lines: lines,
        content: stdout,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

export const find_duplicates = tool({
  description: "Find duplicate files in a directory based on content hash (MD5).",
  inputSchema: z.object({
    path: z.string().optional().default(".").describe("Directory path to search"),
    filePattern: z.string().optional().describe("File pattern to filter (e.g., '*.ts')"),
  }),
  execute: async ({ path: dirPath, filePattern }) => {
    const fullPath = sanitizePath(dirPath || ".");
    console.log(`[Tool] find_duplicates: ${fullPath}`);

    try {
      if (!existsSync(fullPath)) {
        return { error: "Directory not found" };
      }

      const findPattern = filePattern ? `-name "${filePattern}"` : "-type f";
      const { stdout } = await execAsync(
        `find "${fullPath}" ${findPattern} -type f -exec md5sum {} + 2>/dev/null || true`,
        {
          cwd: WORKSPACE_ROOT,
          maxBuffer: 1024 * 1024 * 10,
        }
      );

      const hashMap = new Map<string, string[]>();
      
      stdout.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const hash = parts[0];
          const file = parts.slice(1).join(" ").replace(fullPath + "/", "");
          
          if (!hashMap.has(hash)) {
            hashMap.set(hash, []);
          }
          hashMap.get(hash)!.push(file);
        }
      });

      const duplicates = Array.from(hashMap.entries())
        .filter(([_, files]) => files.length > 1)
        .map(([hash, files]) => ({ hash, files, count: files.length }));

      return {
        path: dirPath,
        duplicates,
        duplicateCount: duplicates.length,
        totalDuplicateFiles: duplicates.reduce((sum, d) => sum + d.count, 0),
      };
    } catch (error: any) {
      return { error: error.message, duplicates: [], duplicateCount: 0 };
    }
  },
});

/**
 * All available tools
 */
export const agentTools = {
  read_file,
  read_file_lines,
  write_file,
  list_directory,
  search_files,
  run_command,
  get_terminal_output,
  git_status,
  git_diff,
  git_log,
  // Enhanced tools
  read_multiple_files,
  find_files,
  get_file_info,
  git_branch,
  git_stash,
  install_packages,
  run_tests,
  // Advanced search and inspection
  grep_in_file,
  grep_in_directory,
  count_lines,
  file_diff,
  head_file,
  tail_file,
  find_duplicates,
};
