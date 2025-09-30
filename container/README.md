# Kalpana Workspace Container

This directory contains the Docker container image for Kalpana workspaces.

## What's Inside

- **code-server**: Full VSCode in the browser
- **Agent Bridge**: WebSocket server for AI agent commands
- **Nix**: Reproducible development environments
- **Git**: Version control
- **Templates**: Pre-configured environments (Node, Python, Rust, Go, etc.)

## Building the Image

```bash
# From the kalpana/container directory
docker build -t kalpana/workspace:latest .
```

## Testing Locally

```bash
# Run a test container
docker run -it \
  -p 8080:8080 \
  -p 3001:3001 \
  -e WORKSPACE_ID=test-123 \
  -e TEMPLATE=node \
  kalpana/workspace:latest
```

Then open:

- VSCode: http://localhost:8080
- Agent Bridge: ws://localhost:3001

## Environment Variables

| Variable       | Description                    | Example                           |
| -------------- | ------------------------------ | --------------------------------- |
| `WORKSPACE_ID` | Unique workspace identifier    | `workspace-abc123`                |
| `GITHUB_REPO`  | GitHub repo to clone           | `user/repo`                       |
| `GITHUB_TOKEN` | GitHub personal access token   | `ghp_...`                         |
| `TEMPLATE`     | Pre-configured template        | `node`, `python`, `rust`, `go`    |
| `NIX_CONFIG`   | Custom Nix shell configuration | `{ pkgs...`                       |
| `PRESET`       | VS Code preset                 | `default`, `minimal`, `fullstack` |

## Ports

- `8080`: code-server (VSCode)
- `3001`: Agent bridge (WebSocket)

## Agent Bridge API

The WebSocket server at port 3001 accepts JSON commands:

### Read File

```json
{
  "id": "cmd-001",
  "type": "readFile",
  "payload": {
    "path": "src/index.ts"
  }
}
```

### Write File

```json
{
  "id": "cmd-002",
  "type": "writeFile",
  "payload": {
    "path": "src/new-file.ts",
    "content": "console.log('Hello!');"
  }
}
```

### Run Command

```json
{
  "id": "cmd-003",
  "type": "runCommand",
  "payload": {
    "command": "npm install"
  }
}
```

### Search Code

```json
{
  "id": "cmd-004",
  "type": "searchCode",
  "payload": {
    "query": "function"
  }
}
```

### Git Operations

```json
{
  "id": "cmd-005",
  "type": "gitCommit",
  "payload": {
    "message": "feat: add new feature"
  }
}

{
  "id": "cmd-006",
  "type": "gitPush",
  "payload": {}
}
```

## Security

- Path traversal protection
- Command whitelist
- Timeout limits
- Resource constraints (CPU, memory)
- No privileged mode

## Customization

### Adding New Templates

Edit `start.sh` and add a new case in the template section:

```bash
"mytemplate")
    cat > /workspace/shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Your packages here
  ];
}
EOF
    ;;
```

### Extending Agent Bridge

Add new command handlers in `agent-bridge/server.ts`:

```typescript
case "myCommand": {
  const result = await doSomething(command.payload);
  return {
    id: command.id,
    success: true,
    data: result,
  };
}
```

## VS Code Presets

Workspaces use preset configurations for consistent editor settings and extensions across all containers:

- **default**: One Dark Pro theme with essential web dev extensions
- **minimal**: Lightweight setup with only Prettier and ESLint
- **fullstack**: Complete setup for full-stack development with multiple languages

See `presets/README.md` for more details on creating custom presets.

## Troubleshooting

### Container won't start

- Check Docker is running: `docker ps`
- Check logs: `docker logs workspace-{id}`

### Agent bridge not responding

- Check port 3001 is exposed
- Test connection: `wscat -c ws://localhost:3001`

### Code-server issues

- Check port 8080 is available
- Verify container has enough resources (2GB RAM minimum)

### Extensions not installing

- Check internet connectivity in container
- Verify preset exists in `/presets/{preset_name}/`
- Check startup logs for extension installation errors

## Development

### Local Testing

```bash
# Install agent bridge dependencies
cd agent-bridge
bun install

# Run agent bridge locally
bun run server.ts

# In another terminal, test with wscat
wscat -c ws://localhost:3001
```
