import { generateObject } from "ai";
import { z } from "zod";
import { createTwoFilesPatch } from "diff";

/**
 * Code Editing Agent - Simplified single-shot editing
 * Pattern follows sub-agent-tools.ts for better reliability
 */

const CODE_EDITING_SYSTEM_PROMPT = `You are a specialized code editing agent. Your purpose is to make precise, high-quality code changes based on instructions.

## Core Responsibilities
- Write clean, well-structured, and maintainable code
- Follow language-specific conventions and best practices
- Implement the exact functionality requested in the instruction
- Preserve existing code structure when modifying files
- Add appropriate comments and documentation
- Ensure code is production-ready and error-free

## Editing Guidelines
- **For new files**: Create complete, functional code from scratch
- **For existing files**: Make precise modifications while preserving the existing structure
- **Always preserve**: Imports, existing functions/classes that aren't being modified
- **Code quality**: Use proper indentation, naming conventions, and organize code logically
- **Error handling**: Include appropriate error handling where needed
- **Dependencies**: Only use dependencies that are available or commonly installed

## Output Requirements
- Return the COMPLETE file content (not just changes)
- Provide a clear summary of what was implemented or modified
- If the instruction is unclear or impossible, explain why in the summary
- Ensure the output is immediately usable without further editing
- **CRITICAL**: You MUST return valid JSON with the following structure:
  {
    "content": "the complete file content as a string",
    "summary": "description of changes",
    "success": true,
    "warnings": []
  }
- The "content" field must contain the raw file content as a properly escaped JSON string
- DO NOT include markdown code blocks (no \`\`\`), return the content as a plain string value
- All newlines in content must be actual newlines (\\n), not literal newline characters
- All quotes in content must be properly escaped

## Language-Specific Rules
- **JavaScript/TypeScript**: Use modern ES6+ syntax, proper typing for TS
- **Python**: Follow PEP 8 conventions, use type hints where appropriate
- **JSON**: Ensure valid JSON structure with proper formatting
- **Configuration files**: Maintain proper format and structure

## IMPORTANT
When returning the file content, do NOT wrap it in markdown code blocks like \`\`\`javascript or \`\`\`typescript.
Return the raw code directly as a string. The content field should contain ONLY the file content, not any markdown formatting.`;

const FileEditSchema = z.object({
  content: z.string().describe("The complete file content"),
  summary: z
    .string()
    .describe("A clear summary of what was implemented or modified"),
  success: z.boolean().describe("Whether the task was completed successfully"),
  warnings: z
    .array(z.string())
    .optional()
    .describe("Any warnings or concerns about the implementation"),
});

export interface CodeEditTask {
  instruction: string;
  files: Array<{ path: string; content: string }>;
  context?: string;
  model: any; // Required: Language model from main agent (uses user's API key)
}

export interface CodeEditResult {
  success: boolean;
  explanation: string;
  edits: Array<{
    file: string;
    originalContent: string;
    newContent: string;
    changesSummary: string;
    linesAdded: number;
    linesRemoved: number;
  }>;
  diffs: string[];
  warnings?: string[];
}

export async function executeCodeEdit(
  task: CodeEditTask
): Promise<CodeEditResult> {
  const { instruction, files, context, model } = task;

  // Model must be provided from the main agent to use user's API key
  if (!model) {
    throw new Error("Model is required for code editing agent");
  }

  const edits: CodeEditResult["edits"] = [];
  const diffs: string[] = [];
  const allWarnings: string[] = [];

  try {
    // Process each file
    for (const file of files) {
      const fileType = getFileType(file.path);
      
      // Prepare the prompt
      const prompt = `File: ${file.path} (${fileType})

Existing content:
\`\`\`
${file.content}
\`\`\`

Instruction: ${instruction}

${context ? `Additional context: ${context}` : ""}

Please modify the file according to the instruction. Return the complete modified file content and a summary of changes.`;

      // Generate the edited content with better error handling
      let result;
      try {
        result = await generateObject({
          model,
          system: CODE_EDITING_SYSTEM_PROMPT,
          prompt,
          schema: FileEditSchema,
          schemaName: "FileEdit",
          schemaDescription: "The edited file content and summary",
          mode: "json", // Force JSON mode for better reliability
        });
      } catch (parseError: any) {
        // If JSON parsing fails, it might be because the model returned raw code
        console.error(`JSON parse error for ${file.path}:`, parseError.message);
        allWarnings.push(`Failed to parse response for ${file.path}: ${parseError.message}`);
        continue; // Skip this file
      }

      if (result.object && result.object.success) {
        // Sanitize the content to remove any markdown formatting
        let newContent = sanitizeCodeContent(result.object.content);
        
        const oldLines = file.content.split("\n");
        const newLines = newContent.split("\n");
        
        const linesAdded = Math.max(0, newLines.length - oldLines.length);
        const linesRemoved = Math.max(0, oldLines.length - newLines.length);

        // Create diff
        const diff = createTwoFilesPatch(
          file.path,
          file.path,
          file.content,
          newContent,
          "before",
          "after"
        );

        edits.push({
          file: file.path,
          originalContent: file.content,
          newContent,
          changesSummary: result.object.summary,
          linesAdded,
          linesRemoved,
        });

        diffs.push(diff);

        if (result.object.warnings && result.object.warnings.length > 0) {
          allWarnings.push(...result.object.warnings);
        }
      } else {
        // Partial failure - include in warnings
        allWarnings.push(`Failed to edit ${file.path}: ${result.object.summary}`);
      }
    }

    // Generate overall explanation
    const explanation = edits.length > 0
      ? `Successfully edited ${edits.length} file(s):\n${edits
          .map(
            (e) =>
              `- ${e.file}: ${e.changesSummary} (+${e.linesAdded} -${e.linesRemoved})`
          )
          .join("\n")}`
      : "No files were successfully edited";

    return {
      success: edits.length > 0,
      explanation,
      edits,
      diffs,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  } catch (error: any) {
    console.error("Code editing agent error:", error);
    return {
      success: false,
      explanation: `Failed to generate code edits: ${error.message}`,
      edits: [],
      diffs: [],
      warnings: [error.message],
    };
  }
}

/**
 * Sanitize content by stripping markdown code blocks and other formatting
 * This ensures we get clean code even if the model doesn't follow instructions perfectly
 */
function sanitizeCodeContent(content: string): string {
  let cleaned = content;
  
  // Remove markdown code fences with language specifier (```typescript ... ```)
  const fullBlockMatch = cleaned.match(/^```[\w]*\n([\s\S]*?)\n```$/);
  if (fullBlockMatch) {
    cleaned = fullBlockMatch[1];
  }
  
  // Remove opening fence if present
  cleaned = cleaned.replace(/^```[\w]*\n/, '');
  
  // Remove closing fence if present
  cleaned = cleaned.replace(/\n```$/, '');
  
  // Remove single backticks around the entire content
  if (cleaned.startsWith('`') && cleaned.endsWith('`')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Trim any excessive whitespace at start/end
  cleaned = cleaned.trim();
  
  return cleaned;
}

function getFileType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  
  const typeMap: Record<string, string> = {
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "React JSX",
    tsx: "React TSX",
    py: "Python",
    json: "JSON",
    md: "Markdown",
    txt: "Text",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    yaml: "YAML",
    yml: "YAML",
    xml: "XML",
    sh: "Shell Script",
    sql: "SQL",
  };

  return typeMap[ext] || "Unknown";
}
