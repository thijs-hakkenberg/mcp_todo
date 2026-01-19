/**
 * Filter Handlers for MCP Server
 *
 * Handles retrieval of filter options (projects, tags, assignees, priorities).
 */

import { TodoRepository } from '../../data/TodoRepository';
import { successResponse, MCPToolResponse } from '../utils/response';

export class FilterHandlers {
  constructor(private todoRepo: TodoRepository) {}

  async handleGetProjects(_args: any): Promise<MCPToolResponse> {
    const projects = await this.todoRepo.getProjects();
    return successResponse({ projects, count: projects.length });
  }

  async handleGetTags(_args: any): Promise<MCPToolResponse> {
    const tags = await this.todoRepo.getTags();
    return successResponse({ tags, count: tags.length });
  }

  async handleGetAssignees(_args: any): Promise<MCPToolResponse> {
    const assignees = await this.todoRepo.getAssignees();
    return successResponse({ assignees, count: assignees.length });
  }

  async handleGetPriorities(_args: any): Promise<MCPToolResponse> {
    const priorities = await this.todoRepo.getPriorities();
    return successResponse({ priorities, count: priorities.length });
  }

  async handleGetFilterOptions(_args: any): Promise<MCPToolResponse> {
    const options = await this.todoRepo.getFilterOptions();
    return successResponse(options);
  }
}
