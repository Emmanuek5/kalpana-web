#!/usr/bin/env sh

set -e

echo "🚀 Starting Kalpana Workspace..."
echo "Workspace ID: $WORKSPACE_ID"

# Change to workspace directory
cd /workspace

# Configure git credentials and user info
echo "🔑 Configuring Git..."

# Configure GitHub token if available
if [ -n "$GITHUB_TOKEN" ]; then
    echo "🔑 Setting up GitHub credentials..."
    
    # Configure git to use the token for GitHub
    git config --global credential.helper store
    echo "https://${GITHUB_TOKEN}@github.com" > ~/.git-credentials
    chmod 600 ~/.git-credentials
    
    # Try to fetch user info from GitHub API
    if command -v curl >/dev/null 2>&1; then
        USER_INFO=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/user)
        GIT_NAME=$(echo "$USER_INFO" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        GIT_EMAIL=$(echo "$USER_INFO" | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
        
        if [ -n "$GIT_NAME" ]; then
            git config --global user.name "$GIT_NAME"
            echo "✅ Git user.name set to: $GIT_NAME (from GitHub)"
        fi
        
        if [ -n "$GIT_EMAIL" ] && [ "$GIT_EMAIL" != "null" ]; then
            git config --global user.email "$GIT_EMAIL"
            echo "✅ Git user.email set to: $GIT_EMAIL (from GitHub)"
        else
            # Try to fetch email from GitHub emails API
            PRIMARY_EMAIL=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/user/emails | grep -o '"email":"[^"]*","primary":true' | cut -d'"' -f4)
            if [ -n "$PRIMARY_EMAIL" ]; then
                git config --global user.email "$PRIMARY_EMAIL"
                echo "✅ Git user.email set to: $PRIMARY_EMAIL (from GitHub)"
            fi
        fi
    fi
    
    echo "✅ Git configured for GitHub authentication"
fi

# Fallback to environment variables if git user info not set
CURRENT_GIT_NAME=$(git config --global user.name)
CURRENT_GIT_EMAIL=$(git config --global user.email)

if [ -z "$CURRENT_GIT_NAME" ] && [ -n "$GIT_USER_NAME" ]; then
    git config --global user.name "$GIT_USER_NAME"
    echo "✅ Git user.name set to: $GIT_USER_NAME (from account)"
fi

if [ -z "$CURRENT_GIT_EMAIL" ] && [ -n "$GIT_USER_EMAIL" ]; then
    git config --global user.email "$GIT_USER_EMAIL"
    echo "✅ Git user.email set to: $GIT_USER_EMAIL (from account)"
fi

# Final fallback if still not set
CURRENT_GIT_NAME=$(git config --global user.name)
CURRENT_GIT_EMAIL=$(git config --global user.email)

if [ -z "$CURRENT_GIT_NAME" ]; then
    git config --global user.name "Kalpana User"
    echo "⚠️ Git user.name set to default: Kalpana User"
fi

if [ -z "$CURRENT_GIT_EMAIL" ]; then
    git config --global user.email "user@kalpana.local"
    echo "⚠️ Git user.email set to default: user@kalpana.local"
fi

# Clone GitHub repo if specified (accept owner/repo or full URL)
if [ -n "$GITHUB_REPO" ] && [ ! -d ".git" ]; then
    # Only clone if workspace is empty to avoid 'destination path . exists'
    if [ -z "$(ls -A /workspace 2>/dev/null)" ]; then
    RAW_REPO="$GITHUB_REPO"
    # Keep only safe ASCII URL/path characters to strip zero-width/invisible chars
    SANITIZED=$(printf "%s" "$RAW_REPO" | LC_ALL=C tr -cd 'A-Za-z0-9/_\.-:@')
    # Trim trailing slashes
    SANITIZED=$(printf "%s" "$SANITIZED" | sed -E 's#/*$##')

    # Derive owner/repo
    if echo "$SANITIZED" | grep -qi '^\(git@\|https\?://\)\?github\.com'; then
        # Drop scheme/host and optional .git, keep only first two segments
        REPO_PATH=$(printf "%s" "$SANITIZED" \
          | sed -E 's#^(git@|https?://)?github.com[:/]+##I' \
          | sed -E 's#\.git$##I' \
          | cut -d'/' -f1-2)
    else
        # owner/repo or owner/repo.git
        REPO_PATH=$(printf "%s" "$SANITIZED" \
          | sed -E 's#^/+##' \
          | sed -E 's#\.git$##I' \
          | cut -d'/' -f1-2)
    fi

    if echo "$REPO_PATH" | grep -q '/'; then
        echo "📦 Cloning repository: $REPO_PATH"
        if [ -n "$GITHUB_TOKEN" ]; then
            REPO_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"
        else
            REPO_URL="https://github.com/${REPO_PATH}.git"
        fi
        git clone "$REPO_URL" . || echo "❌ Git clone failed for $REPO_URL"
        [ -d ".git" ] && echo "✅ Repository cloned successfully"
    else
        echo "⚠️ Invalid repository format: '$RAW_REPO'. Expected 'owner/repo' or a GitHub URL."
    fi
    else
        echo "ℹ️ Skipping clone because /workspace is not empty"
    fi
fi

# Apply Nix configuration if specified
if [ ! -z "$NIX_CONFIG" ]; then
    echo "🔧 Applying Nix configuration..."
    echo "$NIX_CONFIG" > /workspace/shell.nix
    # Enter nix-shell for the session
    # Note: This doesn't persist for code-server, but sets up the environment
    nix-shell /workspace/shell.nix --run "echo '✅ Nix environment configured'"
fi

# Apply template if specified
if [ ! -z "$TEMPLATE" ] && [ "$TEMPLATE" != "custom" ]; then
    echo "📋 Applying template: $TEMPLATE"
    
    case "$TEMPLATE" in
        "node")
            cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    nodePackages.npm
    nodePackages.pnpm
    bun
  ];
  
  shellHook = ''
    echo "🚀 Node.js environment ready!"
    node --version
    npm --version
  '';
}
EOF
            ;;
        "python")
            cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python311
    python311Packages.pip
    python311Packages.virtualenv
  ];
  
  shellHook = ''
    echo "🐍 Python environment ready!"
    python --version
  '';
}
EOF
            ;;
        "rust")
            cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    rustc
    cargo
    rustfmt
    clippy
  ];
  
  shellHook = ''
    echo "🦀 Rust environment ready!"
    rustc --version
    cargo --version
  '';
}
EOF
            ;;
        "go")
            cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    go
    gopls
  ];
  
  shellHook = ''
    echo "🐹 Go environment ready!"
    go version
  '';
}
EOF
            ;;
        "fullstack")
            cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    python311
    postgresql
    redis
  ];
  
  shellHook = ''
    echo "🎯 Full-stack environment ready!"
    node --version
    python --version
  '';
}
EOF
            ;;
    esac
    
    if [ -f /workspace/shell.nix ]; then
        nix-shell /workspace/shell.nix --run "echo '✅ Template applied successfully'"
    fi
