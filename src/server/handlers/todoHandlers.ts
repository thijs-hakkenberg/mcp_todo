/**
 * Todo CRUD Handlers for MCP Server
 *
 * Handles create, read, update, delete operations for todos.
 */

import { TodoRepository } from '../../data/TodoRepository';
import { SyncManager } from '../../git/SyncManager';
import { CreateTodoInput, UpdateTodoInput } from '../../types/Todo';
import { addComment } from '../../types/Todo';
import { successResponse, MCPToolResponse } from '../utils/response';

export class TodoHandlers {
  constructor(
    private todoRepo: TodoRepository,
    private syncManager: SyncManager
  ) {}

  async handleListTodos(args: any): Promise<MCPToolResponse> {
    const todos = await this.todoRepo.list(args);
    return successResponse({ todos, count: todos.length });
  }

  async handleGetTodo(args: any): Promise<MCPToolResponse> {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }
    const todo = await this.todoRepo.get(args.id);
    return successResponse({ todo });
  }

  async handleCreateTodo(args: any): Promise<MCPToolResponse> {
    if (!args.text) {
      throw new Error('Missing required parameter: text');
    }
    if (!args.project) {
      throw new Error('Missing required parameter: project');
    }
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
    return successResponse({ todo });
  }

  async handleUpdateTodo(args: any): Promise<MCPToolResponse> {
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
    return successResponse({ todo });
  }

  async handleDeleteTodo(args: any): Promise<MCPToolResponse> {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    // Verify todo exists
    await this.todoRepo.get(args.id);

    await this.syncManager.deleteWithSync(args.id);
    return successResponse({ message: `Todo ${args.id} deleted successfully` });
  }

  async handleCompleteTodo(args: any): Promise<MCPToolResponse> {
    if (!args.id) {
      throw new Error('Missing required parameter: id');
    }

    // Verify todo exists
    await this.todoRepo.get(args.id);

    const todo = await this.todoRepo.complete(args.id);
    await this.syncManager.sync();

    return successResponse({ todo });
  }

  async handleAddComment(args: any): Promise<MCPToolResponse> {
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

    return successResponse({ todo: result });
  }

  async handleSearchTodos(args: any): Promise<MCPToolResponse> {
    if (!args.query) {
      throw new Error('Missing required parameter: query');
    }
    if (args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    const todos = await this.todoRepo.search(args.query);
    return successResponse({ todos, count: todos.length });
  }

  async handleBatchCreateTodos(args: any): Promise<MCPToolResponse> {
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

    // Build inputs for todos, resolving parent dependencies
    for (let i = 0; i < args.todos.length; i++) {
      const todoData = args.todos[i];

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

      if (todoData.parentIndex !== undefined) {
        (input as any)._parentIndex = todoData.parentIndex;
      }

      todoInputs.push(input);
    }

    // Create all todos in a single batch operation
    const createdTodos = await this.todoRepo.createBatch(todoInputs);

    // Update todos with parent dependencies if needed
    for (let i = 0; i < createdTodos.length; i++) {
      const input = todoInputs[i] as any;
      if (input._parentIndex !== undefined) {
        const parentTodo = createdTodos[input._parentIndex];
        if (parentTodo) {
          await this.todoRepo.update(createdTodos[i].id, {
            dependencies: [...createdTodos[i].dependencies, parentTodo.id],
            tags: [...createdTodos[i].tags, `parent:${parentTodo.id}`]
          });
          createdTodos[i].dependencies.push(parentTodo.id);
          createdTodos[i].tags.push(`parent:${parentTodo.id}`);
        }
      }
    }

    // Commit all changes in a single batch
    await this.syncManager.sync();

    return successResponse({
      todos: createdTodos,
      count: createdTodos.length,
      message: `Successfully created ${createdTodos.length} todos`
    });
  }
}
