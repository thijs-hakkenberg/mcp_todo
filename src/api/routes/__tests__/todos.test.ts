import request from 'supertest';
import express from 'express';
import { createTodoRoutes } from '../todos';
import { MCPClient } from '../../mcpClient';

// Mock MCP Client
jest.mock('../../mcpClient');

describe('Todo Routes', () => {
  let app: express.Application;
  let mockMCPClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    // Create mock MCP client
    mockMCPClient = {
      callTool: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    } as any;

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/todos', createTodoRoutes(mockMCPClient));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/todos', () => {
    it('should return list of todos', async () => {
      const mockTodos = [
        { id: '1', text: 'Todo 1', status: 'todo' },
        { id: '2', text: 'Todo 2', status: 'done' }
      ];

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: mockTodos
      });

      const response = await request(app)
        .get('/api/todos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        todos: mockTodos
      });
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('list_todos', {});
    });

    it('should handle query parameters for filtering', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: []
      });

      await request(app)
        .get('/api/todos?status=todo&priority=high&project=test');

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('list_todos', {
        status: 'todo',
        priority: 'high',
        project: 'test'
      });
    });

    it('should handle array query parameters (tags)', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: []
      });

      await request(app)
        .get('/api/todos?tags=bug&tags=feature');

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('list_todos', {
        tags: ['bug', 'feature']
      });
    });

    it('should handle sorting and limit', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: []
      });

      await request(app)
        .get('/api/todos?sortBy=priority&limit=10');

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('list_todos', {
        sortBy: 'priority',
        limit: 10 // Converted from string to number
      });
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return a single todo', async () => {
      const mockTodo = { id: '123', text: 'Test todo', status: 'todo' };

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: mockTodo
      });

      const response = await request(app)
        .get('/api/todos/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        todo: mockTodo
      });
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('get_todo', { id: '123' });
    });

    it('should handle todo not found', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: false,
        error: 'Todo not found'
      });

      const response = await request(app)
        .get('/api/todos/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Todo not found'
      });
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo', async () => {
      const newTodo = {
        text: 'New todo',
        project: 'test-project',
        priority: 'high'
      };

      const createdTodo = {
        id: '456',
        ...newTodo,
        status: 'todo',
        createdAt: new Date().toISOString()
      };

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: createdTodo
      });

      const response = await request(app)
        .post('/api/todos')
        .send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        todo: createdTodo
      });
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('create_todo', newTodo);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ text: 'Missing project' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: text and project'
      });
      expect(mockMCPClient.callTool).not.toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: false,
        error: 'Creation failed'
      });

      const response = await request(app)
        .post('/api/todos')
        .send({ text: 'Test', project: 'test' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Creation failed'
      });
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update an existing todo', async () => {
      const updates = {
        text: 'Updated text',
        status: 'in-progress'
      };

      const updatedTodo = {
        id: '789',
        ...updates,
        modifiedAt: new Date().toISOString()
      };

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: updatedTodo
      });

      const response = await request(app)
        .put('/api/todos/789')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        todo: updatedTodo
      });
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('update_todo', {
        id: '789',
        ...updates
      });
    });

    it('should handle update errors', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: false,
        error: 'Todo not found'
      });

      const response = await request(app)
        .put('/api/todos/nonexistent')
        .send({ text: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Todo not found'
      });
    });
  });

  describe('PATCH /api/todos/:id/status', () => {
    it('should update todo status', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: { id: '123', status: 'done' }
      });

      const response = await request(app)
        .patch('/api/todos/123/status')
        .send({ status: 'done' });

      expect(response.status).toBe(200);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('update_todo', {
        id: '123',
        status: 'done'
      });
    });

    it('should validate status value', async () => {
      const response = await request(app)
        .patch('/api/todos/123/status')
        .send({ status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid status. Must be one of: todo, in-progress, blocked, done'
      });
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        message: 'Todo deleted successfully'
      });

      const response = await request(app)
        .delete('/api/todos/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Todo deleted successfully'
      });
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('delete_todo', { id: '123' });
    });

    it('should handle deletion errors', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: false,
        error: 'Todo not found'
      });

      const response = await request(app)
        .delete('/api/todos/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Todo not found'
      });
    });
  });

  describe('POST /api/todos/:id/complete', () => {
    it('should mark todo as complete', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: { id: '123', status: 'done', completedAt: new Date().toISOString() }
      });

      const response = await request(app)
        .post('/api/todos/123/complete');

      expect(response.status).toBe(200);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('complete_todo', { id: '123' });
    });
  });

  describe('POST /api/todos/:id/comment', () => {
    it('should add a comment to todo', async () => {
      const comment = { comment: 'This is a test comment' };

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todo: { id: '123', comments: [comment] }
      });

      const response = await request(app)
        .post('/api/todos/123/comment')
        .send(comment);

      expect(response.status).toBe(200);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('add_comment', {
        id: '123',
        comment: 'This is a test comment'
      });
    });

    it('should validate comment is provided', async () => {
      const response = await request(app)
        .post('/api/todos/123/comment')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Comment text is required'
      });
    });
  });

  describe('GET /api/todos/search', () => {
    it('should search todos', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: [{ id: '1', text: 'Matching todo' }]
      });

      const response = await request(app)
        .get('/api/todos/search?q=matching');

      expect(response.status).toBe(200);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('search_todos', {
        query: 'matching'
      });
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/todos/search');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Search query is required'
      });
    });
  });

  describe('POST /api/todos/batch', () => {
    it('should create multiple todos', async () => {
      const todos = [
        { text: 'Todo 1', project: 'test' },
        { text: 'Todo 2', project: 'test' }
      ];

      mockMCPClient.callTool.mockResolvedValue({
        success: true,
        todos: todos.map((t, i) => ({ ...t, id: String(i + 1) }))
      });

      const response = await request(app)
        .post('/api/todos/batch')
        .send({ todos });

      expect(response.status).toBe(201);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith('batch_create_todos', { todos });
    });

    it('should validate batch input', async () => {
      const response = await request(app)
        .post('/api/todos/batch')
        .send({ todos: [] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Todos array cannot be empty'
      });
    });
  });
});