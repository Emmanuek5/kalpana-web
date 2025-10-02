import { tool } from "ai";
import { z } from "zod";
import { containerAPI } from "./container-api";
import { runWebResearchAgent } from "./agents/web-research-agent";
import { executeCodeEdit } from "./agents/code-editing-agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { localScrape } from "./local-scraper";

/**
 * Agent tools for workspace interactions
 * Based on AI SDK v5 tool format with sub-agents
 * @see https://ai-sdk.dev/docs/foundations/tools
 * @see https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
 */

/**
 * Helper function to unescape content that may have literal \n, \t, etc.
 * LLMs sometimes generate code with escaped characters instead of actual newlines
 */
function unescapeContent(content: string): string {
  return content
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

/**
 * Wrapper to log tool inputs and outputs for debugging
 * This wraps the entire tool, not just the execute function
 * DISABLED: Set to false to reduce console noise
 */
function wrapTool<T extends any>(toolName: string, toolDef: T): T {
  // Logging disabled - return tool as-is
  return toolDef;
}

/**
 * Legacy wrapper for execute functions
 */
function wrapToolExecute<T extends (...args: any[]) => any>(
  toolName: string,
  executeFn: T
): T {
  return (async (...args: any[]) => {
    const input = args[0];
    
    console.log(`\n🔧 [${toolName}] INPUT ==========`);
    console.log(JSON.stringify(input, null, 2));
    console.log(`====================================\n`);
    
    try {
      const result = await executeFn(...args);
      
      console.log(`\n✅ [${toolName}] OUTPUT ==========`);
      console.log(JSON.stringify(result, null, 2));
      console.log(`====================================\n`);
      
      return result;
    } catch (error: any) {
      console.log(`\n❌ [${toolName}] ERROR ==========`);
      console.log(`Error: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
      console.log(`====================================\n`);
      throw error;
    }
  }) as T;
}

export function createAgentTools(
  workspaceId: string,
  apiKey: string,
  modelName: string
) {
  // Create a language model instance for sub-agents using the same model as the main agent
  const openrouter = createOpenRouter({ apiKey });
  const agentModel = openrouter.languageModel(modelName);
  return {
    readFile: wrapTool("readFile", tool({
      description: "Read the contents of a file from the workspace",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The file path relative to the workspace root"),
      }),
      execute: async ({ path }) => {
        try {
          const content = await containerAPI.readFile(workspaceId, path);
          return { success: true, content, path };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    })),

    readFileLines: tool({
      description: "Read specific lines from a file. Useful when you have a file reference like @filepath:10-20 and need to see the actual code.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The file path relative to the workspace root"),
        startLine: z
          .number()
          .describe("Starting line number (1-indexed)"),
        endLine: z
          .number()
          .describe("Ending line number (1-indexed)"),
      }),
      execute: async ({ path, startLine, endLine }) => {
        try {
          const content = await containerAPI.readFile(workspaceId, path);
          const lines = content.split('\n');
          
          // Validate line numbers
          if (startLine < 1 || endLine < 1) {
            return { 
              success: false, 
              error: "Line numbers must be >= 1", 
              path 
            };
          }
          
          if (startLine > endLine) {
            return { 
              success: false, 
              error: "Start line must be <= end line", 
              path 
            };
          }
          
          // Extract the requested lines (convert to 0-indexed)
          const selectedLines = lines.slice(startLine - 1, endLine);
          const selectedContent = selectedLines.join('\n');
          
          return { 
            success: true, 
            content: selectedContent,
            path,
            startLine,
            endLine,
            totalLines: lines.length,
          };
        } catch (error: any) {
          return { 
            success: false, 
            error: error.message, 
            path,
            startLine,
            endLine,
          };
        }
      },
    }),

    writeFile: tool({
      description:
        "Write or create a file in the workspace. Content will be automatically unescaped (\\n becomes newlines, etc.)",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The file path relative to the workspace root"),
        content: z.string().describe("The content to write to the file"),
      }),
      execute: async ({ path, content }) => {
        try {
          // Unescape the content before writing
          const unescapedContent = unescapeContent(content);
          await containerAPI.writeFile(workspaceId, path, unescapedContent);
          return { success: true, path };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    }),

    listFiles: wrapTool("listFiles", tool({
      description: "List files and directories in a path",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Directory path (default: workspace root)"),
      }),
      execute: async ({ path = "." }) => {
        try {
          const files = await containerAPI.listFiles(workspaceId, path);
          return { success: true, files, path };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    })),

    runCommand: tool({
      description: "Execute a shell command in the workspace",
      inputSchema: z.object({
        command: z
          .string()
          .describe(
            "The shell command to execute (e.g., 'npm install', 'python app.py')"
          ),
      }),
      execute: async ({ command }) => {
        try {
          const result = await containerAPI.runCommand(workspaceId, command);
          return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
            command,
          };
        } catch (error: any) {
          return { success: false, error: error.message, command };
        }
      },
    }),

    searchCode: tool({
      description:
        "Search for text/code patterns in the workspace using ripgrep",
      inputSchema: z.object({
        query: z.string().describe("The text or regex pattern to search for"),
      }),
      execute: async ({ query }) => {
        try {
          const results = await containerAPI.searchCode(workspaceId, query);
          return { success: true, results, query };
        } catch (error: any) {
          return { success: false, error: error.message, query };
        }
      },
    }),

    gitCommit: tool({
      description: "Commit changes to git with a message",
      inputSchema: z.object({
        message: z.string().describe("The commit message"),
      }),
      execute: async ({ message }) => {
        try {
          const result = await containerAPI.gitCommit(workspaceId, message);
          return { success: true, output: result, message };
        } catch (error: any) {
          return { success: false, error: error.message, message };
        }
      },
    }),

    gitPush: tool({
      description: "Push commits to the remote repository",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await containerAPI.gitPush(workspaceId);
          return { success: true, output: result };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    }),

    deleteFile: tool({
      description: "Delete a file or directory from the workspace",
      inputSchema: z.object({
        path: z.string().describe("The file/directory path to delete"),
        recursive: z
          .boolean()
          .optional()
          .describe("Recursively delete directory contents"),
      }),
      execute: async ({ path, recursive = false }) => {
        try {
          const command = recursive ? `rm -rf ${path}` : `rm ${path}`;
          await containerAPI.runCommand(workspaceId, command);
          return {
            success: true,
            message: `Deleted ${path}`,
            path,
          };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    }),

    moveFile: tool({
      description: "Move or rename a file/directory",
      inputSchema: z.object({
        source: z.string().describe("Source path"),
        destination: z.string().describe("Destination path"),
      }),
      execute: async ({ source, destination }) => {
        try {
          await containerAPI.runCommand(
            workspaceId,
            `mv ${source} ${destination}`
          );
          return {
            success: true,
            message: `Moved ${source} to ${destination}`,
            source,
            destination,
          };
        } catch (error: any) {
          return { success: false, error: error.message, source, destination };
        }
      },
    }),

    createDirectory: tool({
      description: "Create a new directory",
      inputSchema: z.object({
        path: z.string().describe("Directory path to create"),
        recursive: z
          .boolean()
          .optional()
          .describe("Create parent directories if needed"),
      }),
      execute: async ({ path, recursive = true }) => {
        try {
          const command = recursive ? `mkdir -p ${path}` : `mkdir ${path}`;
          await containerAPI.runCommand(workspaceId, command);
          return {
            success: true,
            message: `Created directory ${path}`,
            path,
          };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    }),

    fileTree: tool({
      description: "Get a tree view of the workspace structure",
      inputSchema: z.object({
        path: z.string().optional().describe("Starting path (default: root)"),
        maxDepth: z
          .number()
          .optional()
          .describe("Maximum depth to traverse (default: 3)"),
      }),
      execute: async ({ path = ".", maxDepth = 3 }) => {
        try {
          const result = await containerAPI.runCommand(
            workspaceId,
            `tree -L ${maxDepth} -F ${path} || find ${path} -maxdepth ${maxDepth} -print | sed 's|[^/]*/| |g'`
          );
          return {
            success: true,
            tree: result.stdout,
            path,
          };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    }),

    webResearch: tool({
      description:
        "Research information online using a specialized web agent. Can scrape and analyze web pages.",
      inputSchema: z.object({
        task: z
          .string()
          .describe(
            "What to research (e.g., 'Find React hooks best practices')"
          ),
        urls: z
          .array(z.string())
          .optional()
          .describe("Specific URLs to visit and analyze"),
      }),
      execute: async ({ task, urls }) => {
        try {
          const result = await runWebResearchAgent({
            task,
            startUrl: urls && urls[0],
            maxSteps: 20,
            performanceMode: "balanced",
            model: agentModel,
          });
          return result;
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            findings: [],
            history: [],
          };
        }
      },
    }),

    editCode: tool({
      description:
        "Use a specialized code editing agent to make precise changes to files. Returns diffs showing changes.",
      inputSchema: z.object({
        instruction: z
          .string()
          .describe(
            "What changes to make (e.g., 'Add error handling to the login function')"
          ),
        files: z
          .array(
            z.object({
              path: z.string(),
              content: z.string(),
            })
          )
          .describe("Files to edit with their current content"),
        context: z
          .string()
          .optional()
          .describe("Additional context about the changes"),
      }),
      execute: async ({ instruction, files, context }) => {
        try {
          const result = await executeCodeEdit({
            instruction,
            files,
            context,
            model: agentModel,
          });
          return result;
        } catch (error: any) {
          return {
            success: false,
            explanation: `Code editing failed: ${error.message}`,
            edits: [],
            diffs: [],
          };
        }
      },
    }),

    getConsoleLogs: tool({
      description:
        "Get console logs and errors from the workspace environment. Useful for debugging runtime issues.",
      inputSchema: z.object({
        level: z
          .enum(["log", "error", "warn", "info"])
          .optional()
          .describe("Filter by log level (default: all)"),
        limit: z
          .number()
          .optional()
          .describe("Max number of logs to return (default: 50)"),
      }),
      execute: async ({ level, limit = 50 }) => {
        try {
          const logs = await containerAPI.getConsoleLogs(workspaceId, {
            level,
            limit,
          });
          return {
            success: true,
            logs,
            count: logs.length,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            logs: [],
          };
        }
      },
    }),

    getLintErrors: tool({
      description:
        "Get linting errors for files in the workspace. Helps identify code quality issues.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Specific file or directory to check (default: all)"),
      }),
      execute: async ({ path }) => {
        try {
          const errors = await containerAPI.getLintErrors(workspaceId, path);
          return {
            success: true,
            errors,
            count: errors.length,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            errors: [],
          };
        }
      },
    }),

    getProblems: tool({
      description:
        "Get ALL problems/diagnostics from VS Code - includes TypeScript errors, linting issues, and all language server diagnostics. This shows EXACTLY what the user sees in VS Code's Problems tab. Use this to understand what errors/warnings exist in the code.",
      inputSchema: z.object({
        severity: z
          .enum(["error", "warning", "info", "hint"])
          .optional()
          .describe(
            "Filter by severity: 'error' for errors only, 'warning' for warnings, etc. Leave empty for all problems."
          ),
      }),
      execute: async ({ severity }) => {
        try {
          const result = await containerAPI.getVSCodeProblems(
            workspaceId,
            severity
          );

          if (result.count === 0) {
            return {
              success: true,
              message: "No problems found! Code looks clean.",
              count: 0,
              problems: [],
            };
          }

          return {
            success: true,
            count: result.count,
            timestamp: result.timestamp,
            problems: result.diagnostics,
            summary: `Found ${result.count} ${severity || "total"} problem(s)`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            note: "Make sure VS Code extension is installed and active",
          };
        }
      },
    }),

    // ========== VS Code Extension Tools ==========
    runInTerminal: tool({
      description:
        "Run a command in the VS Code integrated terminal. The terminal will be shown to the user and the command will be executed. Use this to run tests, build commands, or any shell command.",
      inputSchema: z.object({
        command: z
          .string()
          .describe(
            "The shell command to run (e.g., 'npm test', 'git status')"
          ),
        terminalName: z
          .string()
          .optional()
          .describe("Name of the terminal (defaults to 'Kalpana')"),
      }),
      execute: async ({ command, terminalName }) => {
        try {
          const result = await containerAPI.runInTerminal(
            workspaceId,
            command,
            terminalName
          );
          return {
            success: true,
            ...result,
            message: `Command "${command}" sent to terminal`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    getCodeActions: tool({
      description:
        "Get available code actions (quick fixes) for a specific line in a file. This includes VS Code's built-in quick fixes like 'Add missing import', 'Fix all auto-fixable problems', etc. Use this to see what fixes are available before applying them.",
      inputSchema: z.object({
        filePath: z
          .string()
          .describe("Relative path to the file (e.g., 'src/app.ts')"),
        line: z.number().describe("Line number (1-indexed)"),
      }),
      execute: async ({ filePath, line }) => {
        try {
          const result = await containerAPI.getCodeActions(
            workspaceId,
            filePath,
            line
          );
          return {
            success: true,
            ...result,
            message:
              result.actions.length > 0
                ? `Found ${result.actions.length} code action(s)`
                : "No code actions available at this location",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    applyCodeAction: tool({
      description:
        "Apply a specific code action/quick fix. You must call getCodeActions first to get the list of available actions and their IDs. This will automatically fix the code according to the selected action.",
      inputSchema: z.object({
        actionId: z
          .number()
          .describe("The ID of the code action to apply (from getCodeActions)"),
      }),
      execute: async ({ actionId }) => {
        try {
          const result = await containerAPI.applyCodeAction(
            workspaceId,
            actionId
          );
          return {
            success: true,
            ...result,
            message: `Applied: ${result.applied}`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    goToDefinition: tool({
      description:
        "Find the definition of a symbol at a specific position in a file. Use this to understand where a function, class, or variable is defined.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file"),
        line: z.number().describe("Line number (1-indexed)"),
        character: z
          .number()
          .describe("Character position in the line (0-indexed)"),
      }),
      execute: async ({ filePath, line, character }) => {
        try {
          const result = await containerAPI.goToDefinition(
            workspaceId,
            filePath,
            line,
            character
          );
          return {
            success: true,
            ...result,
            message:
              result.definitions.length > 0
                ? `Found ${result.definitions.length} definition(s)`
                : "No definition found",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    findReferences: tool({
      description:
        "Find all references to a symbol at a specific position. Use this to see where a function, class, or variable is used throughout the codebase.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file"),
        line: z.number().describe("Line number (1-indexed)"),
        character: z
          .number()
          .describe("Character position in the line (0-indexed)"),
      }),
      execute: async ({ filePath, line, character }) => {
        try {
          const result = await containerAPI.findReferences(
            workspaceId,
            filePath,
            line,
            character
          );
          return {
            success: true,
            ...result,
            message: `Found ${result.count} reference(s)`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    searchSymbols: tool({
      description:
        "Search for symbols (classes, functions, variables, etc.) across the entire workspace by name. Use this to find where something is defined when you don't know the exact file.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Symbol name to search for (e.g., 'UserService', 'handleClick')"
          ),
      }),
      execute: async ({ query }) => {
        try {
          const result = await containerAPI.searchSymbols(workspaceId, query);
          return {
            success: true,
            ...result,
            message: `Found ${result.count} symbol(s) matching "${query}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    formatDocument: tool({
      description:
        "Format a file using the workspace's configured formatter (Prettier, ESLint, etc.). This will auto-format the code and save the file.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file to format"),
      }),
      execute: async ({ filePath }) => {
        try {
          const result = await containerAPI.formatDocument(
            workspaceId,
            filePath
          );
          return {
            success: true,
            ...result,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    getHover: tool({
      description:
        "Get hover information (type information, documentation, signatures) for a symbol at a specific position. This is like hovering over code in VS Code - you'll see types, JSDoc comments, and parameter hints.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path to the file"),
        line: z.number().describe("Line number (1-indexed)"),
        character: z
          .number()
          .describe("Character position in the line (0-indexed)"),
      }),
      execute: async ({ filePath, line, character }) => {
        try {
          const result = await containerAPI.getHover(
            workspaceId,
            filePath,
            line,
            character
          );
          return {
            success: true,
            ...result,
            message: result.hover
              ? "Hover information retrieved"
              : "No hover information available",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    // ========== Enhanced File Tools ==========
    readMultipleFiles: tool({
      description:
        "Read multiple files at once. More efficient than calling readFile multiple times. Returns content for all files.",
      inputSchema: z.object({
        paths: z
          .array(z.string())
          .describe("Array of file paths to read (relative to workspace root)"),
      }),
      execute: async ({ paths }) => {
        try {
          const results = await Promise.all(
            paths.map(async (path) => {
              try {
                const content = await containerAPI.readFile(workspaceId, path);
                return { path, success: true, content };
              } catch (error: any) {
                return { path, success: false, error: error.message };
              }
            })
          );
          return {
            success: true,
            files: results,
            successCount: results.filter((r) => r.success).length,
            totalCount: results.length,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    findFiles: tool({
      description:
        "Find files by name pattern using glob syntax. Very useful for discovering files. Examples: '*.ts' finds all TypeScript files, 'src/**/*.tsx' finds all TSX files in src directory, '**/test*.js' finds all test files.",
      inputSchema: z.object({
        pattern: z
          .string()
          .describe(
            "Glob pattern to match (e.g., '*.ts', 'src/**/*.tsx', '**/test*.js')"
          ),
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default: 100)"),
      }),
      execute: async ({ pattern, maxResults = 100 }) => {
        try {
          const result = await containerAPI.runCommand(
            workspaceId,
            `find . -type f -name '${pattern}' 2>/dev/null | head -n ${maxResults}`
          );
          const files = result.stdout
            .split("\n")
            .filter((f) => f.trim())
            .map((f) => f.replace("./", ""));
          return {
            success: true,
            files,
            count: files.length,
            pattern,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    getFileInfo: tool({
      description:
        "Get detailed information about a file including size, last modified time, and line count. Useful for understanding file characteristics before reading.",
      inputSchema: z.object({
        path: z.string().describe("File path to inspect"),
      }),
      execute: async ({ path }) => {
        try {
          const [statResult, wcResult] = await Promise.all([
            containerAPI.runCommand(workspaceId, `stat -c '%s %Y' "${path}"`),
            containerAPI.runCommand(workspaceId, `wc -l "${path}" 2>/dev/null || echo "0"`),
          ]);

          const [size, mtime] = statResult.stdout.trim().split(" ");
          const lines = parseInt(wcResult.stdout.trim().split(" ")[0]) || 0;

          return {
            success: true,
            path,
            size: parseInt(size),
            sizeFormatted: `${(parseInt(size) / 1024).toFixed(2)} KB`,
            lastModified: new Date(parseInt(mtime) * 1000).toISOString(),
            lines,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    // ========== Advanced Git Tools ==========
    gitBranch: tool({
      description:
        "List, create, or switch git branches. Essential for branch management.",
      inputSchema: z.object({
        action: z
          .enum(["list", "create", "switch", "delete"])
          .describe("Action to perform on branches"),
        branchName: z
          .string()
          .optional()
          .describe("Branch name (required for create/switch/delete)"),
      }),
      execute: async ({ action, branchName }) => {
        try {
          let command = "";
          switch (action) {
            case "list":
              command = "git branch -a";
              break;
            case "create":
              if (!branchName)
                return { success: false, error: "Branch name required" };
              command = `git checkout -b ${branchName}`;
              break;
            case "switch":
              if (!branchName)
                return { success: false, error: "Branch name required" };
              command = `git checkout ${branchName}`;
              break;
            case "delete":
              if (!branchName)
                return { success: false, error: "Branch name required" };
              command = `git branch -d ${branchName}`;
              break;
          }

          const result = await containerAPI.runCommand(workspaceId, command);
          return {
            success: true,
            action,
            branchName,
            output: result.stdout || result.stderr,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    gitStash: tool({
      description:
        "Stash or restore uncommitted changes. Useful for temporarily saving work.",
      inputSchema: z.object({
        action: z
          .enum(["save", "list", "pop", "apply", "drop"])
          .describe("Stash action to perform"),
        message: z
          .string()
          .optional()
          .describe("Message for stash save"),
      }),
      execute: async ({ action, message }) => {
        try {
          let command = "";
          switch (action) {
            case "save":
              command = message
                ? `git stash save "${message}"`
                : "git stash save";
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

          const result = await containerAPI.runCommand(workspaceId, command);
          return {
            success: true,
            action,
            output: result.stdout || result.stderr,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    // ========== Package Management Tools ==========
    installPackages: tool({
      description:
        "Install npm/yarn/pnpm packages. Automatically detects package manager from lock files.",
      inputSchema: z.object({
        packages: z
          .array(z.string())
          .describe("Package names to install (e.g., ['react', 'lodash'])"),
        dev: z
          .boolean()
          .optional()
          .describe("Install as dev dependencies"),
      }),
      execute: async ({ packages, dev = false }) => {
        try {
          // Detect package manager
          const detectResult = await containerAPI.runCommand(
            workspaceId,
            "ls package-lock.json yarn.lock pnpm-lock.yaml bun.lockb 2>/dev/null || echo 'npm'"
          );

          let packageManager = "npm";
          let installCmd = "";

          if (detectResult.stdout.includes("yarn.lock")) {
            packageManager = "yarn";
            installCmd = dev
              ? `yarn add -D ${packages.join(" ")}`
              : `yarn add ${packages.join(" ")}`;
          } else if (detectResult.stdout.includes("pnpm-lock.yaml")) {
            packageManager = "pnpm";
            installCmd = dev
              ? `pnpm add -D ${packages.join(" ")}`
              : `pnpm add ${packages.join(" ")}`;
          } else if (detectResult.stdout.includes("bun.lockb")) {
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

          const result = await containerAPI.runCommand(
            workspaceId,
            installCmd
          );

          return {
            success: true,
            packageManager,
            packages,
            dev,
            output: result.stdout,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    }),

    runTests: tool({
      description:
        "Run tests using the project's test runner (npm test, yarn test, etc.). Useful for verifying changes.",
      inputSchema: z.object({
        testPattern: z
          .string()
          .optional()
          .describe("Optional test file pattern or specific test to run"),
      }),
      execute: async ({ testPattern }) => {
        try {
          const command = testPattern
            ? `npm test -- ${testPattern}`
            : "npm test";

          const result = await containerAPI.runCommand(workspaceId, command);

          return {
            success: true,
            output: result.stdout,
            errors: result.stderr,
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
    }),

    // ========== Web Scraping Tool ==========
    scrapeWebPage: tool({
      description:
        "Scrape and extract content from any web page. Gets text content, metadata, links, and images. Use this to gather information from websites, documentation, articles, or any online resource.",
      inputSchema: z.object({
        url: z
          .string()
          .describe("The URL to scrape (e.g., 'https://example.com')"),
        extractLinks: z
          .boolean()
          .optional()
          .describe("Extract all links from the page (default: false)"),
        extractImages: z
          .boolean()
          .optional()
          .describe("Extract all images from the page (default: false)"),
        extractMetadata: z
          .boolean()
          .optional()
          .describe("Extract page metadata (title, description, og tags, etc.) (default: false)"),
        waitForSelector: z
          .string()
          .optional()
          .describe("CSS selector to wait for before extracting content"),
        timeout: z
          .number()
          .optional()
          .describe("Maximum time to wait in milliseconds (default: 30000)"),
      }),
      execute: async ({ 
        url, 
        extractLinks = false, 
        extractImages = false, 
        extractMetadata = false,
        waitForSelector,
        timeout 
      }) => {
        try {
          const result = await localScrape({
            url,
            extractLinks,
            extractImages,
            extractMetadata,
            waitForSelector,
            timeout,
            useAI: false,
            ignoreImages: true,
            maxScrolls: 2,
          });

          if (!result.success) {
            return {
              success: false,
              error: result.error || "Scraping failed",
              url,
            };
          }

          return {
            success: true,
            url: result.url,
            title: result.title,
            content: result.content,
            contentLength: result.content?.length || 0,
            links: result.links,
            linksCount: result.links?.length || 0,
            images: result.images,
            imagesCount: result.images?.length || 0,
            metadata: result.metadata,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            url,
          };
        }
      },
    }),
  };
}
