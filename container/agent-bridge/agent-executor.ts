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
  };

  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "anthropic/claude-3.5-sonnet") {
    this.apiKey = apiKey;
    this.model = model;
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

## Available Tools

### File Operations
- **read_file**: Read file contents to understand code
- **write_file**: Create or modify files (creates parent directories automatically)
- **list_directory**: List files and directories in a path

### Search & Discovery
- **search_files**: Fast regex search across files using ripgrep (supports file patterns like *.ts)
  - Useful for finding function definitions, imports, or specific patterns
  - Case-insensitive by default

### Git Operations
- **git_status**: See what files have changed
- **git_diff**: View detailed changes (unstaged or staged)
- **git_log**: View recent commit history

### Command Execution
- **run_command**: Execute shell commands (npm, bun, git, python, etc.)
  - Use for: installing dependencies, running tests, building, etc.

## Working Strategy

### 1. **Understand First** 🔍
- Start by exploring the repository structure with list_directory
- Use search_files to find relevant code patterns
- Read key files to understand the architecture
- Check existing tests or documentation

### 2. **Plan Your Changes** 📋
- Identify all files that need modification
- Consider edge cases and dependencies
- Think about backward compatibility

### 3. **Implement Carefully** ✏️
- Make precise, targeted changes
- Follow existing code style and patterns
- Add appropriate comments where helpful
- Update related tests if they exist

### 4. **Verify Your Work** ✅
- Use git_status to see all modified files
- Use git_diff to review your changes
- Run tests if available (run_command)
- Check for any unintended modifications

### 5. **Communicate Clearly** 💬
- Explain what you're doing at each step
- Report any issues or blockers you encounter
- Suggest improvements if you notice potential problems

## Best Practices
- **Be thorough but efficient** - Don't read unnecessary files
- **Preserve existing functionality** - Unless explicitly asked to change it
- **Follow conventions** - Match the existing code style
- **Think critically** - If something seems wrong, mention it
- **Test when possible** - Run builds/tests to verify changes work

## Important Notes
- The repository is already cloned and ready
- You have 15 steps maximum to complete the task
- All file paths are relative to /workspace
- Be security-conscious with command execution

Now, analyze the user's request and execute it systematically. Show your thought process as you work.`;
  }
}
