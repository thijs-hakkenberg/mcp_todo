/**
 * Response Utilities for MCP Server handlers
 *
 * Provides standardized response formatting for tool handlers.
 */

export interface MCPToolResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Create a successful response with JSON data
 */
export function successResponse(data: any): MCPToolResponse {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        ...data
      }, null, 2)
    }]
  };
}

/**
 * Create an error response
 */
export function errorResponse(message: string): MCPToolResponse {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        error: message
      }, null, 2)
    }]
  };
}
