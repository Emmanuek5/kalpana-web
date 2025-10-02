import * as vscode from "vscode";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export class KalpanaInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private apiKey: string = "";
  private model: string = "google/gemma-3-27b-it:free";
  private debounceTimer: NodeJS.Timeout | undefined;
  private lastRequest: { document: string; position: string } | null = null;
  private outputChannel: vscode.OutputChannel;
  private cache: Map<string, { completion: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Kalpana Autocomplete");
    this.outputChannel.appendLine("🚀 Kalpana Autocomplete initialized");
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
    this.cache.clear();
    this.outputChannel.appendLine(`🔄 API key updated, Model=${this.model}`);
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    if (!this.apiKey) {
      return null;
    }

    // Allow manual invocation but skip if user is actively typing
    const line = document.lineAt(position.line);
    const currentChar = line.text[position.character - 1];
    
    // Skip if user just typed whitespace (except newline)
    if (currentChar === ' ' || currentChar === '\t') {
      return null;
    }

    const currentRequest = {
      document: document.uri.toString(),
      position: `${position.line}:${position.character}`,
    };

    // Check if this is a duplicate request
    if (
      this.lastRequest &&
      this.lastRequest.document === currentRequest.document &&
      this.lastRequest.position === currentRequest.position
    ) {
      return null;
    }

    this.lastRequest = currentRequest;

    try {
      const prefix = this.getPrefix(document, position);
      const suffix = this.getSuffix(document, position);

      // Smart validation of when to trigger
      if (!this.shouldTriggerCompletion(prefix, suffix, position, line)) {
        return null;
      }

      const language = document.languageId;
      const filename = document.fileName.split("/").pop() || "";

      // Check cache first
      const cacheKey = this.getCacheKey(prefix, suffix, language);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.outputChannel.appendLine(`💾 Cache hit!`);
        return [new vscode.InlineCompletionItem(cached, new vscode.Range(position, position))];
      }

      const completion = await this.generateCompletion(
        prefix,
        suffix,
        language,
        filename,
        position,
        token
      );

      if (!completion || token.isCancellationRequested) {
        return null;
      }

      // Cache the result
      this.addToCache(cacheKey, completion);

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

  private shouldTriggerCompletion(
    prefix: string,
    suffix: string,
    position: vscode.Position,
    line: vscode.TextLine
  ): boolean {
    const trimmedPrefix = prefix.trim();
    
    // Need minimum context
    if (trimmedPrefix.length < 3) {
      return false;
    }

    const lastLine = prefix.split('\n').slice(-1)[0] || '';
    const lineBeforeCursor = line.text.substring(0, position.character);
    
    // Don't trigger in the middle of a word
    if (lineBeforeCursor.match(/[a-zA-Z0-9_]$/)) {
      const nextChar = line.text[position.character];
      if (nextChar && nextChar.match(/[a-zA-Z0-9_]/)) {
        return false;
      }
    }

    // Good trigger points
    const goodTriggers = [
      /[{(\[,]\s*$/,           // After opening brackets or commas
      /^\s*(if|for|while|function|const|let|var|def|class|import|from)\s+/i,  // After keywords
      /[:=]\s*$/,              // After assignment or type annotations
      /^[\s]*$/,               // Empty line (new statement)
      /\/\/\s*$/,              // After comment start
      /\.\s*$/,                // After dot (method calls)
      /=>\s*$/,                // After arrow function
    ];

    for (const pattern of goodTriggers) {
      if (lastLine.match(pattern)) {
        return true;
      }
    }

    // Don't trigger in strings unless it looks like interpolation
    const inString = this.isInString(lastLine);
    if (inString && !lastLine.match(/\$\{$/)) {
      return false;
    }

    // Trigger if line has some code and cursor is at end or followed by closing bracket
    const nextChar = line.text[position.character];
    if (lastLine.trim().length > 2 && (!nextChar || nextChar.match(/[)\]};\s]/))) {
      return true;
    }

    return false;
  }

  private isInString(line: string): boolean {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
      }
    }

    return inSingleQuote || inDoubleQuote || inTemplate;
  }

  private getPrefix(document: vscode.TextDocument, position: vscode.Position): string {
    const maxLines = 50;
    const startLine = Math.max(0, position.line - maxLines);
    const range = new vscode.Range(new vscode.Position(startLine, 0), position);
    return document.getText(range);
  }

  private getSuffix(document: vscode.TextDocument, position: vscode.Position): string {
    const maxLines = 20;
    const endLine = Math.min(document.lineCount - 1, position.line + maxLines);
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
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    const startTime = Date.now();
    
    try {
      this.outputChannel.appendLine(`\n📤 Request to OpenRouter:`);
      this.outputChannel.appendLine(`   Model: ${this.model}`);
      this.outputChannel.appendLine(`   File: ${filename} (${language})`);
      
      const openrouter = createOpenRouter({
        apiKey: this.apiKey,
      });

      const prompt = this.buildPrompt(prefix, suffix, language, filename);

      const { text } = await generateText({
        model: openrouter(this.model),
        prompt,
        temperature: 0.3,
        topP: 0.9,
       maxOutputTokens:200,
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
        abortSignal: token.isCancellationRequested ? AbortSignal.abort() : undefined,
      });

      const duration = Date.now() - startTime;
      this.outputChannel.appendLine(`📥 Response received (${duration}ms)`);
      
      const completion = this.cleanCompletion(text, prefix);
      
      if (completion) {
        this.outputChannel.appendLine(`✅ Completion: ${completion.length} chars`);
        const preview = completion.replace(/\n/g, '\\n').substring(0, 80);
        this.outputChannel.appendLine(`   "${preview}${completion.length > 80 ? '...' : ''}"`);
      } else {
        this.outputChannel.appendLine(`⚠️  No valid completion`);
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
      
      return null;
    }
  }

  private buildPrompt(prefix: string, suffix: string, language: string, filename: string): string {
    const lastLine = prefix.split('\n').slice(-1)[0] || '';
    const indentation = lastLine.match(/^\s*/)?.[0] || '';
    
    // Analyze context for smarter completions
    const context = this.analyzeContext(prefix, suffix, language);
    
    let prompt = `Complete the ${language} code at <CURSOR>. Provide only the completion text.

File: ${filename}
Context: ${context}

\`\`\`${language}
${prefix}<CURSOR>${suffix}
\`\`\`

Rules:
- Return ONLY the code to insert at <CURSOR>
- NO markdown, explanations, or comments about the completion
- Maintain ${indentation.length} space indentation
- Do NOT repeat prefix code
- Complete only 1-3 lines unless completing a clear multi-line structure
- Match the existing code style exactly`;

    return prompt;
  }

  private analyzeContext(prefix: string, suffix: string, language: string): string {
    const lastLine = prefix.split('\n').slice(-1)[0] || '';
    const contexts: string[] = [];

    // Detect what we're completing
    if (lastLine.match(/^\s*(function|def|async function|const.*=.*=>)/)) {
      contexts.push("function definition");
    } else if (lastLine.match(/^\s*(class|interface|type)\s+/)) {
      contexts.push("type definition");
    } else if (lastLine.match(/^\s*(if|else|for|while|switch)\s*\(/)) {
      contexts.push("control flow");
    } else if (lastLine.match(/\.\s*$/)) {
      contexts.push("method/property access");
    } else if (lastLine.match(/[{(\[]\s*$/)) {
      contexts.push("inside brackets");
    } else if (lastLine.match(/[:=]\s*$/)) {
      contexts.push("assignment/value");
    } else if (lastLine.match(/^\s*$/)) {
      contexts.push("new statement");
    }

    // Check if we need closing brackets
    const openBrackets = (prefix.match(/[{[(]/g) || []).length;
    const closeBrackets = (prefix.match(/[}\])]/g) || []).length;
    if (openBrackets > closeBrackets) {
      contexts.push("needs closing");
    }

    return contexts.length > 0 ? contexts.join(", ") : "general";
  }

  private cleanCompletion(text: string, prefix: string): string {
    let completion = text.trim();

    // Remove markdown and common prefixes
    completion = completion
      .replace(/```[\w]*\n?/g, "")
      .replace(/^(Completion:|Here'?s? the completion:?|Here is the code:?|The completion is:?)/i, "")
      .trim();

    // Remove explanation lines
    const lines = completion.split("\n");
    const codeLines: string[] = [];
    
    for (const line of lines) {
      if (line.match(/^(This |The |Note:|Explanation:|I |You should|Remember|Make sure)/i)) {
        break;
      }
      // Skip lines that look like explanations in comments
      if (line.match(/^\/\/\s*(This|The|Note|Explanation)/i)) {
        continue;
      }
      codeLines.push(line);
    }
    
    completion = codeLines.join("\n");

    // Limit length
    if (codeLines.length > 5) {
      completion = codeLines.slice(0, 5).join("\n");
    }

    // Remove if it repeats the prefix
    const lastPrefixLine = prefix.split('\n').slice(-1)[0] || '';
    if (completion.startsWith(lastPrefixLine.trim())) {
      return "";
    }

    // Clean up whitespace
    completion = completion.replace(/^\n+/, "").replace(/\n+$/, "");

    if (!completion || completion.length < 2) {
      return "";
    }

    return completion;
  }

  // Cache management
  private getCacheKey(prefix: string, suffix: string, language: string): string {
    // Use last 200 chars of prefix and first 100 of suffix for cache key
    const prefixKey = prefix.slice(-200);
    const suffixKey = suffix.slice(0, 100);
    return `${language}:${prefixKey}:${suffixKey}`;
  }

  private getFromCache(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.completion;
  }

  private addToCache(key: string, completion: string): void {
    // Clean old cache entries
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now - v.timestamp > this.CACHE_TTL) {
        this.cache.delete(k);
      }
    }

    // Limit cache size
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { completion, timestamp: now });
  }
}