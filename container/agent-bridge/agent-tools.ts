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
}

/**
 * Generate a simple diff between two strings
 */
function generateDiff(original: string, updated: string): string {
  const originalLines = original.split("\n");
  const updatedLines = updated.split("\n");

  const diff: string[] = [];
  const maxLines = Math.max(originalLines.length, updatedLines.length);

  for (let i = 0; i < maxLines; i++) {
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
  }

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

    filesEdited.push({
      path: filePath,
      operation: existed ? "modified" : "created",
      timestamp: new Date().toISOString(),
      originalContent: existed ? originalContent : "",
      newContent: content,
      diff,
    });

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
export const run_command = tool({
  description:
    "Run a shell command in the workspace. Use this to install dependencies, run tests, build, etc.",
  inputSchema: z.object({
    command: z.string().describe("Command to run"),
  }),
  execute: async ({ command }) => {
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

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
        timeout: 30000, // 30s timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      return { success: true, stdout, stderr, exitCode: 0 };
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
 * All available tools
 */
export const agentTools = {
  read_file,
  read_file_lines,
  write_file,
  list_directory,
  search_files,
  run_command,
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
};
