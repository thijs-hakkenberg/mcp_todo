/**
 * MCP Tool Definitions
 *
 * This file contains all tool schema definitions for the MCP server.
 * Each tool definition includes its name, description, and input schema.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Get list of available tools
 */
export function getToolDefinitions(): Tool[] {
  return [
    {
      name: 'list_todos',
      description: 'List todos with optional filters and field selection',
      inputSchema: {
        type: 'object',
        properties: {
          // Filter options
          status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'blocked', 'done'],
            description: 'Filter by status'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Filter by priority'
          },
          project: {
            type: 'string',
            description: 'Filter by project'
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags'
          },
          includeCompleted: {
            type: 'boolean',
            description: 'Include completed todos (default: true for MCP tool)'
          },
          includeArchived: {
            type: 'boolean',
            description: 'Include archived todos (default: false)'
          },
          // Sorting options
          sortBy: {
            type: 'string',
            enum: ['priority', 'createdAt', 'modifiedAt', 'dueDate'],
            description: 'Sort field'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (default: asc)'
          },
          // Pagination options
          limit: {
            type: 'number',
            description: 'Maximum number of results'
          },
          offset: {
            type: 'number',
            description: 'Number of results to skip (for pagination)'
          },
          // Field selection options
          mode: {
            type: 'string',
            enum: ['minimal', 'standard', 'full'],
            description: 'Field selection mode: minimal (id, text, status, priority, project), standard (+ tags, assignee, dates) [default], full (all fields including subtasks, comments, dependencies, fieldTimestamps)'
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Custom field selection (include only these fields)'
          },
          excludeFields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to exclude from response'
          },
          includeNullDates: {
            type: 'boolean',
            description: 'Include null dueDate and completedAt fields (default: false)'
          }
        }
      }
    },
    {
      name: 'get_todo',
      description: 'Get a single todo by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Todo ID'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'create_todo',
      description: 'Create a new todo',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Todo text'
          },
          description: {
            type: 'string',
            description: 'Detailed description'
          },
          project: {
            type: 'string',
            description: 'Project name'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Priority level'
          },
          status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'blocked', 'done'],
            description: 'Initial status'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags'
          },
          assignee: {
            type: 'string',
            description: 'Assignee user ID'
          },
          dueDate: {
            type: 'string',
            description: 'Due date (ISO 8601)'
          },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of todos this depends on'
          }
        },
        required: ['text', 'project']
      }
    },
    {
      name: 'update_todo',
      description: 'Update an existing todo',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Todo ID'
          },
          text: {
            type: 'string',
            description: 'Updated text'
          },
          description: {
            type: 'string',
            description: 'Updated description'
          },
          status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'blocked', 'done'],
            description: 'Updated status'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Updated priority'
          },
          assignee: {
            type: 'string',
            description: 'Updated assignee'
          },
          dueDate: {
            type: 'string',
            description: 'Updated due date'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated tags'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'delete_todo',
      description: 'Delete (archive) a todo',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Todo ID'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'complete_todo',
      description: 'Mark a todo as done',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Todo ID'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'add_comment',
      description: 'Add a comment to a todo',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Todo ID'
          },
          comment: {
            type: 'string',
            description: 'Comment text'
          }
        },
        required: ['id', 'comment']
      }
    },
    {
      name: 'search_todos',
      description: 'Search todos by text',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_stats',
      description: 'Get todo statistics',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'sync_repository',
      description: 'Manually trigger repository sync',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_history',
      description: 'Get Git history for todos',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of commits',
            default: 10
          }
        }
      }
    },
    {
      name: 'batch_create_todos',
      description: 'Create multiple todos in a single operation (supports hierarchical creation)',
      inputSchema: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'Array of todos to create',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Todo text'
                },
                description: {
                  type: 'string',
                  description: 'Detailed description'
                },
                project: {
                  type: 'string',
                  description: 'Project name'
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'urgent'],
                  description: 'Priority level'
                },
                status: {
                  type: 'string',
                  enum: ['todo', 'in-progress', 'blocked', 'done'],
                  description: 'Initial status'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags'
                },
                assignee: {
                  type: 'string',
                  description: 'Assignee user ID'
                },
                dueDate: {
                  type: 'string',
                  description: 'Due date (ISO 8601)'
                },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'IDs of todos this depends on'
                },
                parentIndex: {
                  type: 'number',
                  description: 'Index of parent todo in this batch (for hierarchical creation)'
                }
              },
              required: ['text', 'project']
            }
          }
        },
        required: ['todos']
      }
    },
    {
      name: 'get_projects',
      description: 'Get list of distinct projects',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_tags',
      description: 'Get list of distinct tags',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_assignees',
      description: 'Get list of distinct assignees',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_priorities',
      description: 'Get list of all priorities',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_filter_options',
      description: 'Get all filter options (projects, tags, assignees, priorities) in one call',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];
}
