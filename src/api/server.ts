// Load environment variables from .env file (silently)
import dotenv from 'dotenv';
dotenv.config({ debug: false });

import express from 'express';
import cors from 'cors';
import { MCPClient } from './mcpClient';
import { createTodoRoutes } from './routes/todos';

/**
 * Create and configure Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging in development
  if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // Initialize MCP client
  const mcpClient = new MCPClient();

  // Connect to MCP server on startup
  mcpClient.connect().catch(error => {
    console.error('Failed to connect to MCP server:', error);
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      mcpConnected: mcpClient.isConnected()
    });
  });

  // MCP connection check middleware
  app.use('/api/todos', (_req, res, next) => {
    if (!mcpClient.isConnected()) {
      res.status(503).json({ error: 'MCP server not connected' });
      return;
    }
    next();
  });

  // Todo routes
  app.use('/api/todos', createTodoRoutes(mcpClient));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  // Store MCP client for cleanup and signal handling
  (app as any).mcpClient = mcpClient;

  // Override listen to handle cleanup
  const originalListen = app.listen.bind(app);
  app.listen = function(...args: any[]) {
    const server = originalListen(...args);

    const originalClose = server.close.bind(server);
    server.close = function(callback?: any) {
      mcpClient.disconnect();
      return originalClose(callback);
    };

    return server;
  } as any;

  return app;
}

/**
 * Start the server
 */
export function startServer(port: number = 3001): void {
  const app = createApp();
  const mcpClient = (app as any).mcpClient;

  const server = app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
    console.log(`CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  });

  // Handle server errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
    }
  });

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');

      // Disconnect MCP client
      if (mcpClient) {
        mcpClient.disconnect();
        console.log('MCP client disconnected');
      }

      console.log('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forcefully shutting down after timeout');
      process.exit(1);
    }, 10000);
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3001', 10);
  startServer(port);
}