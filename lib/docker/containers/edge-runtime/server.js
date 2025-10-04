const express = require('express');
const ivm = require('isolated-vm');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3003;

// Increase body size limit for function code
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Execute edge function
app.post('/execute', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      code,
      handler = 'handler',
      request,
      envVars = {},
      timeout = 10000,
      memory = 128,
    } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    if (!request) {
      return res.status(400).json({ error: 'Request object is required' });
    }

    // Execute in isolate
    const result = await executeInIsolate(code, handler, request, envVars, timeout, memory);
    
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      result,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Execution error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      duration,
    });
  }
});

/**
 * Execute user code in V8 isolate
 */
async function executeInIsolate(code, handler, request, envVars, timeout, memory) {
  const isolate = new ivm.Isolate({ memoryLimit: memory });
  
  try {
    const context = await isolate.createContext();
    const jail = context.global;

    // Set up console
    await jail.set('_log', new ivm.Reference((...args) => {
      console.log('[Function]', ...args);
    }));
    await jail.set('_error', new ivm.Reference((...args) => {
      console.error('[Function]', ...args);
    }));
    await jail.set('_warn', new ivm.Reference((...args) => {
      console.warn('[Function]', ...args);
    }));
    await jail.set('_info', new ivm.Reference((...args) => {
      console.info('[Function]', ...args);
    }));

    await context.eval(`
      globalThis.console = {
        log: (...args) => _log(...args),
        error: (...args) => _error(...args),
        warn: (...args) => _warn(...args),
        info: (...args) => _info(...args),
      };
    `);

    // Set up environment variables
    await jail.set('_env', new ivm.ExternalCopy(envVars).copyInto());
    await context.eval('globalThis.env = _env;');

    // Set up fetch (using node-fetch)
    const fetchFunc = new ivm.Reference(async (url, options) => {
      try {
        const fetch = require('node-fetch');
        const response = await fetch(url, options);
        const body = await response.text();
        
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body,
          json: () => JSON.parse(body),
          text: () => body,
        };
      } catch (err) {
        throw new Error(`Fetch failed: ${err.message}`);
      }
    });

    await jail.set('_fetch', fetchFunc);
    await context.eval(`
      globalThis.fetch = async (url, options) => {
        return await _fetch.apply(undefined, [url, options], { arguments: { copy: true }, result: { promise: true, copy: true } });
      };
    `);

    // Set up JSON
    await context.eval(`
      globalThis.JSON = {
        parse: (str) => JSON.parse(str),
        stringify: (obj) => JSON.stringify(obj),
      };
    `);

    // Set up URL
    await context.eval(`
      globalThis.URL = class URL {
        constructor(url) {
          const match = url.match(/^(https?:\\/\\/)?([^\\/]+)(\\/.*)?$/);
          this.protocol = match[1] || 'https://';
          this.host = match[2] || '';
          this.pathname = match[3] || '/';
          this.href = url;
        }
      };
    `);

    // Compile and run user code
    const script = await isolate.compileScript(code);
    await script.run(context);

    // Prepare request data
    const requestData = new ivm.ExternalCopy(request).copyInto();
    await jail.set('_request', requestData);

    // Execute handler
    const handlerScript = await isolate.compileScript(`
      (async () => {
        try {
          // Find handler function
          const handler = typeof ${handler} === 'function' ? ${handler} : globalThis.${handler};
          
          if (typeof handler !== 'function') {
            throw new Error('Handler function not found: ${handler}');
          }
          
          // Execute handler
          const response = await handler(_request);
          
          // Normalize response
          if (typeof response === 'string') {
            return { statusCode: 200, headers: {}, body: response };
          }
          
          if (response && typeof response === 'object') {
            return {
              statusCode: response.statusCode || response.status || 200,
              headers: response.headers || {},
              body: typeof response.body === 'string' 
                ? response.body 
                : JSON.stringify(response.body || response)
            };
          }
          
          return { statusCode: 200, headers: {}, body: JSON.stringify(response) };
        } catch (err) {
          return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              error: err.message, 
              stack: err.stack 
            })
          };
        }
      })()
    `);

    const result = await handlerScript.run(context, { 
      timeout, 
      promise: true 
    });

    // Copy result out of isolate
    const resultCopy = await result.copy();
    
    return resultCopy;
  } finally {
    // Clean up
    isolate.dispose();
  }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Edge Function Runtime listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
