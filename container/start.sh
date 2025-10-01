#!/usr/bin/env sh

# Exit on error, undefined var, fail in pipelines
set -euo pipefail

# Enable debug logging if DEBUG=true
if [ "${DEBUG:-false}" = "true" ]; then
    set -x
    trap 'echo "❌ Script failed at line $LINENO with exit code $?"' ERR
    echo "🔍 Debug mode enabled"
fi

echo "🚀 Starting Kalpana Workspace..."
echo "Workspace ID: ${WORKSPACE_ID:-unknown}"
echo "Agent Mode: ${AGENT_MODE:-false}"

# Change to workspace directory
cd /workspace || {
    echo "❌ Failed to cd into /workspace"
    exit 1
}

#################################
# Git setup
#################################
echo "🔑 Configuring Git..."

set +e
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "🔑 Setting up GitHub credentials..."
    git config --global credential.helper store
    echo "https://${GITHUB_TOKEN}@github.com" > ~/.git-credentials
    chmod 600 ~/.git-credentials

    if command -v curl >/dev/null 2>&1; then
        USER_INFO=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/user 2>/dev/null || echo "")
        if [ -n "$USER_INFO" ]; then
            GIT_NAME=$(echo "$USER_INFO" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")
            GIT_EMAIL=$(echo "$USER_INFO" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "")
            if [ -n "$GIT_NAME" ]; then
                git config --global user.name "$GIT_NAME"
                echo "✅ Git user.name set to: $GIT_NAME (from GitHub)"
            fi
            if [ -n "$GIT_EMAIL" ] && [ "$GIT_EMAIL" != "null" ]; then
                git config --global user.email "$GIT_EMAIL"
                echo "✅ Git user.email set to: $GIT_EMAIL (from GitHub)"
            else
                PRIMARY_EMAIL=$(curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" https://api.github.com/user/emails 2>/dev/null | grep -o '"email":"[^"]*","primary":true' | cut -d'"' -f4 || echo "")
                if [ -n "$PRIMARY_EMAIL" ]; then
                    git config --global user.email "$PRIMARY_EMAIL"
                    echo "✅ Git user.email set to: $PRIMARY_EMAIL (from GitHub)"
                fi
            fi
        else
            echo "⚠️ Could not fetch GitHub user info (API might be rate limited)"
        fi
    fi

    echo "✅ Git configured for GitHub authentication"
fi
set -e

# Fallbacks for git identity
if [ -z "$(git config --global user.name || true)" ]; then
    if [ -n "${GIT_USER_NAME:-}" ]; then
        git config --global user.name "$GIT_USER_NAME"
        echo "✅ Git user.name set to: $GIT_USER_NAME (from account)"
    else
        git config --global user.name "Kalpana User"
        echo "⚠️ Git user.name set to default: Kalpana User"
    fi
fi
if [ -z "$(git config --global user.email || true)" ]; then
    if [ -n "${GIT_USER_EMAIL:-}" ]; then
        git config --global user.email "$GIT_USER_EMAIL"
        echo "✅ Git user.email set to: $GIT_USER_EMAIL (from account)"
    else
        git config --global user.email "user@kalpana.local"
        echo "⚠️ Git user.email set to default: user@kalpana.local"
    fi
fi

#################################
# Clone repo (if specified)
#################################
set +e
if [ -n "${GITHUB_REPO:-}" ] && [ ! -d ".git" ]; then
    if [ -z "$(ls -A /workspace 2>/dev/null)" ]; then
        RAW_REPO="$GITHUB_REPO"
        echo "🔍 Processing repository: $RAW_REPO"

        # Sanitize repo input but keep important chars like "-"
        SANITIZED=$(printf "%s" "$RAW_REPO" | LC_ALL=C tr -cd 'A-Za-z0-9/_\.\-:@')
        SANITIZED=$(printf "%s" "$SANITIZED" | sed -E 's#/*$##')

        if echo "$SANITIZED" | grep -qi '^\(git@\|https\?://\)\?github\.com'; then
            REPO_PATH=$(printf "%s" "$SANITIZED" \
              | sed -E 's#^(git@|https?://)?github.com[:/]+##I' \
              | sed -E 's#\.git$##I' \
              | cut -d'/' -f1-2)
        else
            REPO_PATH=$(printf "%s" "$SANITIZED" \
              | sed -E 's#^/+##' \
              | sed -E 's#\.git$##I' \
              | cut -d'/' -f1-2)
        fi

        echo "🎯 Final repo path: $REPO_PATH"

        if echo "$REPO_PATH" | grep -q '/'; then
            if [ -n "${GITHUB_TOKEN:-}" ]; then
                REPO_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"
                echo "🔗 Using authenticated clone"
            else
                REPO_URL="https://github.com/${REPO_PATH}.git"
                echo "🔗 Using public clone"
            fi

            git clone "$REPO_URL" . && echo "✅ Repository cloned successfully" || echo "❌ Git clone failed"
        else
            echo "⚠️ Invalid repository format: '$RAW_REPO'"
            echo "⚠️ Processed as: '$REPO_PATH'"
        fi
    else
        echo "ℹ️ Skipping clone because /workspace is not empty"
    fi
else
    if [ -d ".git" ]; then
        echo "ℹ️ Git repository already exists in /workspace"
    else
        echo "ℹ️ No GITHUB_REPO specified or already initialized"
    fi
fi
set -e

#################################
# Apply Nix configuration
#################################
if [ ! -z "${NIX_CONFIG:-}" ]; then
    echo "🔧 Applying Nix configuration..."
    echo "$NIX_CONFIG" > /workspace/shell.nix
    nix-shell /workspace/shell.nix --run "echo '✅ Nix environment configured'"
fi

#################################
# Apply template
#################################
if [ ! -z "${TEMPLATE:-}" ] && [ "$TEMPLATE" != "custom" ]; then
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

#################################
# Rebuild nix environment if needed
#################################
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

#################################
# Run services
#################################
if [ "${AGENT_MODE:-false}" = "true" ]; then
    echo "🤖 Running in AGENT MODE"
    echo "🌉 Starting agent bridge as main process..."
    cd /agent-bridge || exit 1
    if command -v bun >/dev/null 2>&1; then
        if [ "${DEBUG:-false}" = "true" ]; then
            bun run server.ts || echo "❌ agent bridge failed with $?"
            tail -f /dev/null
        else
            exec bun run server.ts
        fi
    else
        echo "❌ ERROR: bun not found but required for agent mode"
        tail -f /dev/null
    fi
else
    echo "🌉 Starting agent bridge..."
    cd /agent-bridge
    if command -v bun >/dev/null 2>&1; then
        (bun run server.ts > /tmp/agent-bridge.log 2>&1 &) || true
        AGENT_PID=${!:-}
        if [ -n "${AGENT_PID:-}" ]; then
            echo "✅ Agent bridge started (PID: $AGENT_PID)"
        else
            echo "⚠️ Agent bridge PID not captured"
        fi
    else
        echo "⚠️ bun not found, skipping agent bridge startup"
    fi

    sleep 2
    echo "📝 Starting code-server..."
    cd /workspace

    PRESET="${PRESET:-default}"
    echo "🎨 Applying preset: $PRESET"

    CODE_SERVER_USER_DIR="${HOME}/.local/share/code-server/User"
    mkdir -p "$CODE_SERVER_USER_DIR"

    if [ -n "${CUSTOM_PRESET_SETTINGS:-}" ]; then
        echo "⚙️  Applying custom user preset settings..."
        echo "$CUSTOM_PRESET_SETTINGS" > "$CODE_SERVER_USER_DIR/settings.json"
        echo "✅ Custom settings applied"
        if [ -n "${CUSTOM_PRESET_EXTENSIONS:-}" ]; then
            echo "📦 Installing custom preset extensions..."
            IFS=',' read -ra EXTS <<< "$CUSTOM_PRESET_EXTENSIONS"
            for EXT in "${EXTS[@]}"; do
                [ -n "$EXT" ] && code-server --install-extension "$EXT" --force 2>&1 | grep -v "already installed" || true
            done
            echo "✅ Custom extensions installed"
        fi
    else
        if [ -f "/presets/${PRESET}/settings.json" ]; then
            cp "/presets/${PRESET}/settings.json" "$CODE_SERVER_USER_DIR/settings.json"
            echo "✅ Settings applied"
        else
            echo "⚠️  Preset settings not found"
        fi
        if [ -f "/presets/${PRESET}/extensions.json" ]; then
            EXTENSIONS=$(cat "/presets/${PRESET}/extensions.json" | grep -o '"[^"]*"' | grep -v "recommendations" | tr -d '"')
            for EXT in $EXTENSIONS; do
                code-server --install-extension "$EXT" --force 2>&1 | grep -v "already installed" || true
            done
            echo "✅ Extensions installed"
        else
            echo "⚠️  Preset extensions not found"
        fi
    fi

    echo "📦 Installing Kalpana diagnostics extension..."
    if [ -f /vscode-extension/kalpana-diagnostics.vsix ]; then
        code-server --install-extension /vscode-extension/kalpana-diagnostics.vsix --force 2>&1 && \
        echo "✅ Kalpana extension installed successfully" || \
        echo "⚠️ Extension install failed"
    fi

    rm -f /tmp/kalpana-extension-activated.log

    if [ -z "${PASSWORD:-}" ]; then
        if command -v openssl >/dev/null 2>&1; then
            PASSWORD=$(openssl rand -base64 32)
        elif command -v head >/dev/null 2>&1 && command -v base64 >/dev/null 2>&1; then
            PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
        else
            PASSWORD="changeme"
        fi
        echo "Generated password: $PASSWORD"
    fi

    if command -v code-server >/dev/null 2>&1; then
        if [ "${DEBUG:-false}" = "true" ]; then
            code-server \
                --bind-addr 0.0.0.0:8080 \
                --auth none \
                --disable-telemetry \
                --disable-update-check \
                --disable-getting-started-override \
                /workspace || echo "❌ code-server exited with $?"
            tail -f /dev/null
        else
            exec code-server \
                --bind-addr 0.0.0.0:8080 \
                --auth none \
                --disable-telemetry \
                --disable-update-check \
                --disable-getting-started-override \
                /workspace
        fi
    else
        echo "❌ ERROR: code-server not found in PATH"
        tail -f /dev/null
    fi
fi
