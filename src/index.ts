#!/usr/bin/env node

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { GitManager } from './git/GitManager';
import { TodoRepository } from './data/TodoRepository';
import { SyncManager } from './git/SyncManager';
import { MCPServer } from './server/MCPServer';
import * as path from 'path';
import * as os from 'os';

// Get configuration from environment variables
const TODO_REPO_PATH = process.env.TODO_REPO_PATH || path.join(os.homedir(), 'my-todos');
const TODO_REPO_URL = process.env.TODO_REPO_URL;
const GIT_USER_NAME = process.env.GIT_USER_NAME || 'MCP Todo User';
const GIT_USER_EMAIL = process.env.GIT_USER_EMAIL || 'mcp-todo@example.com';
const AUTO_SYNC = process.env.AUTO_SYNC === 'true';
const SYNC_INTERVAL_SECONDS = parseInt(process.env.SYNC_INTERVAL_SECONDS || '300', 10);

async function main() {
  // Initialize server
  const server = new Server(
    {
      name: 'git-todo',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Initialize repositories and managers
  const gitManager = new GitManager(TODO_REPO_PATH);
  const todoRepo = new TodoRepository(TODO_REPO_PATH, gitManager);
  const syncManager = new SyncManager(gitManager, todoRepo);

  // Create MCP server handler
  const mcpServer = new MCPServer(todoRepo, syncManager, gitManager);

  // Initialize Git repository
  await gitManager.initialize(TODO_REPO_URL);

  // Configure Git user
  if (GIT_USER_NAME && GIT_USER_EMAIL) {
    try {
      const git = (gitManager as any).git;
      await git.addConfig('user.name', GIT_USER_NAME);
      await git.addConfig('user.email', GIT_USER_EMAIL);
    } catch (error) {
      console.error('Failed to configure Git user:', error);
    }
  }

  // Initialize todo repository
  console.error('Initializing todo repository...');
  await todoRepo.initialize();

  // Perform initial sync
  console.error('Performing initial sync...');
  const syncResult = await syncManager.initialSync();
  if (!syncResult.success) {
    console.error('Initial sync failed:', syncResult.error);
  } else {
    console.error('Initial sync completed successfully');
  }

  // Enable auto-sync if configured
  if (AUTO_SYNC) {
    console.error(`Enabling auto-sync every ${SYNC_INTERVAL_SECONDS} seconds...`);
    syncManager.startAutoSync(SYNC_INTERVAL_SECONDS * 1000);
    syncManager.enableSyncOnWrite();
  }

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: mcpServer.getTools()
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await mcpServer.handleToolCall(name, args);
      return result;
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ]
      };
    }
  });

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('Shutting down...');
    syncManager.stopAutoSync();

    // Final sync before shutdown
    if (AUTO_SYNC) {
      console.error('Performing final sync...');
      await syncManager.sync();
    }

    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Git-based MCP Todo Server started successfully');
  console.error(`Repository path: ${TODO_REPO_PATH}`);
  console.error(`Remote URL: ${TODO_REPO_URL || 'Not configured'}`);
  console.error(`Auto-sync: ${AUTO_SYNC ? `Enabled (every ${SYNC_INTERVAL_SECONDS}s)` : 'Disabled'}`);
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});