/**
 * Custom Next.js server with Socket.io support
 * This ensures Socket.io initializes properly with the HTTP server
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Store httpServer globally so Socket.io can access it
  global.httpServer = httpServer;

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      
      // Initialize Socket.io after server starts
      initializeSocketIO();
    });
});

async function initializeSocketIO() {
  try {
    // Dynamic import to avoid issues during build
    const { initializeRealtimeServices } = await import('./lib/socket-init.js');
    await initializeRealtimeServices(global.httpServer);
    console.log('✅ Socket.io initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Socket.io:', error);
  }
}
