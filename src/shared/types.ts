/**
 * Shared types for MCP client implementations
 */

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params: any;
  id: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

export interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export interface MCPClientOptions {
  timeout?: number;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SpawnOptions {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}
