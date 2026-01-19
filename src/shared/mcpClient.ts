/**
 * Base MCP Client for communicating with MCP servers via stdio
 *
 * This base class provides common JSON-RPC handling logic that can be extended
 * by specific implementations (API server, Telegram bot, etc.)
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  PendingRequest,
  SpawnOptions
} from './types';

export abstract class BaseMCPClient extends EventEmitter {
  protected process: ChildProcess | null = null;
  protected connected: boolean = false;
  protected pendingRequests: Map<string | number, PendingRequest> = new Map();
  protected buffer: string = '';
  protected requestCounter: number = 0;
  protected defaultTimeout: number = 30000;

  /**
   * Get the spawn options for the MCP server process
   * Override in subclasses to customize
   */
  protected abstract getSpawnOptions(): SpawnOptions;

  /**
   * Generate a unique request ID
   * Override in subclasses for different ID formats
   */
  protected generateRequestId(): string | number {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  /**
   * Connect to the MCP server by spawning the process
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const options = this.getSpawnOptions();
    const command = options.command || 'node';
    const args = options.args || ['dist/index.js'];

    try {
      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env
      });

      this.setupEventHandlers();
      this.connected = true;

      // Wait a bit for server to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      this.connected = false;
      throw new Error(`Failed to spawn MCP server: ${error.message}`);
    }
  }

  /**
   * Set up event handlers for the spawned process
   */
  protected setupEventHandlers(): void {
    if (!this.process) return;

    // Handle stdout (responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    // Handle stderr (errors/logs)
    this.process.stderr?.on('data', (data: Buffer) => {
      this.handleStderr(data.toString());
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      this.connected = false;
      this.onProcessExit(code);
      this.rejectAllPendingRequests(new Error(`MCP server exited with code ${code}`));
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.connected = false;
      this.onProcessError(error);
      this.rejectAllPendingRequests(error);
    });
  }

  /**
   * Handle stdout data from the MCP server
   */
  protected handleStdout(data: string): void {
    this.buffer += data;

    // Process complete JSON messages (separated by newlines)
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        // Skip non-JSON lines (e.g., dotenv messages, debug output)
        if (!line.trim().startsWith('{')) {
          continue;
        }

        try {
          const response: JSONRPCResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse JSON-RPC response:', line.substring(0, 100) + '...');
        }
      }
    }
  }

  /**
   * Handle stderr data from the MCP server
   * Override in subclasses for custom error handling
   */
  protected handleStderr(data: string): void {
    const message = data.trim();
    if (message.toLowerCase().includes('error') ||
        message.toLowerCase().includes('failed') ||
        message.toLowerCase().includes('warning')) {
      console.error('[MCP Server]', message);
    } else {
      console.log('[MCP Server]', message);
    }
  }

  /**
   * Handle a JSON-RPC response
   */
  protected handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }

    // Clear timeout if set
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // Remove from pending
    this.pendingRequests.delete(response.id);

    // Resolve or reject based on response
    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  async sendRequest(method: string, params: any, timeout?: number): Promise<any> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Not connected to MCP server');
    }

    const id = this.generateRequestId();
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutMs = timeout || this.defaultTimeout;
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(requestStr, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          clearTimeout(timeoutHandle);
          reject(error);
        }
      });
    });
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    if (this.process) {
      this.rejectAllPendingRequests(new Error('Client disconnected'));
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected to the MCP server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Reject all pending requests
   */
  protected rejectAllPendingRequests(error: Error): void {
    for (const [_id, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Called when the process exits
   * Override in subclasses for custom handling (e.g., auto-reconnect)
   */
  protected onProcessExit(code: number | null): void {
    console.log(`MCP server exited with code ${code}`);
    this.emit('exit', code);
  }

  /**
   * Called when the process errors
   * Override in subclasses for custom handling
   */
  protected onProcessError(error: Error): void {
    console.error('MCP server process error:', error);
    this.emit('error', error);
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: any, timeout?: number): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args
    }, timeout);

    // Parse the response content
    if (response?.content?.[0]?.text) {
      try {
        return JSON.parse(response.content[0].text);
      } catch {
        return response.content[0].text;
      }
    }

    return response;
  }
}
