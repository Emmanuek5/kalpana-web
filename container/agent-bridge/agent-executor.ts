import { streamText, CoreMessage, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { agentTools, getEditedFiles, clearEditedFiles, setFileEditCallback } from "./agent-tools";
import { createClient } from "redis";

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
  private agentId: string;
  private redis: ReturnType<typeof createClient> | null = null;
  
  // Buffers for batching DB updates
  private conversationBuffer: CoreMessage[] = [];
  private toolCallsBuffer: any[] = [];
  private filesEditedBuffer: any[] = [];

  constructor(agentId: string, apiKey: string, model: string = "anthropic/claude-3.5-sonnet") {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenRouter API key is required and cannot be empty");
    }
    this.agentId = agentId;
    this.apiKey = apiKey;
    this.model = model;
    console.log(`🔑 [AgentExecutor] Initialized for agent ${agentId}`);
    console.log(`🤖 [AgentExecutor] Model: ${model}`);
    
    // Clear any previous file edits
    clearEditedFiles();
    
    // Initialize Redis connection
    this.initializeRedis();
    
    // Set up file edit callback to publish to Redis
    setFileEditCallback((fileEdit) => {
      this.publishFileEdit(fileEdit);
    });
    
    // Note: State updates are now handled by Socket.io server reading from Redis
    // No need for batch timer - Socket.io will aggregate state from events
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://host.docker.internal:6379';
    
    try {
      this.redis = createClient({ url: redisUrl });
      
      this.redis.on('error', (err) => {
        console.error('❌ Redis error:', err);
      });
      
      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });
      
      await this.redis.connect();
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      // Continue without Redis - events won't be published but agent can still work
    }
  }
  
  /**
   * Publish event to Redis
   */
  private async publishToRedis(event: any): Promise<void> {
    if (!this.redis || !this.redis.isOpen) {
      console.warn('⚠️ Redis not connected, skipping event publish');
      return;
    }
    
    try {
      // Add to Redis Stream for history
      await this.redis.xAdd(
        `agent:${this.agentId}:stream`,
        '*',
        { data: JSON.stringify(event) },
        { TRIM: { strategy: 'MAXLEN', threshold: 1000, strategyModifier: '~' } }
      );
      
      // Publish to channel for real-time
      await this.redis.publish(
        `agent:${this.agentId}:events`,
        JSON.stringify(event)
      );
    } catch (error) {
      console.error('❌ Failed to publish to Redis:', error);
    }
  }
  
  /**
   * Publish file edit event
   */
  private async publishFileEdit(fileEdit: any): Promise<void> {
    this.filesEditedBuffer.push(fileEdit);
    
    await this.publishToRedis({
      type: 'file-edit',
      agentId: this.agentId,
      fileEdit,
      timestamp: Date.now()
    });
  }
  
  /**
   * Flush buffers to database via HTTP
   */
  private async flushToDatabase(): Promise<void> {
    if (
      this.conversationBuffer.length === 0 &&
      this.toolCallsBuffer.length === 0 &&
      this.filesEditedBuffer.length === 0
    ) {
      return;
    }
    
    try {
      // Call Next.js API to update database
      const response = await fetch(
        `http://host.docker.internal:3000/api/agents/${this.agentId}/state`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory: this.conversationBuffer,
            toolCalls: this.toolCallsBuffer,
            filesEdited: this.filesEditedBuffer
          })
        }
      );
      
      if (response.ok) {
        console.log(`💾 Flushed state to database for agent ${this.agentId}`);
      }
    } catch (error) {
      console.error('❌ Failed to flush to database:', error);
    }
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
    this.conversationBuffer = messages;
  }
  /**
   * Execute a task with streaming response
   */
  async *execute(task: string): AsyncGenerator<string, void, unknown> {
    if (this.state.isExecuting) {
      throw new Error("Agent is already executing a task");
    }
    
    console.log(`🎯 Starting agent execution...`);
    this.state.isExecuting = true;
    this.state.lastError = undefined;
    
    // Publish status event: RUNNING
    await this.publishToRedis({
      type: 'status',
      agentId: this.agentId,
      status: 'RUNNING',
      timestamp: Date.now()
    });

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

      // Stream AI response with tools using fullStream for real-time events
      console.log(`🚀 [AgentExecutor] Calling streamText API...`);
      console.log(`   Model: ${this.model}`);
      console.log(`   Messages: ${this.state.conversationHistory.length}`);
      console.log(`   Tools: ${Object.keys(agentTools).length}`);
      
      let result;
      try {
        result = streamText({
          model: openrouter(this.model),
          messages: this.state.conversationHistory,
          system: this.getSystemPrompt(),
          tools: agentTools,
          stopWhen: stepCountIs(100),
        });
        console.log(`✅ [AgentExecutor] streamText() returned successfully`);
      } catch (apiError: any) {
        console.error(`❌ [AgentExecutor] streamText() threw error:`, apiError);
        throw apiError;
      }

      let fullResponse = "";
      let chunkCount = 0;

      console.log(`📡 [AgentExecutor] Starting to consume fullStream...`);

      // Use fullStream to get real-time tool-call and tool-result events
      try {
        console.log(`🎬 [AgentExecutor] Entering fullStream loop...`);
        for await (const chunk of result.fullStream) {
          console.log(`📦 [AgentExecutor] Received chunk type: ${chunk.type}`);
          // Handle tool calls (before execution)
          if (chunk.type === 'tool-call') {
            this.state.toolCallsCount++;

            const toolCallInfo = {
              id: chunk.toolCallId,
              name: chunk.toolName,
              arguments: (chunk as any).input || {},
              timestamp: new Date().toISOString(),
            };

            this.state.toolCalls.push(toolCallInfo);

            console.log(
              `🔧 [AgentExecutor] Tool call: ${chunk.toolName}`,
              `\n   Arguments:`,
              JSON.stringify((chunk as any).input || {}, null, 2)
            );

            // Add to buffer
            this.toolCallsBuffer.push({
              ...toolCallInfo,
              state: 'executing'
            });
            
            // Publish to Redis immediately (matches workspace agent pattern)
            await this.publishToRedis({
              type: 'tool-call',
              agentId: this.agentId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: (chunk as any).input || {},
              timestamp: Date.now()
            });
          }
          
          // Handle tool results (after execution)
          else if (chunk.type === 'tool-result') {
            const output = (chunk as any).output || {};
            
            console.log(
              `📤 [AgentExecutor] Tool result: ${chunk.toolName}`,
              `\n   Result:`,
              JSON.stringify(output, null, 2)
            );

            // Update buffer
            const toolCall = this.toolCallsBuffer.find(tc => tc.id === chunk.toolCallId);
            if (toolCall) {
              toolCall.state = 'complete';
              toolCall.result = output;
              toolCall.completedAt = new Date().toISOString();
            }
            
            // Publish to Redis (matches workspace agent pattern)
            await this.publishToRedis({
              type: 'tool-result',
              agentId: this.agentId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              result: output,
              timestamp: Date.now()
            });
          }
          
          // Handle text deltas
          else if (chunk.type === 'text-delta') {
            const text = (chunk as any).text || "";
            
            // Skip empty text deltas
            if (!text || text.length === 0) {
              console.log(`⚠️ [AgentExecutor] Skipping empty text-delta`);
              continue;
            }
            
            fullResponse += text;
            chunkCount++;
            
            console.log(`💬 [AgentExecutor] Text delta (chunk ${chunkCount}): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            // Publish to Redis (matches workspace agent pattern)
            await this.publishToRedis({
              type: 'text-delta',
              agentId: this.agentId,
              textDelta: text,
              timestamp: Date.now()
            });
            
            console.log(`📤 [AgentExecutor] Published text-delta to Redis`);
            
            yield text;
          }
        }
      } catch (streamError: any) {
        console.error(`❌ [AgentExecutor] Stream error caught:`, streamError);
        console.error(`   Error type: ${streamError.constructor.name}`);
        console.error(`   Error message: ${streamError.message}`);
        console.error(`   Status code: ${streamError.statusCode || 'none'}`);
        console.error(`   Error stack:`, streamError.stack);
        
        if (streamError.cause) {
          console.error(`   Cause:`, streamError.cause);
        }
        
        if (streamError.response) {
          console.error(`   Response:`, streamError.response);
        }

        // Check for specific HTTP error codes
        if (streamError.statusCode === 401) {
          throw new Error(
            `Authentication failed: Invalid or expired OpenRouter API key (401 Unauthorized). Please check your API key in settings.`
          );
        } else if (streamError.statusCode === 429) {
          throw new Error(
            `Rate limit exceeded (429 Too Many Requests). Please wait a moment and try again.`
          );
        } else if (streamError.statusCode === 500) {
          throw new Error(
            `OpenRouter server error (500 Internal Server Error). The service may be temporarily unavailable.`
          );
        } else if (streamError.statusCode) {
          throw new Error(
            `API error (${streamError.statusCode}): ${
              streamError.message || "Unknown error"
            }`
          );
        }

        throw new Error(`Stream error: ${streamError.message || 'Unknown stream error'}`);
      }

      console.log(`🏁 [AgentExecutor] Exited fullStream loop`);
      console.log(`📝 [AgentExecutor] Streamed ${chunkCount} text chunks`);
      console.log(`📊 [AgentExecutor] Full response length: ${fullResponse.length} chars`);

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
      
      // Update buffer
      this.conversationBuffer = [...this.state.conversationHistory];
      
      // Publish completion event
      await this.publishToRedis({
        type: 'finish',
        agentId: this.agentId,
        timestamp: Date.now()
      });
      
      // Publish status event: COMPLETED
      await this.publishToRedis({
        type: 'status',
        agentId: this.agentId,
        status: 'COMPLETED',
        timestamp: Date.now()
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
      
      // Publish error event
      await this.publishToRedis({
        type: 'error',
        agentId: this.agentId,
        error: error.message,
        timestamp: Date.now()
      });
      
      // Publish status event: FAILED
      await this.publishToRedis({
        type: 'status',
        agentId: this.agentId,
        status: 'FAILED',
        timestamp: Date.now()
      });
      
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
- **run_command**: Execute shell commands in VS Code terminal and get output
  - Returns output directly for quick commands (<5s)
  - For long-running commands: returns terminalId to fetch output later
  - Set waitForOutput=false for commands that take a long time
  - Use for: building, linting, custom scripts, running servers
  - Whitelisted commands only for security
- **get_terminal_output**: Fetch output from a running/completed terminal command
  - Use the terminalId returned from run_command
  - Check if command is still running with isRunning field
  - Useful for monitoring long-running processes

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
