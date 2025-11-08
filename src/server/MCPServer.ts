import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TodoRepository } from '../data/TodoRepository';
import { SyncManager } from '../git/SyncManager';
import { GitManager } from '../git/GitManager';
import { CreateTodoInput, UpdateTodoInput } from '../types/Todo';
import { addComment } from '../types/Todo';

/**
 * MCP Server implementation for todo operations
 */
export class MCPServer {
  private todoRepo: TodoRepository;
  private syncManager: SyncManager;
  private gitManager: GitManager;

  constructor(
    todoRepo: TodoRepository,
    syncManager: SyncManager,
    gitManager: GitManager
  ) {
    this.todoRepo = todoRepo;
    this.syncManager = syncManager;
    this.gitManager = gitManager;
  }

  /**
   * Get list of available tools
   */
  getTools(): Tool[] {
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

  /**
   * Handle tool call
   */
  async handleToolCall(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      switch (name) {
        case 'list_todos':
          return await this.handleListTodos(args);
        case 'get_todo':
          return await this.handleGetTodo(args);
        case 'create_todo':
          return await this.handleCreateTodo(args);
        case 'update_todo':
          return await this.handleUpdateTodo(args);
        case 'delete_todo':
          return await this.handleDeleteTodo(args);
        case 'complete_todo':
          return await this.handleCompleteTodo(args);
        case 'add_comment':
          return await this.handleAddComment(args);
        case 'search_todos':
          return await this.handleSearchTodos(args);
        case 'get_stats':
          return await this.handleGetStats(args);
        case 'sync_repository':
          return await this.handleSyncRepository(args);
        case 'get_history':
          return await this.handleGetHistory(args);
        case 'batch_create_todos':
          return await this.handleBatchCreateTodos(args);
        case 'get_projects':
          return await this.handleGetProjects(args);
        case 'get_tags':
          return await this.handleGetTags(args);
        case 'get_assignees':
          return await this.handleGetAssignees(args);
        case 'get_priorities':
          return await this.handleGetPriorities(args);
        case 'get_filter_options':
          return await this.handleGetFilterOptions(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }]
      };
    }
  }

  private async handleListTodos(args: any) {
    const todos = await this.todoRepo.list(args);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todos,
          count: todos.length
        }, null, 2)
      }]
    };
  }

  private async handleGetTodo(args: any) {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    const todo = await this.todoRepo.get(args.id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todo
        }, null, 2)
      }]
    };
  }

  private async handleCreateTodo(args: any) {
    if (!args.text) {
      throw new Error('Missing required parameter: text');
    }

    if (!args.project) {
      throw new Error('Missing required parameter: project');
    }

    // Validate text is not empty
    if (args.text.trim() === '') {
      throw new Error('Text cannot be empty');
    }

    const input: CreateTodoInput = {
      text: args.text,
      description: args.description,
      project: args.project,
      priority: args.priority || 'medium',
      status: args.status || 'todo',
      tags: args.tags || [],
      assignee: args.assignee,
      dueDate: args.dueDate,
      dependencies: args.dependencies || [],
      createdBy: 'mcp-user'
    };

    const todo = await this.syncManager.createWithSync(input);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todo
        }, null, 2)
      }]
    };
  }

  private async handleUpdateTodo(args: any) {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    // Verify todo exists
    await this.todoRepo.get(args.id);

    const updates: UpdateTodoInput = {};

    if (args.text !== undefined) updates.text = args.text;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assignee !== undefined) updates.assignee = args.assignee;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.tags !== undefined) updates.tags = args.tags;

    const todo = await this.syncManager.updateWithSync(args.id, updates);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todo
        }, null, 2)
      }]
    };
  }

  private async handleDeleteTodo(args: any) {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    // Verify todo exists
    await this.todoRepo.get(args.id);

    await this.syncManager.deleteWithSync(args.id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Todo ${args.id} deleted successfully`
        }, null, 2)
      }]
    };
  }

  private async handleCompleteTodo(args: any) {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    // Verify todo exists
    await this.todoRepo.get(args.id);

    const todo = await this.todoRepo.complete(args.id);

    // Sync after completion
    await this.syncManager.sync();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todo
        }, null, 2)
      }]
    };
  }

  private async handleAddComment(args: any) {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    if (!args.comment) {
      throw new Error('Missing required parameter: comment');
    }

    const todo = await this.todoRepo.get(args.id);
    const updatedTodo = addComment(todo, 'mcp-user', args.comment);

    const result = await this.syncManager.updateWithSync(args.id, {
      comments: updatedTodo.comments
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todo: result
        }, null, 2)
      }]
    };
  }

  private async handleSearchTodos(args: any) {
    if (!args.query) {
      throw new Error('Missing required parameter: query');
    }

    if (args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    const todos = await this.todoRepo.search(args.query);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todos,
          count: todos.length
        }, null, 2)
      }]
    };
  }

  private async handleGetStats(_args: any) {
    const stats = await this.todoRepo.getStats();
    const syncStats = this.syncManager.getStats();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          todoStats: stats,
          syncStats
        }, null, 2)
      }]
    };
  }

  private async handleSyncRepository(_args: any) {
    const result = await this.syncManager.sync();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          hasConflicts: result.hasConflicts,
          resolvedConflicts: result.resolvedConflicts,
          error: result.error
        }, null, 2)
      }]
    };
  }

  private async handleGetHistory(args: any) {
    const limit = args.limit || 10;

    // Get git log
    const git = (this.gitManager as any).git;
    const log = await git.log(['-n', limit.toString(), '--', 'todos.json']);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          commits: log.all.map((commit: any) => ({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: commit.author_name
          }))
        }, null, 2)
      }]
    };
  }

  private async handleBatchCreateTodos(args: any) {
    if (!args.todos || !Array.isArray(args.todos)) {
      throw new Error('Missing required parameter: todos (must be an array)');
    }

    if (args.todos.length === 0) {
      throw new Error('Todos array cannot be empty');
    }

    // Validate all todos first
    for (let i = 0; i < args.todos.length; i++) {
      const todo = args.todos[i];
      if (!todo.text || todo.text.trim() === '') {
        throw new Error(`Todo at index ${i}: text cannot be empty`);
      }
      if (!todo.project) {
        throw new Error(`Todo at index ${i}: project is required`);
      }
      if (todo.parentIndex !== undefined) {
        if (todo.parentIndex >= i) {
          throw new Error(`Todo at index ${i}: parentIndex must reference a todo that comes before it in the array`);
        }
        if (todo.parentIndex < 0) {
          throw new Error(`Todo at index ${i}: parentIndex must be non-negative`);
        }
      }
    }

    const todoInputs: CreateTodoInput[] = [];

    try {
      // Build inputs for todos, resolving parent dependencies
      for (let i = 0; i < args.todos.length; i++) {
        const todoData = args.todos[i];

        // Build input for todo creation
        const input: CreateTodoInput = {
          text: todoData.text,
          description: todoData.description,
          project: todoData.project,
          priority: todoData.priority || 'medium',
          status: todoData.status || 'todo',
          tags: todoData.tags || [],
          assignee: todoData.assignee,
          dueDate: todoData.dueDate,
          dependencies: todoData.dependencies || [],
          createdBy: 'mcp-user'
        };

        // Note: Parent dependencies will need to be resolved after creation
        // since we don't have the IDs yet
        if (todoData.parentIndex !== undefined) {
          // Store parent index for later resolution
          (input as any)._parentIndex = todoData.parentIndex;
        }

        todoInputs.push(input);
      }

      // Create all todos in a single batch operation
      const createdTodos = await this.todoRepo.createBatch(todoInputs);

      // Now update todos with parent dependencies if needed
      for (let i = 0; i < createdTodos.length; i++) {
        const input = todoInputs[i] as any;
        if (input._parentIndex !== undefined) {
          const parentTodo = createdTodos[input._parentIndex];
          if (parentTodo) {
            // Update the todo to add parent dependency
            await this.todoRepo.update(createdTodos[i].id, {
              dependencies: [...createdTodos[i].dependencies, parentTodo.id],
              tags: [...createdTodos[i].tags, `parent:${parentTodo.id}`]
            });
            // Update the created todo object for response
            createdTodos[i].dependencies.push(parentTodo.id);
            createdTodos[i].tags.push(`parent:${parentTodo.id}`);
          }
        }
      }

      // Commit all changes in a single batch
      await this.syncManager.sync();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            todos: createdTodos,
            count: createdTodos.length,
            message: `Successfully created ${createdTodos.length} todos`
          }, null, 2)
        }]
      };
    } catch (error: any) {
      // Rollback is handled by createBatch method
      throw new Error(`Batch creation failed: ${error.message}`);
    }
  }

  private async handleGetProjects(_args: any) {
    const projects = await this.todoRepo.getProjects();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          projects,
          count: projects.length
        }, null, 2)
      }]
    };
  }

  private async handleGetTags(_args: any) {
    const tags = await this.todoRepo.getTags();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          tags,
          count: tags.length
        }, null, 2)
      }]
    };
  }

  private async handleGetAssignees(_args: any) {
    const assignees = await this.todoRepo.getAssignees();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          assignees,
          count: assignees.length
        }, null, 2)
      }]
    };
  }

  private async handleGetPriorities(_args: any) {
    const priorities = await this.todoRepo.getPriorities();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          priorities,
          count: priorities.length
        }, null, 2)
      }]
    };
  }

  private async handleGetFilterOptions(_args: any) {
    const options = await this.todoRepo.getFilterOptions();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...options
        }, null, 2)
      }]
    };
  }
}