fi

# Rebuild Nix environment on reload if configuration is present
if command -v nix >/dev/null 2>&1; then
    if [ -f /workspace/flake.nix ] || [ -f /workspace/flake.lock ]; then
        echo "🔧 Rebuilding Nix flake dev shell (if needed)..."
        nix --extra-experimental-features "nix-command flakes" develop /workspace -c true \
            && echo "✅ Nix flake dev shell ready" \
            || echo "⚠️ Nix flake rebuild failed (continuing)"
    elif [ -f /workspace/shell.nix ]; then
        echo "🔧 Rebuilding Nix shell (if needed)..."
        nix-shell /workspace/shell.nix --run "true" \
            && echo "✅ Nix shell ready" \
            || echo "⚠️ Nix shell rebuild failed (continuing)"
    else
        echo "ℹ️ No Nix configuration found (flake.nix or shell.nix)."
    fi
fi

# Start agent bridge in background
echo "🌉 Starting agent bridge..."
cd /agent-bridge
bun run server.ts &
AGENT_PID=$!
echo "✅ Agent bridge started (PID: $AGENT_PID)"

# Wait for agent bridge to start
sleep 2

# Start code-server
echo "📝 Starting code-server..."
cd /workspace

# Apply VS Code preset configuration
PRESET="${PRESET:-default}"
echo "🎨 Applying preset: $PRESET"

