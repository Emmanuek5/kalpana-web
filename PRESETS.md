# VS Code Presets System

## Overview

The VS Code Presets system allows you to create consistent editor configurations across all your workspace containers. Each workspace can use a built-in preset or a custom user-created preset with specific themes, settings, and extensions.

## Features

✅ **Built-in Presets**: Three pre-configured presets ready to use
✅ **Custom Presets**: Create your own presets with custom settings and extensions  
✅ **Automatic Installation**: Settings and extensions are automatically applied on container startup
✅ **Persistent Configuration**: Each workspace remembers its selected preset
✅ **Easy Management**: Web-based UI for creating and managing presets

## Built-in Presets

### 1. Default

**Best for**: General web development

**Theme**: One Dark Pro  
**Font**: JetBrains Mono with ligatures

**Includes**:

- Prettier (code formatter)
- ESLint (linting)
- Tailwind CSS IntelliSense
- GitLens (enhanced Git)
- Error Lens (inline errors)
- Material Icon Theme
- Auto Rename Tag
- Path IntelliSense
- VS Code IntelliCode

### 2. Minimal

**Best for**: Quick prototyping, low-resource environments

**Theme**: Visual Studio Dark (built-in)  
**Font**: Default

**Includes**:

- Prettier (code formatter)
- ESLint (linting)

### 3. Full Stack

**Best for**: Full-stack development with multiple languages

**Theme**: One Dark Pro with Material Icons  
**Font**: JetBrains Mono

**Includes**:

- All Default extensions
- Python support (Python + Pylance)
- Prisma support
- Multi-language formatters

## Creating Custom Presets

### Step 1: Navigate to Presets

1. Go to Dashboard > Presets
2. Click "Create Preset"

### Step 2: Configure Your Preset

**Name**: Give it a memorable name (e.g., "My Python Setup")

**Description**: Brief description of what it's for

**Settings (JSON)**: Your VS Code settings

```json
{
  "workbench.colorTheme": "One Dark Pro",
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', monospace",
  "editor.fontLigatures": true,
  "editor.formatOnSave": true,
  "files.autoSave": "afterDelay"
}
```

**Extensions**: Add extensions by their marketplace ID

- Format: `publisher.extension-name`
- Example: `esbenp.prettier-vscode`

### Step 3: Use in Workspaces

When creating a new workspace:

1. Select your template (Node, Python, etc.)
2. Scroll to "Choose VS Code Preset"
3. Select your custom preset under "Your Custom Presets"

## Popular Extensions

### Themes

- `zhuangtongfa.material-theme` - One Dark Pro
- `pkief.material-icon-theme` - Material Icon Theme
- `github.github-vscode-theme` - GitHub Theme

### Code Quality

- `esbenp.prettier-vscode` - Prettier
- `dbaeumer.vscode-eslint` - ESLint
- `usernamehw.errorlens` - Error Lens

### Git

- `eamodio.gitlens` - GitLens

### Languages

- `ms-python.python` - Python
- `ms-python.vscode-pylance` - Pylance
- `rust-lang.rust-analyzer` - Rust
- `golang.go` - Go
- `bradlc.vscode-tailwindcss` - Tailwind CSS

### Productivity

- `formulahendry.auto-rename-tag` - Auto Rename Tag
- `christian-kohler.path-intellisense` - Path IntelliSense
- `visualstudioexptteam.vscodeintellicode` - IntelliCode

## Common Settings

### Editor

```json
{
  "editor.fontSize": 14,
  "editor.fontFamily": "'JetBrains Mono', 'Cascadia Code', monospace",
  "editor.fontLigatures": true,
  "editor.lineHeight": 1.6,
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.minimap.enabled": true,
  "editor.bracketPairColorization.enabled": true,
  "editor.wordWrap": "on"
}
```

### Files

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
```

### Terminal

```json
{
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.fontFamily": "'JetBrains Mono', monospace",
  "terminal.integrated.cursorBlinking": true
}
```

## Technical Details

### How It Works

1. **Selection**: User selects a preset when creating a workspace
2. **Storage**: Workspace stores the preset ID in the database
3. **Container Start**: On container startup, the `start.sh` script:
   - Checks if it's a built-in preset (default/minimal/fullstack)
   - Or a custom preset (MongoDB ObjectId)
4. **Built-in Presets**:
   - Settings copied from `/presets/{preset_name}/settings.json`
   - Extensions parsed from `/presets/{preset_name}/extensions.json`
5. **Custom Presets**:
   - Settings and extensions fetched from database
   - Passed as environment variables to container
   - Applied by start script
6. **Application**:
   - Settings written to `~/.local/share/code-server/User/settings.json`
   - Extensions installed via `code-server --install-extension`

### File Locations

**In Container**:

- Built-in presets: `/presets/{name}/`
- Applied settings: `~/.local/share/code-server/User/settings.json`
- Extensions: `~/.local/share/code-server/extensions/`

**In Codebase**:

- Preset configurations: `kalpana/container/presets/`
- Database schema: `kalpana/prisma/schema.prisma` (Preset model)
- API routes: `kalpana/app/api/presets/`
- UI: `kalpana/app/dashboard/presets/page.tsx`

### Database Schema

```prisma
model Preset {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  description String?
  settings    String   // JSON string
  extensions  String[]
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

## Limits

- **Custom Presets**: Maximum 10 per user
- **Extensions**: No hard limit, but keep it reasonable for startup performance

## Tips

1. **Start Simple**: Begin with a built-in preset and customize from there
2. **Test Extensions**: Create a preset with new extensions before rolling out widely
3. **Document**: Add good descriptions to help future you remember the purpose
4. **Share Settings**: Export your preset settings to share with team members
5. **Performance**: Minimize extensions for faster container startup times

## Troubleshooting

### Extensions Not Installing

- Check internet connectivity in container
- Verify extension IDs are correct (use VS Code marketplace)
- Check startup logs for installation errors

### Settings Not Applied

- Verify JSON syntax is valid
- Check container logs for errors
- Ensure settings are compatible with code-server

### Custom Preset Not Found

- Verify preset wasn't deleted
- Check preset belongs to your user account
- Try using a built-in preset as fallback

## Future Enhancements

- [ ] Import/export presets as JSON
- [ ] Preset templates marketplace
- [ ] Team-shared presets
- [ ] Preset versioning
- [ ] Preview mode before applying

## Support

For issues or feature requests related to presets, please open an issue on the repository.
