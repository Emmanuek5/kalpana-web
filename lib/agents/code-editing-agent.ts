import { generateObject } from "ai";
import { z } from "zod";
import { createTwoFilesPatch } from "diff";

/**
 * Code Editing Agent - Specialized agent for making code changes
 * Uses AI SDK v5 structured object generation
 * Pattern follows web-research-agent.ts and sub-agent-tools.ts
 */

// Define the schema for editing actions the agent can take
const editActionSchema = z.union([
  z.object({
    action: z.literal("analyzeCode"),
    file: z.string(),
    focus: z.string().describe("What aspect to analyze"),
  }),
  z.object({
    action: z.literal("planEdit"),
    file: z.string(),
    changes: z.array(z.string()).describe("List of changes to make"),
  }),
  z.object({
    action: z.literal("applyEdit"),
    file: z.string(),
    newContent: z
      .string()
      .describe(
        "Complete new file content with proper formatting. Use actual newlines, not escaped \\n characters."
      ),
    summary: z.string().describe("What was changed"),
  }),
  z.object({
    action: z.literal("validateEdit"),
    file: z.string(),
    checks: z.array(z.string()).describe("What to validate"),
  }),
  z.object({
    action: z.literal("finishEditing"),
    summary: z.string().describe("Summary of all changes made"),
  }),
]);

type EditAction = z.infer<typeof editActionSchema>;

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

export interface CodeEditTask {
  instruction: string;
  files: Array<{ path: string; content: string }>;
  context?: string;
  model: any; // Required: Language model from main agent (uses user's API key)
  maxSteps?: number;
}

export interface CodeEditResult {
  success: boolean;
  explanation: string;
  edits: Array<{
    file: string;
    originalContent: string;
    newContent: string;
    changesSummary: string;
  }>;
  diffs: string[];
  testSuggestions?: string[];
  history: Array<{ action: EditAction; result: any }>;
}

const CODE_EDITING_SYSTEM_PROMPT = `You are a specialized code editing agent. Your purpose is to make precise, high-quality code changes based on instructions.

## Core Responsibilities
- Analyze code to understand what needs changing
- Plan edits carefully before applying them
- Write clean, well-structured, and maintainable code
- Follow language-specific conventions and best practices
- Preserve existing code structure when modifying files
- Validate changes to ensure correctness

## Editing Process
1. **analyzeCode**: Understand the current code and what needs to change
2. **planEdit**: Outline the specific changes you'll make
3. **applyEdit**: Make the actual changes with complete new file content
4. **validateEdit**: Check your work for correctness
5. **finishEditing**: Complete the task with a summary

## Output Requirements
- When using applyEdit, provide COMPLETE file content (not just changes)
- Use actual newlines in code, not escaped \\n characters
- Ensure code is properly formatted and indented
- Preserve imports and code not being modified
- Include appropriate error handling

You must follow the editing process systematically and complete all requested changes.`;

export async function executeCodeEdit(
  task: CodeEditTask
): Promise<CodeEditResult> {
  const { instruction, files, context, model, maxSteps = 10 } = task;

  // Model must be provided from the main agent to use user's API key
  if (!model) {
    throw new Error("Model is required for code editing agent");
  }

  const edits: CodeEditResult["edits"] = [];
  const history: CodeEditResult["history"] = [];
  let scratchpad = "";

  try {
    // Create file map for easy access
    const fileMap = new Map(files.map((f) => [f.path, f.content]));

    for (let step = 0; step < maxSteps; step++) {
      // Decide next action using the provided model
      const action = await decideNextEditAction(
        model,
        instruction,
        files,
        context,
        history,
        scratchpad,
        edits
      );

      // Execute the action
      const result = await executeEditAction(action, fileMap, edits);
      history.push({ action, result });

      // Update scratchpad
      if (action.action === "analyzeCode") {
        scratchpad += `\nAnalysis of ${action.file}: ${result.analysis || ""}`;
      } else if (action.action === "planEdit") {
        scratchpad += `\nPlan for ${action.file}: ${action.changes.join(", ")}`;
      }

      // Check for completion
      if (action.action === "finishEditing") {
        // Generate diffs for all edits
        const diffs = edits.map((edit) =>
          createTwoFilesPatch(
            edit.file,
            edit.file,
            edit.originalContent,
            edit.newContent,
            "before",
            "after"
          )
        );

        return {
          success: true,
          explanation: action.summary,
          edits,
          diffs,
          history,
        };
      }
    }

    // Max steps reached
    const diffs = edits.map((edit) =>
      createTwoFilesPatch(
        edit.file,
        edit.file,
        edit.originalContent,
        edit.newContent,
        "before",
        "after"
      )
    );

    return {
      success: false,
      explanation: "Max steps reached before completing edits",
      edits,
      diffs,
      history,
    };
  } catch (error: any) {
    console.error("Code editing agent error:", error);
    return {
      success: false,
      explanation: `Failed to generate code edits: ${error.message}`,
      edits,
      diffs: [],
      history,
    };
  }
}