# Create VS Code settings directory
CODE_SERVER_USER_DIR="${HOME}/.local/share/code-server/User"
mkdir -p "$CODE_SERVER_USER_DIR"

# Check if this is a custom user preset
if [ -n "$CUSTOM_PRESET_SETTINGS" ] && [ "$CUSTOM_PRESET_SETTINGS" != "" ]; then
    echo "⚙️  Applying custom user preset settings..."
    echo "$CUSTOM_PRESET_SETTINGS" > "$CODE_SERVER_USER_DIR/settings.json"
    echo "✅ Custom settings applied"
    
    # Install custom preset extensions
    if [ -n "$CUSTOM_PRESET_EXTENSIONS" ] && [ "$CUSTOM_PRESET_EXTENSIONS" != "" ]; then
        echo "📦 Installing custom preset extensions..."
        # Extensions are comma-separated
        IFS=',' read -ra EXTS <<< "$CUSTOM_PRESET_EXTENSIONS"
        for EXT in "${EXTS[@]}"; do
            if [ -n "$EXT" ]; then
                echo "  📦 Installing: $EXT"
                code-server --install-extension "$EXT" --force 2>&1 | grep -v "already installed" || true
            fi
        done
        echo "✅ Custom extensions installed"
    fi
else
    # Use built-in preset
    # Apply settings from preset
    if [ -f "/presets/${PRESET}/settings.json" ]; then
        echo "⚙️  Applying VS Code settings from preset..."
        cp "/presets/${PRESET}/settings.json" "$CODE_SERVER_USER_DIR/settings.json"
        echo "✅ Settings applied"
    else
        echo "⚠️  Preset settings not found: /presets/${PRESET}/settings.json"
    fi

    # Install extensions from preset
    if [ -f "/presets/${PRESET}/extensions.json" ]; then
        echo "📦 Installing extensions from preset..."
        
        # Extract extension IDs from extensions.json
        EXTENSIONS=$(cat "/presets/${PRESET}/extensions.json" | grep -o '"[^"]*"' | grep -v "recommendations" | tr -d '"')
        
        # Install each extension
        for EXT in $EXTENSIONS; do
            echo "  📦 Installing: $EXT"
            code-server --install-extension "$EXT" --force 2>&1 | grep -v "already installed" || true
        done
        
        echo "✅ Extensions installed"
    else
        echo "⚠️  Preset extensions not found: /presets/${PRESET}/extensions.json"
    fi
fi

# Install Kalpana diagnostics extension
echo "📦 Installing Kalpana diagnostics extension..."
if [ -f /vscode-extension/kalpana-diagnostics.vsix ]; then
    code-server --install-extension /vscode-extension/kalpana-diagnostics.vsix --force 2>&1 && \
    echo "✅ Kalpana extension installed successfully" || \
    echo "⚠️ Extension install failed"
else
    echo "⚠️ Extension package not found"
fi

# Clear previous activation log
rm -f /tmp/kalpana-extension-activated.log

# Generate a random password if not set
if [ -z "$PASSWORD" ]; then
    if command -v openssl >/dev/null 2>&1; then
        PASSWORD=$(openssl rand -base64 32)
    elif command -v head >/dev/null 2>&1 && command -v base64 >/dev/null 2>&1; then
        PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
    else
        PASSWORD="changeme"
    fi
    echo "Generated password: $PASSWORD"
fi

exec code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    --disable-update-check \
    --disable-getting-started-override \
    /workspace
