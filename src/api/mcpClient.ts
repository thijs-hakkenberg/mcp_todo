import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params: any;
  id: string;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string;
}

interface RequestOptions {
  timeout?: number;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

/**
 * MCP Client for communicating with the MCP server via stdio
 */
export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private connected: boolean = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private buffer: string = '';
  private requestCounter: number = 0;

  /**
   * Connect to the MCP server by spawning the process
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      this.process = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          TODO_REPO_PATH: process.env.TODO_REPO_PATH || '/Users/thijshakkenberg/our_todo/todos',
          TODO_REPO_URL: process.env.TODO_REPO_URL || '',
          GIT_USER_NAME: process.env.GIT_USER_NAME || 'MCP Todo User',
          GIT_USER_EMAIL: process.env.GIT_USER_EMAIL || 'mcp-todo@example.com'
        }
      });

      this.setupEventHandlers();
      this.connected = true;
    } catch (error: any) {
      throw new Error(`Failed to spawn MCP server: ${error.message}`);
    }
  }

  /**
   * Set up event handlers for the spawned process
   */
  private setupEventHandlers(): void {
    if (!this.process) return;

    // Handle stdout (responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    // Handle stderr (errors/logs)
    // Note: MCP server uses stderr for ALL logging (stdout is reserved for JSON-RPC)
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      // Distinguish between actual errors and informational messages
      if (message.toLowerCase().includes('error') ||
          message.toLowerCase().includes('failed') ||
          message.toLowerCase().includes('warning')) {
        console.error('[MCP Server]', message);
      } else {
        console.log('[MCP Server]', message);
      }
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      this.connected = false;
      this.rejectAllPendingRequests(new Error(`MCP server exited with code ${code}`));
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.connected = false;
      this.rejectAllPendingRequests(error);
    });
  }

  /**
   * Handle stdout data from the MCP server
   */
  private handleStdout(data: string): void {
    this.buffer += data;

    // Process complete JSON messages
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        try {
          const response: JSONRPCResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse JSON response:', line, error);
        }
      }
    }
  }

  /**
   * Handle a JSON-RPC response
   */
  private handleResponse(response: JSONRPCResponse): void {
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
  async sendRequest(method: string, params: any, options: RequestOptions = {}): Promise<any> {
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
      // Set up timeout if specified
      let timeout: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeout = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }, options.timeout);
      }

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(requestStr, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          if (timeout) clearTimeout(timeout);
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
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPendingRequests(error: Error): void {
    for (const [_id, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: any): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });

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