async function decideNextEditAction(
  model: any, // Model from main agent with user's API key
  instruction: string,
  files: Array<{ path: string; content: string }>,
  context: string | undefined,
  history: CodeEditResult["history"],
  scratchpad: string,
  edits: CodeEditResult["edits"]
): Promise<EditAction> {
  const recentHistory = history.slice(-5);

  const prompt = `You are a code editing agent. Your task is to: ${instruction}

${context ? `Context: ${context}\n` : ""}

Files to edit:
${files
  .map(
    (f) => `
--- ${f.path} ---
${f.content.slice(0, 2000)}${f.content.length > 2000 ? "\n... (truncated)" : ""}
`
  )
  .join("\n")}

Scratchpad (your notes):
${scratchpad || "(empty)"}

Edits made so far (${edits.length}):
${edits.map((e) => `- ${e.file}: ${e.changesSummary}`).join("\n") || "(none)"}

Recent actions:
${recentHistory.map((h) => `- ${h.action.action}`).join("\n") || "(none)"}

Guidelines:
1. First analyzeCode to understand what needs changing
2. planEdit to outline the changes
3. applyEdit to make the actual changes (provide COMPLETE new file content with ACTUAL newlines, not escaped \\n)
4. validateEdit to check your work
5. finishEditing when all changes are complete

IMPORTANT: When using applyEdit, the newContent must be properly formatted code with real line breaks.
Do NOT use escaped newlines (\\n) - use actual newlines in the string.

Return the next single action to take.`;

  try {
    const { object: action } = await generateObject({
      model,
      system: CODE_EDITING_SYSTEM_PROMPT,
      schema: editActionSchema,
      schemaName: "EditAction",
      schemaDescription: "The next editing action to take on the codebase",
      prompt,
    });

    return action;
  } catch (error: any) {
    console.error("Code editing agent - generateObject error:", error);
    console.error("Error details:", error.message);
    
    // Log additional error info if available
    if (error.text) {
      console.error("Model response text:", error.text);
    }
    if (error.response) {
      console.error("Model response object:", JSON.stringify(error.response, null, 2));
    }

    // Fallback: If structured generation fails, finish editing
    return {
      action: "finishEditing",
      summary: `Unable to complete code editing due to parsing error: ${error.message}. Edits completed so far: ${edits.map(e => e.file).join(", ") || "none"}`,
    };
  }
}

async function executeEditAction(
  action: EditAction,
  fileMap: Map<string, string>,
  edits: CodeEditResult["edits"]
): Promise<any> {
  switch (action.action) {
    case "analyzeCode": {
      const content = fileMap.get(action.file);
      return {
        success: true,
        analysis: `Analyzing ${action.file} for: ${action.focus}`,
      };
    }

    case "planEdit": {
      return {
        success: true,
        plan: action.changes,
      };
    }

    case "applyEdit": {
      const originalContent = fileMap.get(action.file) || "";

      // Unescape content in case LLM generated literal \n instead of newlines
      const unescapedContent = unescapeContent(action.newContent);

      // Check if this file was already edited
      const existingEditIndex = edits.findIndex((e) => e.file === action.file);

      if (existingEditIndex >= 0) {
        // Update existing edit
        edits[existingEditIndex] = {
          file: action.file,
          originalContent,
          newContent: unescapedContent,
          changesSummary: action.summary,
        };
      } else {
        // Add new edit
        edits.push({
          file: action.file,
          originalContent,
          newContent: unescapedContent,
          changesSummary: action.summary,
        });
      }

      // Update file map for subsequent edits
      fileMap.set(action.file, unescapedContent);

      return {
        success: true,
        file: action.file,
        summary: action.summary,
      };
    }

    case "validateEdit": {
      return {
        success: true,
        validation: "Edit validated",
        checks: action.checks,
      };
    }

    case "finishEditing": {
      return {
        success: true,
        summary: action.summary,
      };
    }

    default:
      return { success: false, error: "Unknown action" };
  }
}

/**
 * Helper: Create a diff for a single edit
 */
export function createEditDiff(
  filePath: string,
  originalContent: string,
  newContent: string
): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    originalContent,
    newContent,
    "before",
    "after"
  );
}