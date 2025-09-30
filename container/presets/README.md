# Code Server Presets

This directory contains preset configurations for code-server workspaces. Each preset includes:

- **settings.json**: VS Code user settings (theme, editor preferences, etc.)
- **extensions.json**: List of recommended extensions to auto-install

## Available Presets

### 1. **default** (Recommended)

A comprehensive setup with modern theme and essential extensions for web development.

**Features:**

- Theme: One Dark Pro
- Font: JetBrains Mono with ligatures
- Extensions: Prettier, ESLint, Tailwind CSS, GitLens, Error Lens, and more
- Auto-save, format on save, bracket colorization
- Optimized for JavaScript/TypeScript development

### 2. **minimal**

A lightweight setup with only essential features.

**Features:**

- Theme: Visual Studio Dark (built-in)
- Extensions: Prettier, ESLint only
- Basic editor settings
- Best for: Quick prototyping, low-resource environments

### 3. **fullstack**

Comprehensive setup for full-stack development with multiple languages.

**Features:**

- Theme: One Dark Pro with Material Icons
- Extensions: JS/TS, Python, Prisma, GitLens
- Multi-language support (JavaScript, TypeScript, Python)
- Database tools (Prisma)

## Using Presets

Presets are automatically applied when creating a workspace by setting the `PRESET` environment variable:

```bash
docker run -e PRESET=default kalpana/workspace:latest
```

Available values: `default`, `minimal`, `fullstack`, `custom`

## Creating Custom Presets

1. Create a new directory in `presets/` with your preset name:

   ```bash
   mkdir presets/mypreset
   ```

2. Add `settings.json` with your VS Code settings:

   ```json
   {
     "workbench.colorTheme": "Your Theme",
     "editor.fontSize": 14,
     ...
   }
   ```

3. Add `extensions.json` with extension IDs:

   ```json
   {
     "recommendations": [
       "publisher.extension-name",
       ...
     ]
   }
   ```

4. Rebuild the Docker image to include your preset

## Extension Installation

Extensions are automatically installed from the VS Code marketplace when:

- The workspace starts for the first time
- The preset is changed
- Extensions are missing

Popular extensions included in presets:

- **zhuangtongfa.material-theme**: One Dark Pro theme
- **pkief.material-icon-theme**: Material Icon Theme
- **esbenp.prettier-vscode**: Code formatter
- **dbaeumer.vscode-eslint**: ESLint integration
- **bradlc.vscode-tailwindcss**: Tailwind CSS IntelliSense
- **eamodio.gitlens**: Enhanced Git features
- **usernamehw.errorlens**: Inline error highlighting

## Settings Customization

Common settings you can customize:

### Theme & Appearance

- `workbench.colorTheme`: Color theme
- `workbench.iconTheme`: File icon theme
- `editor.fontSize`: Editor font size
- `editor.fontFamily`: Editor font family
- `editor.fontLigatures`: Enable font ligatures

### Editor Behavior

- `editor.formatOnSave`: Auto-format on save
- `files.autoSave`: Auto-save mode
- `editor.tabSize`: Spaces per tab
- `editor.wordWrap`: Word wrap setting

### Terminal

- `terminal.integrated.fontSize`: Terminal font size
- `terminal.integrated.fontFamily`: Terminal font
- `terminal.integrated.defaultProfile.linux`: Default shell

## Notes

- Settings are applied to `~/.local/share/code-server/User/settings.json`
- Extensions are installed to `~/.local/share/code-server/extensions/`
- Presets can be overridden by user settings in the workspace
- Custom presets require rebuilding the Docker image
