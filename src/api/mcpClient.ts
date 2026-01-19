/**
 * MCP Client for the API server
 * Extends the base MCP client with API-specific configuration
 */

import * as os from 'os';
import * as path from 'path';
import { BaseMCPClient, SpawnOptions } from '../shared';

/**
 * API MCP Client for communicating with the MCP server via stdio
 */
export class MCPClient extends BaseMCPClient {
  /**
   * Get spawn options for the API server's MCP client
   * Uses environment variables for configuration with safe defaults
   */
  protected getSpawnOptions(): SpawnOptions {
    return {
      command: 'node',
      args: ['dist/index.js'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        TODO_REPO_PATH: process.env.TODO_REPO_PATH || path.join(os.homedir(), 'my-todos'),
        TODO_REPO_URL: process.env.TODO_REPO_URL || '',
        GIT_USER_NAME: process.env.GIT_USER_NAME || 'MCP Todo User',
        GIT_USER_EMAIL: process.env.GIT_USER_EMAIL || 'mcp-todo@example.com'
      }
    };
  }
}
