# Edge Function Runtime Container

A dedicated Docker container for executing edge functions in isolated V8 environments.

## Architecture

```
Next.js API → HTTP Request → Edge Runtime Container → V8 Isolate → User Code
```

## Features

- **V8 Isolates**: Secure, isolated JavaScript execution
- **HTTP API**: Simple REST API for function execution
- **Environment Variables**: Inject env vars into function context
- **Resource Limits**: Configurable timeout and memory limits
- **Fetch Support**: HTTP requests from user code
- **Console Logging**: Console output captured and logged

## API Endpoints

### Health Check
```
GET /health
Response: { "status": "healthy", "timestamp": "2025-10-04T06:00:00.000Z" }
```

### Execute Function
```
POST /execute
Body: {
  "code": "export default async (req) => ({ statusCode: 200, body: 'OK' })",
  "handler": "handler",
  "request": {
    "method": "GET",
    "url": "/",
    "headers": {},
    "body": "",
    "query": {}
  },
  "envVars": {
    "API_KEY": "secret"
  },
  "timeout": 10000,
  "memory": 128
}

Response: {
  "success": true,
  "result": {
    "statusCode": 200,
    "headers": {},
    "body": "OK"
  },
  "duration": 45
}
```

## Building the Image

```bash
cd lib/docker/containers/edge-runtime
docker build -t kalpana/edge-runtime:latest .
```

## Running Manually

```bash
docker run -d \
  --name kalpana-edge-runtime \
  -p 3003:3003 \
  --restart unless-stopped \
  kalpana/edge-runtime:latest
```

## Testing

```bash
# Health check
curl http://localhost:3003/health

# Execute function
curl -X POST http://localhost:3003/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async (req) => ({ statusCode: 200, body: JSON.stringify({ message: \"Hello World\" }) })",
    "handler": "handler",
    "request": {
      "method": "GET",
      "url": "/",
      "headers": {},
      "query": {}
    },
    "envVars": {},
    "timeout": 10000,
    "memory": 128
  }'
```

## Environment Variables

- `PORT` - HTTP server port (default: 3003)

## Resource Limits

- **Memory**: Configurable per function (64-512 MB)
- **Timeout**: Configurable per function (1-30 seconds)
- **Container Memory**: 512 MB total
- **CPU**: Shared

## Security

- **Sandboxed Execution**: No file system access
- **No Process Spawning**: Cannot execute shell commands
- **No Dynamic Imports**: Cannot require external modules
- **No Eval**: Cannot use eval or Function constructor
- **Network Isolation**: Only HTTP fetch allowed

## Globals Available to User Code

- `console` - Logging (log, error, warn, info)
- `env` - Environment variables object
- `fetch` - HTTP requests (node-fetch)
- `JSON` - JSON parsing/stringifying
- `URL` - URL parsing
- `globalThis` - Global scope

## Error Handling

All errors are caught and returned in the response:

```json
{
  "success": false,
  "error": "Error message",
  "stack": "Stack trace",
  "duration": 12
}
```

## Performance

- **Cold Start**: < 50ms (isolate creation)
- **Warm Execution**: < 5ms
- **Concurrent Executions**: Unlimited (new isolate per request)
- **Memory Overhead**: ~10MB per isolate

## Logs

Container logs include:
- Function console output (prefixed with `[Function]`)
- Execution errors
- HTTP request logs

View logs:
```bash
docker logs kalpana-edge-runtime
```

## Automatic Management

The `EdgeRuntimeManager` in the main application automatically:
- Builds the image if not present
- Creates the container if not running
- Starts the container on first function execution
- Manages health checks

## Dependencies

- **express**: HTTP server
- **body-parser**: Request parsing
- **isolated-vm**: V8 isolate management
- **node-fetch**: HTTP client for user code

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs kalpana-edge-runtime

# Rebuild image
docker build -t kalpana/edge-runtime:latest .
```

### Out of memory errors
Increase container memory limit:
```bash
docker update --memory 1g kalpana-edge-runtime
```

### Timeout errors
Check function timeout configuration and ensure code completes within limit.

## Development

To modify the runtime:
1. Edit `server.js`
2. Rebuild image: `docker build -t kalpana/edge-runtime:latest .`
3. Restart container: `docker restart kalpana-edge-runtime`

## Production Considerations

- Use Docker Compose or Kubernetes for orchestration
- Set up monitoring and alerting
- Configure log aggregation
- Implement rate limiting
- Use load balancer for multiple instances
- Set resource limits appropriately
