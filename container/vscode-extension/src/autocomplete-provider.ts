import * as vscode from "vscode";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export class KalpanaInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private apiKey: string = "";
  private model: string = "google/gemma-3-27b-it:free"; // Free model
  private debounceTimer: NodeJS.Timeout | undefined;
  private lastRequest: { document: string; position: string } | null = null;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    // Create output channel for logging
    this.outputChannel = vscode.window.createOutputChannel("Kalpana Autocomplete");
    this.outputChannel.appendLine("🚀 Kalpana Autocomplete initialized");
    
    // Try to read API key from environment or config file
    this.loadApiKey();
  }

  private async loadApiKey() {
    try {
      const fs = await import("fs");
      const configPath = "/tmp/kalpana-config.json";
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        this.apiKey = config.openrouterApiKey || "";
        this.model = config.autocompleteModel || this.model;
        this.outputChannel.appendLine(`✅ Config loaded: Model=${this.model}`);
      } else {
        this.outputChannel.appendLine(`⚠️  Config file not found at ${configPath}`);
      }
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to load config: ${error}`);
      console.error("Failed to load API key:", error);
    }
  }

  public updateApiKey(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    if (model) {
      this.model = model;
    }
    this.outputChannel.appendLine(`🔄 API key updated, Model=${this.model}`);
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    // Don't provide completions if no API key
    if (!this.apiKey) {
      return null;
    }

    // Don't trigger on manual invocation or if already typing
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Explicit) {
      return null;
    }

    // Debounce to avoid too many requests
    const currentRequest = {
      document: document.uri.toString(),
      position: `${position.line}:${position.character}`,
    };

    if (
      this.lastRequest &&
      this.lastRequest.document === currentRequest.document &&
      this.lastRequest.position === currentRequest.position
    ) {
      return null;
    }

    this.lastRequest = currentRequest;

    try {
      // Get context around cursor
      const prefix = this.getPrefix(document, position);
      const suffix = this.getSuffix(document, position);

      // Skip if prefix is too short or ends with whitespace only
      if (prefix.trim().length < 3) {
        return null;
      }

      // Get language
      const language = document.languageId;
      const filename = document.fileName.split("/").pop() || "";

      // Generate completion
      const completion = await this.generateCompletion(
        prefix,
        suffix,
        language,
        filename,
        token
      );

      if (!completion || token.isCancellationRequested) {
        return null;
      }

      // Create inline completion item
      const item = new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position)
      );

      return [item];
    } catch (error) {
      console.error("Autocomplete error:", error);
      return null;
    }
  }

  private getPrefix(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const maxLines = 50; // Context window
    const startLine = Math.max(0, position.line - maxLines);
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      position
    );
    return document.getText(range);
  }

  private getSuffix(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string {
    const maxLines = 20;
    const endLine = Math.min(
      document.lineCount - 1,
      position.line + maxLines
    );
    const range = new vscode.Range(
      position,
      new vscode.Position(endLine, Number.MAX_SAFE_INTEGER)
    );
    return document.getText(range);
  }

  private async generateCompletion(
    prefix: string,
    suffix: string,
    language: string,
    filename: string,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      this.outputChannel.appendLine(`\n📤 Request to OpenRouter:`);
      this.outputChannel.appendLine(`   Model: ${this.model}`);
      this.outputChannel.appendLine(`   File: ${filename} (${language})`);
      this.outputChannel.appendLine(`   Prefix length: ${prefix.length} chars`);
      this.outputChannel.appendLine(`   Suffix length: ${suffix.length} chars`);
      
      const openrouter = createOpenRouter({
        apiKey: this.apiKey,
      });

      const prompt = this.buildPrompt(prefix, suffix, language, filename);

      const { text } = await generateText({
        model: openrouter(this.model),
        prompt,
        maxOutputTokens: 200,
        temperature: 0.2,
        topP: 0.95,
        abortSignal: token.isCancellationRequested
          ? AbortSignal.abort()
          : undefined,
      });

      const duration = Date.now() - startTime;
      this.outputChannel.appendLine(`📥 Response received (${duration}ms)`);
      this.outputChannel.appendLine(`   Raw text length: ${text.length} chars`);

      // Extract only the completion part (remove any explanations)
      const completion = this.extractCompletion(text);
      
      if (completion) {
        this.outputChannel.appendLine(`✅ Completion extracted: ${completion.length} chars`);
        this.outputChannel.appendLine(`   Preview: ${completion.substring(0, 50)}...`);
      } else {
        this.outputChannel.appendLine(`⚠️  No completion extracted`);
      }
      
      return completion;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error.name === "AbortError") {
        this.outputChannel.appendLine(`🚫 Request aborted (${duration}ms)`);
        return null;
      }
      
      this.outputChannel.appendLine(`❌ Generation error (${duration}ms):`);
      this.outputChannel.appendLine(`   ${error.message || error}`);
      if (error.response) {
        this.outputChannel.appendLine(`   Status: ${error.response.status}`);
        this.outputChannel.appendLine(`   Response: ${JSON.stringify(error.response.data)}`);
      }
      
      console.error("Generation error:", error);
      return null;
    }
  }

  private buildPrompt(
    prefix: string,
    suffix: string,
    language: string,
    filename: string
  ): string {
    return `You are an expert code completion AI. Complete the code at the cursor position.

File: ${filename}
Language: ${language}

Code before cursor:
\`\`\`${language}
${prefix}
\`\`\`

Code after cursor:
\`\`\`${language}
${suffix}
\`\`\`

Complete the code at the cursor position. Provide ONLY the completion text, no explanations or markdown. The completion should:
- Be contextually relevant
- Follow the existing code style
- Be a single logical completion (line or statement)
- Not repeat the prefix

Completion:`;
  }

  private extractCompletion(text: string): string {
    // Remove markdown code blocks if present
    let completion = text.replace(/```[\w]*\n?/g, "").trim();

    // Remove common prefixes
    completion = completion.replace(/^(Completion:|Here's the completion:)/i, "").trim();

    // Take only the first few lines (avoid long completions)
    const lines = completion.split("\n");
    if (lines.length > 5) {
      completion = lines.slice(0, 5).join("\n");
    }

    return completion;
  }
}
