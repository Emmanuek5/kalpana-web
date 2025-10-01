import { tool } from "ai";
import { z } from "zod";
import { containerAPI } from "./container-api";
import { runLocalAgent } from "./agents/web-research-agent";
import { executeCodeEdit } from "./agents/code-editing-agent";

/**
 * Agent tools for workspace interactions
 * Based on AI SDK v5 tool format with sub-agents
 * @see https://ai-sdk.dev/docs/foundations/tools
 * @see https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
 */

export function createAgentTools(workspaceId: string) {
  return {
    readFile: tool({
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
    }),

    writeFile: tool({
      description: "Write or create a file in the workspace",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The file path relative to the workspace root"),
        content: z.string().describe("The content to write to the file"),
      }),
      execute: async ({ path, content }) => {
        try {
          await containerAPI.writeFile(workspaceId, path, content);
          return {
            success: true,
            message: `File ${path} written successfully`,
            path,
          };
        } catch (error: any) {
          return { success: false, error: error.message, path };
        }
      },
    }),

    listFiles: tool({
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
    }),

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
          const result = await runLocalAgent({
            task,
            startUrl: urls && urls[0],
            maxSteps: 20,
            performanceMode: "balanced",
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

    searchWeb: tool({
      description:
        "Search the web using a search engine. Returns relevant search results with titles, URLs, and snippets. Perfect for finding documentation, tutorials, or researching solutions.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The search query (e.g., 'Next.js 15 app router best practices')"),
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default: 10)"),
      }),
      execute: async ({ query, maxResults = 10 }) => {
        try {
          // Use DuckDuckGo or other search API
          const response = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`
          );
          const data = await response.json();

          const results = [
            ...(data.RelatedTopics || [])
              .filter((topic: any) => topic.FirstURL)
              .slice(0, maxResults)
              .map((topic: any) => ({
                title: topic.Text?.split(" - ")[0] || "Result",
                url: topic.FirstURL,
                snippet: topic.Text || "",
              })),
          ];

          return {
            success: true,
            query,
            results,
            count: results.length,
            message: `Found ${results.length} results for "${query}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            query,
            results: [],
          };
        }
      },
    }),

    scrapeWebPage: tool({
      description:
        "Scrape and extract content from a web page. Returns the main text content, links, and metadata. Use this to analyze documentation, blog posts, or any web content.",
      inputSchema: z.object({
        url: z.string().describe("The URL to scrape"),
        selector: z
          .string()
          .optional()
          .describe("CSS selector to extract specific content (optional)"),
        extractLinks: z
          .boolean()
          .optional()
          .describe("Whether to extract all links from the page (default: false)"),
      }),
      execute: async ({ url, selector, extractLinks = false }) => {
        try {
          const response = await fetch(url);
          const html = await response.text();

          // Basic HTML parsing (in production, use cheerio or similar)
          let content = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000); // Limit content length

          const links: string[] = [];
          if (extractLinks) {
            const linkMatches = html.matchAll(/href=["']([^"']+)["']/g);
            for (const match of linkMatches) {
              const link = match[1];
              if (link.startsWith("http")) {
                links.push(link);
              }
            }
          }

          // Extract title
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1] : "Untitled";

          return {
            success: true,
            url,
            title,
            content,
            links: extractLinks ? links.slice(0, 50) : [],
            message: `Successfully scraped ${url}`,
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

    fetchJSON: tool({
      description:
        "Fetch JSON data from an API endpoint. Perfect for interacting with REST APIs to get data, check API responses, or integrate external services.",
      inputSchema: z.object({
        url: z.string().describe("The API URL to fetch from"),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE"])
          .optional()
          .describe("HTTP method (default: GET)"),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe("Optional HTTP headers"),
        body: z
          .any()
          .optional()
          .describe("Request body for POST/PUT (will be JSON stringified)"),
      }),
      execute: async ({ url, method = "GET", headers, body }) => {
        try {
          const response = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          const data = await response.json();

          return {
            success: true,
            status: response.status,
            data,
            url,
            message: `${method} request to ${url} successful`,
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

    downloadFile: tool({
      description:
        "Download a file from a URL and save it to the workspace. Useful for downloading libraries, assets, or example files.",
      inputSchema: z.object({
        url: z.string().describe("The URL to download from"),
        destination: z
          .string()
          .describe("Where to save the file in the workspace"),
      }),
      execute: async ({ url, destination }) => {
        try {
          const response = await fetch(url);
          const content = await response.text();

          await containerAPI.writeFile(workspaceId, destination, content);

          return {
            success: true,
            url,
            destination,
            size: content.length,
            message: `Downloaded ${url} to ${destination}`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
            url,
            destination,
          };
        }
      },
    }),
  };
}
