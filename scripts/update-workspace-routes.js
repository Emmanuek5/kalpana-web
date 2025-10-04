const fs = require('fs');
const path = require('path');

// Base directory for workspace API routes
const baseDir = path.join(__dirname, '..', 'app', 'api', 'workspaces', '[id]');

// Helper function to update a file
function updateFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if the file already imports the helper
  if (!content.includes('import { authorizeWorkspaceAccess }')) {
    // Add the import
    content = content.replace(
      /import.*from.*next\/server.*;\s*import.*from.*@\/lib\/auth.*;\s*/,
      match => `${match}import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";\n`
    );
  }
  
  // Replace workspace authorization code
  // Pattern 1: Direct user ownership check
  content = content.replace(
    /const\s+workspace\s*=\s*await\s+prisma\.workspace\.findFirst\(\s*{\s*where:\s*{\s*id[^}]*userId:\s*session\.user\.id[^}]*},\s*}\s*\);\s*\n\s*if\s*\(\s*!workspace\s*\)\s*{\s*return\s*(?:NextResponse\.json|new\s+Response)\(\s*(?:{\s*error:\s*"[^"]*"\s*}|"[^"]*")\s*,\s*{\s*status:\s*404\s*}\s*\);\s*}/g,
    `// Verify user has access to this workspace
    const workspace = await authorizeWorkspaceAccess(id, session.user.id);
    if (!workspace) {
      return new Response("You are not authorized to access this workspace", { status: 403 });
    }`
  );
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filePath}`);
}

// Function to recursively process directories
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name === 'route.ts') {
      updateFile(fullPath);
    }
  }
}

// Start processing
console.log('Starting workspace routes update...');
processDirectory(baseDir);
console.log('Workspace routes update complete!');
