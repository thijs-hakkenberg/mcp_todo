import { z } from 'zod';
import { uuidv7 } from 'uuidv7';

// Zod schema for subtask
const SubtaskSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  completed: z.boolean()
});

// Zod schema for comment
const CommentSchema = z.object({
  id: z.string().uuid(),
  user: z.string(),
  text: z.string().min(1),
  timestamp: z.string().datetime()
});

// Zod schema for field timestamps
const FieldTimestampsSchema = z.object({
  text: z.string().datetime(),
  status: z.string().datetime(),
  priority: z.string().datetime(),
  project: z.string().datetime(),
  tags: z.string().datetime(),
  assignee: z.string().datetime().optional(),
  description: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  dependencies: z.string().datetime(),
  subtasks: z.string().datetime(),
  comments: z.string().datetime()
});

// Main Todo schema
export const TodoSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'blocked', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  project: z.string(),
  tags: z.array(z.string()),
  assignee: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  dependencies: z.array(z.string().uuid()),
  subtasks: z.array(SubtaskSchema),
  comments: z.array(CommentSchema),
  fieldTimestamps: FieldTimestampsSchema,
  // Archive fields (for soft delete)
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().optional()
});

// Type inference from schema
export type Todo = z.infer<typeof TodoSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Comment = z.infer<typeof CommentSchema>;

// Helper type for creating a new todo (some fields are optional/auto-generated)
export type CreateTodoInput = {
  id?: string;
  text: string;
  description?: string;
  status?: Todo['status'];
  priority?: Todo['priority'];
  project: string;
  tags?: string[];
  assignee?: string;
  createdBy: string;
  createdAt?: string;
  modifiedAt?: string;
  dueDate?: string;
  completedAt?: string | null;
  dependencies?: string[];
  subtasks?: Subtask[];
  comments?: Comment[];
};

// Helper type for updating a todo (all fields optional except id)
export type UpdateTodoInput = Partial<Omit<Todo, 'id' | 'createdAt' | 'createdBy' | 'fieldTimestamps'>>;

// Field selection mode for filtering returned fields
export type FieldSelectionMode = 'minimal' | 'standard' | 'full' | 'custom';

// Options for field selection and projection
export interface FieldSelectionOptions {
  mode?: FieldSelectionMode;
  fields?: string[];
  excludeFields?: string[];
  includeNullDates?: boolean;
}

/**
 * Creates a new Todo with auto-generated fields
 */
export function createTodo(input: CreateTodoInput): Todo {
  const now = new Date().toISOString();

  const todo: Todo = {
    id: input.id || uuidv7(),
    text: input.text,
    description: input.description,
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    project: input.project,
    tags: input.tags || [],
    assignee: input.assignee,
    createdBy: input.createdBy,
    createdAt: input.createdAt || now,
    modifiedAt: input.modifiedAt || now,
    dueDate: input.dueDate,
    completedAt: input.completedAt || null,
    dependencies: input.dependencies || [],
    subtasks: input.subtasks || [],
    comments: input.comments || [],
    fieldTimestamps: {
      text: now,
      status: now,
      priority: now,
      project: now,
      tags: now,
      assignee: input.assignee ? now : undefined,
      description: input.description ? now : undefined,
      dueDate: input.dueDate ? now : undefined,
      completedAt: input.completedAt ? now : undefined,
      dependencies: now,
      subtasks: now,
      comments: now
    }
  };

  // Validate the created todo
  return TodoSchema.parse(todo);
}

/**
 * Updates a Todo and manages field timestamps
 */
export function updateTodo(todo: Todo, updates: UpdateTodoInput): Todo {
  const now = new Date().toISOString();
  const updatedTodo = { ...todo };
  const updatedTimestamps = { ...todo.fieldTimestamps };

  // Track which fields actually changed
  const fieldsToUpdate = Object.keys(updates) as (keyof UpdateTodoInput)[];

  for (const field of fieldsToUpdate) {
    const newValue = updates[field];
    const oldValue = todo[field as keyof Todo];

    // Only update if the value actually changed
    if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
      (updatedTodo as any)[field] = newValue;

      // Update the field timestamp
      if (field in updatedTimestamps) {
        (updatedTimestamps as any)[field] = now;
      }
    }
  }

  // Always update modifiedAt if any field changed
  if (fieldsToUpdate.some(field =>
    JSON.stringify(updates[field]) !== JSON.stringify(todo[field as keyof Todo])
  )) {
    updatedTodo.modifiedAt = now;
  }

  updatedTodo.fieldTimestamps = updatedTimestamps;

  // Validate the updated todo
  return TodoSchema.parse(updatedTodo);
}

/**
 * Adds a comment to a Todo
 */
export function addComment(todo: Todo, user: string, text: string): Todo {
  const comment: Comment = {
    id: uuidv7(),
    user,
    text,
    timestamp: new Date().toISOString()
  };

  return updateTodo(todo, {
    comments: [...todo.comments, comment]
  });
}

/**
 * Adds a subtask to a Todo
 */
export function addSubtask(todo: Todo, text: string): Todo {
  const subtask: Subtask = {
    id: uuidv7(),
    text,
    completed: false
  };

  return updateTodo(todo, {
    subtasks: [...todo.subtasks, subtask]
  });
}

/**
 * Toggles a subtask completion status
 */
export function toggleSubtask(todo: Todo, subtaskId: string): Todo {
  const updatedSubtasks = todo.subtasks.map(subtask =>
    subtask.id === subtaskId
      ? { ...subtask, completed: !subtask.completed }
      : subtask
  );

  return updateTodo(todo, { subtasks: updatedSubtasks });
}

/**
 * Marks a Todo as completed
 */
export function completeTodo(todo: Todo): Todo {
  return updateTodo(todo, {
    status: 'done',
    completedAt: new Date().toISOString()
  });
}