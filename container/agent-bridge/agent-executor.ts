import { streamText, CoreMessage, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { agentTools, getEditedFiles, clearEditedFiles } from "./agent-tools";

/**
 * Agent Executor - Runs AI agent with tools inside the container
 * This maintains conversation state and executes tasks autonomously
 */

interface AgentState {
  conversationHistory: CoreMessage[];
  toolCallsCount: number;
  isExecuting: boolean;
  lastError?: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: any;
    timestamp: string;
  }>;
}

interface AgentStateWithFiles extends AgentState {
  filesEdited: Array<{
    path: string;
    operation: "created" | "modified" | "deleted";
    timestamp: string;
  }>;
}

export class AgentExecutor {
  private state: AgentState = {
    conversationHistory: [],
    toolCallsCount: 0,
    isExecuting: false,
    toolCalls: [],
  };

  private apiKey: string;
  private model: string;
  private toolCallCallback?: (toolCall: {
    id: string;
    name: string;
    arguments: any;
    timestamp: string;
    isResult?: boolean;
  }) => void;

  constructor(apiKey: string, model: string = "anthropic/claude-3.5-sonnet") {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenRouter API key is required and cannot be empty");
    }
    this.apiKey = apiKey;
    this.model = model;
    console.log(
      `🔑 [AgentExecutor] Initialized with API key: ${apiKey.substring(
        0,
        8
      )}...`
    );
    console.log(`🤖 [AgentExecutor] Model: ${model}`);
    // Clear any previous file edits
    clearEditedFiles();
  }

  /**
   * Get current agent state with files edited
   */
  getState(): AgentStateWithFiles {
    return {
      ...this.state,
      filesEdited: getEditedFiles(),
    };
  }

  /**
   * Set conversation history (for resuming agents)
   */
  setConversationHistory(messages: CoreMessage[]): void {
    this.state.conversationHistory = messages;
  }

  /**
   * Set callback for tool calls
   */
  setToolCallCallback(
    callback: (toolCall: {
      id: string;
      name: string;
      arguments: any;
      timestamp: string;
      isResult?: boolean;
    }) => void
  ): void {
    this.toolCallCallback = callback;
  }

  /**
   * Execute a task with streaming response
   */
  async *execute(task: string): AsyncGenerator<string, void, unknown> {
    if (this.state.isExecuting) {
      throw new Error("Agent is already executing a task");
    }

    this.state.isExecuting = true;
    this.state.lastError = undefined;

    try {
      console.log(`🚀 [AgentExecutor] Starting execution`);
      console.log(`   Task: ${task.substring(0, 100)}...`);
      console.log(`   Model: ${this.model}`);
      console.log(
        `   History: ${this.state.conversationHistory.length} messages`
      );

      // Add task to conversation history
      this.state.conversationHistory.push({
        role: "user",
        content: task,
      });

      const openrouter = createOpenRouter({ apiKey: this.apiKey });

      console.log(`🤖 [AgentExecutor] Calling AI model...`);
      console.log(
        `   Messages in history: ${JSON.stringify(
          this.state.conversationHistory.map((m) => ({
            role: m.role,
            contentLength:
              typeof m.content === "string" ? m.content.length : "non-string",
          }))
        )}`
      );

      // Stream AI response with tools
      const result = streamText({
        model: openrouter(this.model),
        messages: this.state.conversationHistory,
        system: this.getSystemPrompt(),
        tools: agentTools,
        stopWhen: stepCountIs(100),
        onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
          // Track each tool call for display
          this.state.toolCallsCount += toolCalls.length;

          // Record and broadcast each tool call
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];

            // Get the arguments from the tool call
            // In AI SDK, the args are available directly on the toolCall
            // Cast to any to access the args property which exists at runtime
            const args = (toolCall as any).args || {};

            const toolCallInfo = {
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              arguments: args,
              timestamp: new Date().toISOString(),
            };

            this.state.toolCalls.push(toolCallInfo);

            console.log(
              `🔧 [AgentExecutor] Tool call ${i + 1}/${toolCalls.length}: ${
                toolCall.toolName
              }`,
              `\n   Arguments:`,
              JSON.stringify(args, null, 2)
            );

            // Notify callback if set
            if (this.toolCallCallback) {
              this.toolCallCallback(toolCallInfo);
            }
          }

          // Emit tool results
          for (let i = 0; i < toolResults.length; i++) {
            const toolResult = toolResults[i] as any;
            
            // The result is directly on the toolResult object, not nested
            const result = toolResult.result || toolResult;
            
            console.log(
              `📤 [AgentExecutor] Tool result ${i + 1}/${toolResults.length}: ${
                toolResult.toolName
              }`,
              `\n   Result:`,
              JSON.stringify(result, null, 2)
            );

            // Notify callback with tool result
            if (this.toolCallCallback) {
              this.toolCallCallback({
                id: toolResult.toolCallId,
                name: toolResult.toolName,
                arguments: result, // Send result directly, not wrapped
                timestamp: new Date().toISOString(),
                isResult: true, // Flag to identify this as a result
              });
            }
          }

          console.log(
            `🔧 [AgentExecutor] Step completed: ${toolCalls.length} tool calls, ${toolResults.length} results, text length: ${text.length}, finishReason: ${finishReason}`
          );
        },
      });

      let fullResponse = "";
      let chunkCount = 0;

      console.log(`📡 [AgentExecutor] Starting to consume textStream...`);

      // Stream text chunks with error handling
      try {
        for await (const chunk of result.textStream) {
          fullResponse += chunk;
          chunkCount++;
          console.log(
            `📨 [AgentExecutor] Chunk ${chunkCount}: ${chunk.substring(
              0,
              50
            )}...`
          );
          yield chunk;
        }
      } catch (streamError: any) {
        console.error(`❌ [AgentExecutor] Stream error:`, streamError);

        // Check for specific HTTP error codes
        if (streamError.statusCode === 401) {
          throw new Error(
            `Authentication failed: Invalid or expired OpenRouter API key (401 Unauthorized). Please check your API key in settings.`
          );
        } else if (streamError.statusCode === 403) {
          throw new Error(
            `Access forbidden: Your API key doesn't have permission to use this model (403 Forbidden).`
          );
        } else if (streamError.statusCode === 429) {
          throw new Error(
            `Rate limit exceeded: Too many requests to OpenRouter API (429 Too Many Requests). Please try again later.`
          );
        } else if (streamError.statusCode === 404) {
          throw new Error(
            `Model not found: The model "${this.model}" doesn't exist on OpenRouter (404 Not Found).`
          );
        } else if (streamError.statusCode) {
          throw new Error(
            `API error (${streamError.statusCode}): ${
              streamError.message || "Unknown error"
            }`
          );
        }

        throw new Error(`Stream error: ${streamError.message}`);
      }

      console.log(`📝 [AgentExecutor] Streamed ${chunkCount} text chunks`);

      // Wait for completion
      console.log(`⏳ [AgentExecutor] Waiting for completion...`);
      const completion = await result;

      // Get the final text (it's a Promise)
      const completionText = await completion.text;

      console.log(`🏁 [AgentExecutor] Completion received:`, {
        finishReason: completion.finishReason,
        usage: completion.usage,
        textLength: completionText?.length || 0,
        textPreview: completionText?.substring(0, 100),
        warnings: completion.warnings,
      });

      // Warn if no response was generated
      if (
        chunkCount === 0 &&
        (!completionText || completionText.length === 0)
      ) {
        console.warn(`⚠️ [AgentExecutor] No response generated!`);
        console.warn(`   finishReason: ${completion.finishReason}`);
        console.warn(`   usage: ${JSON.stringify(completion.usage)}`);
      }

      console.log(`✅ [AgentExecutor] Execution completed`);
      console.log(`   Response length: ${fullResponse.length} chars`);
      console.log(`   Total tool calls: ${this.state.toolCallsCount}`);
      console.log(`   Files edited: ${getEditedFiles().length}`);

      // Add assistant response to conversation history (use fullResponse or completionText)
      const responseText = fullResponse || completionText || "";
      this.state.conversationHistory.push({
        role: "assistant",
        content: responseText,
      });

      // If we got a response via completionText but not via streaming, warn about it
      if (!fullResponse && completionText) {
        console.warn(
          `⚠️ [AgentExecutor] Response was in completion.text but not streamed!`
        );
      }
    } catch (error: any) {
      console.error(`❌ [AgentExecutor] Fatal error:`, error);
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      if (error.cause) {
        console.error(`   Cause:`, error.cause);
      }
      this.state.lastError = error.message;
      throw error;
    } finally {
      this.state.isExecuting = false;
      console.log(
        `🔚 [AgentExecutor] Execution finished (isExecuting set to false)`
      );
    }
  }

  /**
   * Send a chat message (continue conversation)
   */
  async *chat(message: string): AsyncGenerator<string, void, unknown> {
    yield* this.execute(message);
  }

  /**
   * Get enhanced system prompt for the agent
   */
  private getSystemPrompt(): string {
    return `You are an autonomous coding agent working in a cloned GitHub repository at /workspace.

## Your Mission
Understand the codebase and make the necessary changes to complete the user's request accurately and efficiently.

## Communication Style
**IMPORTANT**: Always explain your thought process and plan BEFORE using tools. Follow this pattern:
1. First, describe what you're about to do and why
2. Then use the appropriate tools
3. After tools complete, explain what you learned and your next steps

Example:
"I'll start by exploring the repository structure to understand the codebase organization."
[uses list_directory tool]
"I can see this is a TypeScript project with src/ and tests/ directories. Let me examine the main entry point..."
[uses read_file tool]

This helps users follow your reasoning and understand your progress.

## Available Tools

### File Operations
- **read_file**: Read a single file's contents
- **write_file**: Create or modify files (creates parent directories automatically)
- **read_multiple_files**: Read multiple files at once (more efficient than multiple read_file calls)
- **list_directory**: List files and directories in a path
- **find_files**: Find files by pattern (e.g., '*.ts', 'src/**/*.tsx', '**/test*.js')
- **get_file_info**: Get file metadata (size, modified time, line count)

### Search & Discovery
- **search_files**: Fast regex search across files using ripgrep
  - Supports file patterns like *.ts
  - Case-insensitive by default
  - Returns matches with line numbers and context

### Git Operations
- **git_status**: See what files have changed
- **git_diff**: View detailed changes (unstaged or staged)
- **git_log**: View recent commit history
- **git_branch**: Manage branches (list, create, switch, delete)
- **git_stash**: Stash uncommitted changes (save, list, pop, apply, drop)

### Package Management
- **install_packages**: Install npm/yarn/pnpm/bun packages
  - Auto-detects package manager from lock files
  - Supports dev dependencies with dev: true
  - Examples: install_packages({packages: ["react", "lodash"], dev: false})

### Testing & Verification
- **run_tests**: Run project tests (npm test, yarn test, etc.)
  - Supports test patterns to run specific tests
  - Returns test output and errors

### Command Execution
- **run_command**: Execute shell commands (npm, bun, git, python, etc.)
  - Use for: building, linting, custom scripts
  - Whitelisted commands only for security

## Working Strategy

### 1. **Understand First** 🔍
- Start by exploring the repository structure with list_directory
- Use find_files to discover relevant files by pattern
- Use search_files to find specific code patterns or imports
- Use read_multiple_files to efficiently read several files at once
- Check package.json, README, or documentation files

### 2. **Plan Your Changes** 📋
- Identify all files that need modification
- Consider edge cases and dependencies
- Check if new packages need to be installed
- Think about backward compatibility

### 3. **Implement Carefully** ✏️
- Make precise, targeted changes
- Follow existing code style and patterns
- Add appropriate comments where helpful
- Update related tests if they exist
- Use install_packages if new dependencies are needed

### 4. **Verify Your Work** ✅
- Use git_status to see all modified files
- Use git_diff to review your changes in detail
- Run tests with run_tests to verify functionality
- Check for any unintended modifications
- Use run_command to build or lint if needed

### 5. **Communicate Clearly** 💬
- Explain what you're doing at each step
- Report any issues or blockers you encounter
- Suggest improvements if you notice potential problems
- Summarize changes made at the end

## Best Practices
- **Be thorough but efficient** - Use read_multiple_files instead of multiple read_file calls
- **Preserve existing functionality** - Unless explicitly asked to change it
- **Follow conventions** - Match the existing code style and patterns
- **Think critically** - If something seems wrong, mention it
- **Test when possible** - Run builds/tests to verify changes work
- **Use git effectively** - Stash changes if needed, create branches for features

## Important Notes
- The repository is already cloned and ready
- You have 100 steps maximum to complete the task
- All file paths are relative to /workspace
- Be security-conscious with command execution
- Package installations may take time - be patient

## Example Workflows

**Adding a new feature:**
1. Use find_files to locate relevant files
2. Use read_multiple_files to read them efficiently
3. Use search_files to find similar patterns
4. Install any needed packages with install_packages
5. Modify files with write_file
6. Run tests with run_tests
7. Review changes with git_diff

**Fixing a bug:**
1. Use search_files to find the problematic code
2. Read related files to understand context
3. Make targeted fixes with write_file
4. Run tests to verify the fix
5. Check git_diff to ensure only intended changes

**Refactoring:**
1. Use find_files to locate all affected files
2. Use git_branch to create a feature branch
3. Make incremental changes
4. Run tests frequently
5. Use git_stash if you need to pause work

Now, analyze the user's request and execute it systematically. Show your thought process as you work.`;
  }
}
