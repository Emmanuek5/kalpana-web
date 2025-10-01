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

    // Create directory if needed
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      await execAsync(`mkdir -p "${dir}"`);
    }

    await writeFile(fullPath, content, "utf-8");

    filesEdited.push({
      path: filePath,
      operation: existed ? "modified" : "created",
      timestamp: new Date().toISOString(),
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
 * All available tools
 */
export const agentTools = {
  read_file,
  write_file,
  list_directory,
  search_files,
  run_command,
  git_status,
  git_diff,
  git_log,
};
