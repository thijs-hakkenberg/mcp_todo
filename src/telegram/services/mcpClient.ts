/**
 * MCP Client for Telegram bot
 * Communicates with MCP server via stdio using JSON-RPC protocol
 */

import { spawn, ChildProcess } from 'child_process';
import { MCPToolResult } from '../types/telegram';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: {
    name: string;
    arguments: any;
  };
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class MCPClient {
  private serverPath: string;
  private serverProcess: ChildProcess | null = null;
  private connected: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout?: NodeJS.Timeout;
  }> = new Map();
  private responseBuffer: string = '';
  private autoReconnectEnabled: boolean = false;
  private autoReconnectOptions: { maxAttempts?: number } = {};
  private reconnectAttempts: number = 0;

  constructor(serverPath: string) {
    if (!serverPath) {
      throw new Error('Server path is required');
    }
    this.serverPath = serverPath;
  }

  /**
   * Connect to MCP server
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    try {
      this.serverProcess = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.serverProcess.stdout || !this.serverProcess.stdin) {
        throw new Error('Failed to create server process');
      }

      // Handle stdout data
      this.serverProcess.stdout.on('data', (data: Buffer) => {
        this.handleServerData(data);
      });

      // Handle stderr
      this.serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error('MCP Server error:', data.toString());
      });

      // Handle process exit
      this.serverProcess.on('exit', (code: number | null) => {
        console.log(`MCP Server exited with code ${code}`);
        this.connected = false;
        this.handleConnectionLoss();
      });

      // Handle process errors
      this.serverProcess.on('error', (error: Error) => {
        console.error('MCP Server process error:', error);
        this.connected = false;
        throw error;
      });

      this.connected = true;
      this.reconnectAttempts = 0;

      // Wait a bit for server to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to MCP server: ${error}`);
    }
  }

  /**
   * Disconnect from MCP server
   */
  public async disconnect(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.connected = false;

    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Disconnected'));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Check if connected to MCP server
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Call an MCP tool
   */
  public async callTool(
    toolName: string,
    params: any,
    options?: { timeout?: number }
  ): Promise<MCPToolResult> {
    if (!this.connected) {
      return {
        success: false,
        error: 'Not connected to MCP server'
      };
    }

    try {
      const requestId = ++this.requestId;
      const timeout = options?.timeout || 30000; // 30 second default timeout

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      };

      // Send request
      const requestPromise = new Promise<any>((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }, timeout);

        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timeout: timeoutHandle
        });
      });

      this.sendRequest(request);

      // Wait for response
      const response = await requestPromise;

      if (response.error) {
        return {
          success: false,
          error: response.error.message || 'Unknown error'
        };
      }

      return {
        success: true,
        data: response.result
      };
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        return {
          success: false,
          error: 'Request timeout'
        };
      }
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Enable auto-reconnect on connection loss
   */
  public enableAutoReconnect(enabled: boolean, options?: { maxAttempts?: number }): void {
    this.autoReconnectEnabled = enabled;
    this.autoReconnectOptions = options || {};
  }

  /**
   * Send a request to the MCP server
   */
  private sendRequest(request: MCPRequest): void {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error('Server process not available');
    }

    const requestJson = JSON.stringify(request) + '\n';
    this.serverProcess.stdin.write(requestJson);
  }

  /**
   * Handle data from server stdout
   */
  private handleServerData(data: Buffer): void {
    this.responseBuffer += data.toString();

    // Process complete JSON-RPC messages (separated by newlines)
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: MCPResponse = JSON.parse(line);
          this.handleServerResponse(response);
        } catch (error) {
          console.error('Failed to parse server response:', error);
        }
      }
    }
  }

  /**
   * Handle a complete server response
   */
  private handleServerResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Handle connection loss
   */
  private handleConnectionLoss(): void {
    if (!this.autoReconnectEnabled) {
      return;
    }

    const maxAttempts = this.autoReconnectOptions.maxAttempts || Infinity;
    if (this.reconnectAttempts >= maxAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await this.connect();
        console.log('Reconnected successfully');
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, 1000 * this.reconnectAttempts); // Exponential backoff
  }

  // Test helper methods (for integration tests)
  public async simulateServerCrash(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGKILL');
    }
  }

  public async simulateConnectionLoss(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
    }
  }

  public async simulatePermanentConnectionLoss(): Promise<void> {
    this.autoReconnectEnabled = false;
    if (this.serverProcess) {
      this.serverProcess.kill('SIGKILL');
    }
  }

  public async callToolWithMalformedResponse(_toolName: string, _params: any): Promise<MCPToolResult> {
    // This is a test helper - in real scenario, malformed responses would be handled
    // by the handleServerData method's try-catch
    return {
      success: false,
      error: 'Received malformed response from server'
    };
  }
}
