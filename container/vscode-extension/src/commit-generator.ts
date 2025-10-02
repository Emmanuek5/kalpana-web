import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Generate AI-powered commit message based on staged changes
 */
export async function generateCommitMessage(): Promise<string> {
  try {
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const cwd = workspaceFolder.uri.fsPath;

    // Get staged changes
    const { stdout: diff } = await execAsync('git diff --staged', { cwd });

    if (!diff.trim()) {
      throw new Error('No staged changes to commit. Please stage your changes first.');
    }

    // Limit diff size to avoid token limits (first 30000 chars)
    const truncatedDiff = diff.length > 30000 
      ? diff.substring(0, 30000) + '\n... (diff truncated)'
      : diff;

    // Get OpenRouter API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const openrouter = createOpenRouter({ apiKey });

    // Generate commit message
    const { text } = await generateText({
      model: openrouter('x-ai/grok-4-fast:free'),
      prompt: `Generate a concise git commit message for these changes:

${truncatedDiff}

Rules:
- Use conventional commit format: type(scope): message
- Types: feat, fix, docs, style, refactor, test, chore
- Keep the first line under 72 characters
- Be specific about what changed
- Focus on the "what" and "why", not the "how"
- If multiple files changed, focus on the main change
- Use present tense ("add" not "added")

Examples:
- feat(auth): add JWT token validation
- fix(api): handle null response in user endpoint
- refactor(ui): extract button component
- docs(readme): update installation instructions

Return ONLY the commit message, nothing else.`,
      maxOutputTokens: 1000,
    });

    return text.trim();
  } catch (error: any) {
    throw new Error(`Failed to generate commit message: ${error.message}`);
  }
}

/**
 * Get git repository for the current workspace
 */
export async function getGitRepository(): Promise<any> {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    throw new Error('Git extension not found');
  }

  const git = gitExtension.isActive 
    ? gitExtension.exports 
    : await gitExtension.activate();

  const api = git.getAPI(1);
  
  if (api.repositories.length === 0) {
    throw new Error('No git repository found');
  }

  return api.repositories[0];
}
