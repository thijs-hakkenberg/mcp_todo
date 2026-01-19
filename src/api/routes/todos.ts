import { Router, Request, Response, NextFunction } from 'express';
import { MCPClient } from '../mcpClient';

// UUID validation regex (works for UUIDv4, UUIDv7, etc.)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate UUID parameter
 */
function validateId(req: Request, res: Response, next: NextFunction): void {
  const { id } = req.params;

  if (!id || !UUID_REGEX.test(id)) {
    res.status(400).json({
      error: 'Invalid ID format',
      message: 'ID must be a valid UUID'
    });
    return;
  }

  next();
}

/**
 * Create todo routes with MCP client
 */
export function createTodoRoutes(mcpClient: MCPClient): Router {
  const router = Router();

  // List todos with optional filters and field selection
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: any = {};

      // Filter parameters
      if (req.query.status) filters.status = req.query.status;
      if (req.query.priority) filters.priority = req.query.priority;
      if (req.query.project) filters.project = req.query.project;
      if (req.query.assignee) filters.assignee = req.query.assignee;

      // includeCompleted: default to true for backward compatibility (unlike MCP tool)
      if (req.query.includeCompleted !== undefined) {
        filters.includeCompleted = req.query.includeCompleted === 'true';
      }

      if (req.query.includeArchived !== undefined) {
        filters.includeArchived = req.query.includeArchived === 'true';
      }

      // Sorting parameters
      if (req.query.sortBy) filters.sortBy = req.query.sortBy;
      if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder;

      // Pagination parameters
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      if (req.query.offset) filters.offset = parseInt(req.query.offset as string);

      // Field selection parameters
      if (req.query.mode) filters.mode = req.query.mode;

      if (req.query.includeNullDates !== undefined) {
        filters.includeNullDates = req.query.includeNullDates === 'true';
      }

      // Handle array parameters
      if (req.query.tags) {
        filters.tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      }

      if (req.query.fields) {
        filters.fields = Array.isArray(req.query.fields) ? req.query.fields : [req.query.fields];
      }

      if (req.query.excludeFields) {
        filters.excludeFields = Array.isArray(req.query.excludeFields)
          ? req.query.excludeFields
          : [req.query.excludeFields];
      }

      const result = await mcpClient.callTool('list_todos', filters);

      // Generate ETag based on query params and latest modification
      if (result.success && result.todos && result.todos.length > 0) {
        // Find the most recently modified todo
        const latestModified = result.todos.reduce((latest: string, todo: any) => {
          const todoTime = new Date(todo.modifiedAt).getTime();
          const latestTime = latest ? new Date(latest).getTime() : 0;
          return todoTime > latestTime ? todo.modifiedAt : latest;
        }, '');

        // Generate ETag combining query hash and latest modification time
        const queryHash = JSON.stringify(filters);
        const etag = `"list-${Buffer.from(queryHash).toString('base64').substring(0, 16)}-${new Date(latestModified).getTime()}"`;

        // Check If-None-Match header
        if (req.headers['if-none-match'] === etag) {
          res.status(304).end(); // Not Modified
          return;
        }

        // Set ETag and cache headers
        res.set('ETag', etag);
        res.set('Cache-Control', 'private, must-revalidate, max-age=0');
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Search todos
  router.get('/search', async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query.q || req.query.query;

      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      const result = await mcpClient.callTool('search_todos', { query });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get filter options (projects, tags, assignees, priorities)
  router.get('/filter-options', async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await mcpClient.callTool('get_filter_options', {});
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single todo
  router.get('/:id', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await mcpClient.callTool('get_todo', { id: req.params.id });

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      // Generate ETag from todo's ID and modifiedAt timestamp
      const todo = result.todo;
      const etag = `"${todo.id}-${new Date(todo.modifiedAt).getTime()}"`;

      // Check If-None-Match header for conditional GET
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end(); // Not Modified
        return;
      }

      // Set ETag and cache headers
      res.set('ETag', etag);
      res.set('Cache-Control', 'private, must-revalidate');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create todo
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate required fields
      if (!req.body.text || !req.body.project) {
        res.status(400).json({ error: 'Missing required fields: text and project' });
        return;
      }

      const result = await mcpClient.callTool('create_todo', req.body);

      if (!result.success) {
        res.status(400).json({ error: result.error || 'Failed to create todo' });
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Batch create todos
  router.post('/batch', async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body.todos || !Array.isArray(req.body.todos)) {
        res.status(400).json({ error: 'Todos array is required' });
        return;
      }

      if (req.body.todos.length === 0) {
        res.status(400).json({ error: 'Todos array cannot be empty' });
        return;
      }

      const result = await mcpClient.callTool('batch_create_todos', { todos: req.body.todos });

      if (!result.success) {
        res.status(400).json({ error: result.error || 'Failed to create todos' });
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update todo
  router.put('/:id', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      // Check If-Match header for optimistic locking
      const ifMatch = req.headers['if-match'];

      if (ifMatch) {
        // Get current todo to validate ETag
        const currentResult = await mcpClient.callTool('get_todo', { id: req.params.id });

        if (!currentResult.success) {
          res.status(404).json({ error: currentResult.error || 'Todo not found' });
          return;
        }

        const currentTodo = currentResult.todo;
        const currentETag = `"${currentTodo.id}-${new Date(currentTodo.modifiedAt).getTime()}"`;

        // Check if ETags match
        if (ifMatch !== currentETag) {
          res.status(412).json({
            error: 'Precondition Failed: Todo was modified by another client',
            currentVersion: currentTodo,
            expectedETag: ifMatch,
            actualETag: currentETag
          });
          return;
        }
      }

      const updates = { ...req.body, id: req.params.id };
      const result = await mcpClient.callTool('update_todo', updates);

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      // Set new ETag for the updated todo
      const updatedTodo = result.todo;
      const newETag = `"${updatedTodo.id}-${new Date(updatedTodo.modifiedAt).getTime()}"`;
      res.set('ETag', newETag);
      res.set('Cache-Control', 'private, must-revalidate');

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update todo status
  router.patch('/:id/status', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      const validStatuses = ['todo', 'in-progress', 'blocked', 'done'];

      if (!req.body.status || !validStatuses.includes(req.body.status)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
        return;
      }

      const result = await mcpClient.callTool('update_todo', {
        id: req.params.id,
        status: req.body.status
      });

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Complete todo
  router.post('/:id/complete', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await mcpClient.callTool('complete_todo', { id: req.params.id });

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add comment
  router.post('/:id/comment', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body.comment) {
        res.status(400).json({ error: 'Comment text is required' });
        return;
      }

      const result = await mcpClient.callTool('add_comment', {
        id: req.params.id,
        comment: req.body.comment
      });

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete todo
  router.delete('/:id', validateId, async (req: Request, res: Response): Promise<void> => {
    try {
      // Check If-Match header for optimistic locking
      const ifMatch = req.headers['if-match'];

      if (ifMatch) {
        // Get current todo to validate ETag
        const currentResult = await mcpClient.callTool('get_todo', { id: req.params.id });

        if (!currentResult.success) {
          res.status(404).json({ error: currentResult.error || 'Todo not found' });
          return;
        }

        const currentTodo = currentResult.todo;
        const currentETag = `"${currentTodo.id}-${new Date(currentTodo.modifiedAt).getTime()}"`;

        // Check if ETags match
        if (ifMatch !== currentETag) {
          res.status(412).json({
            error: 'Precondition Failed: Todo was modified by another client',
            currentVersion: currentTodo,
            expectedETag: ifMatch,
            actualETag: currentETag
          });
          return;
        }
      }

      const result = await mcpClient.callTool('delete_todo', { id: req.params.id });

      if (!result.success) {
        res.status(404).json({ error: result.error || 'Todo not found' });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}