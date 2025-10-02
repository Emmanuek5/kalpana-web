FROM nixos/nix:latest

# Enable Nix flakes and experimental features
RUN echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf

# Install essential tools via Nix
RUN nix-env -iA nixpkgs.code-server \
    nixpkgs.gitMinimal \
    nixpkgs.gh \
    nixpkgs.ripgrep \
    nixpkgs.nodejs_20 \
    nixpkgs.bun \
    nixpkgs.curl \
    nixpkgs.wget \
    nixpkgs.htop \
    nixpkgs.gnused \
    nixpkgs.gawk \
    nixpkgs.findutils \
    nixpkgs.coreutils

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Copy agent bridge service
COPY agent-bridge /agent-bridge
WORKDIR /agent-bridge

# Install agent bridge dependencies
RUN bun install

# Copy VS Code extension
COPY vscode-extension /vscode-extension
WORKDIR /vscode-extension

# Build and package VS Code extension
RUN bun install && \
    bun add -D @vscode/vsce && \
    bun run bundle && \
    npx @vscode/vsce package --no-dependencies -o kalpana-diagnostics.vsix

# Copy VS Code presets
COPY presets /presets

# Copy startup script and indexing script
WORKDIR /
COPY start.sh /start.sh
COPY index-codebase.sh /index-codebase.sh
# Normalize line endings to LF to avoid Exec format errors on Windows hosts
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh && \
    sed -i 's/\r$//' /index-codebase.sh && chmod +x /index-codebase.sh

# Expose ports
# 8080: code-server (VSCode)
# 3001: agent bridge (WebSocket)
EXPOSE 8080 3001

# Set environment variables
# Note: PASSWORD is set at runtime via docker run -e, not hardcoded here
ENV PASSWORD=""
ENV WORKSPACE_ID=""

# Start script
CMD ["/start.sh"]
