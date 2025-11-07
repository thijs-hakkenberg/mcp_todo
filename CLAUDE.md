# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git-Based MCP Todo Server - A fully implemented Model Context Protocol server for managing todos with Git version control. The project includes:
- Complete MCP server for Claude Desktop and Claude Code integration
- Full-stack web-based Kanban board with Svelte 5 frontend (with full CRUD operations)
- Express API server bridging web UI and MCP server
- Comprehensive test coverage (~94% backend, 100% store tests - component tests excluded due to Svelte 5 runes limitation)

## Development Commands

```bash
# Install dependencies
npm install                     # Backend dependencies
cd web && npm install          # Frontend dependencies

# Build
npm run build                  # Build MCP server

# Run MCP server (for Claude Desktop/Code)
npm start                      # Start MCP server

# Run API server + Web UI
npm run dev:api                # Start API server in watch mode
cd web && npm run dev          # Start Vite dev server

# Or run both concurrently
npm run dev                    # Runs both API server and MCP server

# Run tests
npm test                       # All tests
npm run test:unit              # Unit tests
npm run test:integration       # Integration tests
npm run test:api               # API server tests
cd web && npm test             # Frontend tests
```

## Architecture

The project has two main interfaces:

### 1. MCP Interface (Claude Desktop/Claude Code)
```
Claude Desktop ←→ MCP Server (stdio) ←→ TodoRepository ←→ GitManager ←→ Git Repo
```

Layers:
1. **MCP Server** (`src/index.ts`, `src/server/MCPServer.ts`) - Handles MCP protocol via stdio
2. **TodoRepository** (`src/data/TodoRepository.ts`) - Todo CRUD operations
3. **GitManager** (`src/git/GitManager.ts`) - Git operations and commits
4. **ConflictResolver** (`src/git/ConflictResolver.ts`) - Last-Write-Wins merge strategy
5. **SyncManager** (`src/git/SyncManager.ts`) - Auto-sync with remote repository

### 2. Web Interface (Kanban Board)
```
Browser ←→ Vite Dev Server ←→ API Server (Express) ←→ MCP Client (stdio) ←→ MCP Server ←→ Git Repo
```

Layers:
1. **Frontend** (`web/src/`) - Svelte 5 with Runes-based reactive state
   - Components: KanbanBoard, KanbanColumn, TodoCard, FilterBar
   - Stores: todos.svelte.ts (reactive state management with factory pattern)
   - Features: Create, Read, Update, Delete todos with drag-and-drop status changes
2. **API Server** (`src/api/server.ts`) - Express REST API
3. **MCP Client** (`src/api/mcpClient.ts`) - Stdio communication with MCP server
4. **MCP Server** - Reuses the same server as Claude Desktop

Both interfaces share the same Git repository for data storage.

## Implemented MCP Tools

All tools are fully implemented and tested:

- `create_todo` - Create todo with text, project, priority, tags, assignee, etc.
- `batch_create_todos` - Create multiple todos in a single operation with optional hierarchy
- `list_todos` - List with optional filters (status, priority, tags, project, assignee)
- `get_todo` - Get a single todo by ID
- `update_todo` - Update existing todo properties
- `delete_todo` - Delete (archive) a todo by ID
- `complete_todo` - Mark a todo as done
- `add_comment` - Add a comment to a todo
- `search_todos` - Full-text search across todos
- `get_stats` - Get statistics (total, by status, completion rate)
- `sync_repository` - Manually trigger Git sync
- `get_history` - Get Git commit history for todos

## Critical Implementation Notes

1. **Fully Implemented**: All core functionality is complete with comprehensive tests (308 passing)
2. **Module System**: Backend uses CommonJS (`type: "commonjs"`), frontend uses ES modules
3. **Git Integration**: Each todo operation tracked by Git (commits created by SyncManager)
4. **MCP Protocol**: Uses `@modelcontextprotocol/sdk` v1.20.2 with stdio transport
5. **Data Storage**: Directory-based persistence with symlink views (see Architecture below)
6. **Dual Interfaces**: Same data accessible via MCP (Claude) and Web UI (browser)
7. **Environment Variables**: API server uses same variables as Claude Desktop for consistency
8. **Automatic Migration**: Legacy `todos.json` files automatically migrated to directory structure

## Directory-Based Persistence

### Architecture (ADR-002)

The system uses a directory-based structure with symlink views for optimal scalability and organization:

```
todos/
├── tasks/                          # Primary storage (flat by ID)
│   ├── {task-id}/
│   │   ├── task.json              # Todo metadata
│   │   ├── README.md              # Long descriptions (>300 chars)
│   │   └── artifacts/             # Attached files (future)
│   └── {task-id-2}/
│       └── task.json
├── by-project/                     # Symlink views
│   ├── work/ → ../../tasks/{task-id}/
│   └── personal/ → ../../tasks/{task-id}/
├── by-status/
│   ├── todo/
│   ├── in-progress/
│   ├── blocked/
│   └── done/
├── by-priority/
│   ├── urgent/
│   ├── high/
│   ├── medium/
│   └── low/
├── by-tag/
│   └── {tag}/ → ../../tasks/{task-id}/
└── by-assignee/
    └── {user}/ → ../../tasks/{task-id}/
```

### Key Components

1. **DirectoryManager** (`src/data/DirectoryManager.ts`)
   - Manages task directories and files
   - Handles `task.json` and `README.md` files
   - Atomic writes via GitManager
   - Extracts long descriptions (>300 chars) to README.md

2. **SymlinkManager** (`src/data/SymlinkManager.ts`)
   - Maintains symlink views across all dimensions
   - Cross-platform support (Unix `dir` + Windows `junction`)
   - Intelligent updates (only touch changed properties)
   - Handles all view types: by-project, by-status, by-priority, by-tag, by-assignee

3. **TodoRepository** (`src/data/TodoRepository.ts`)
   - Coordinates CRUD operations with DirectoryManager and SymlinkManager
   - Maintains in-memory cache for fast queries
   - Automatic migration from legacy `todos.json`

### Benefits

- **Artifact Support**: Store images, documents alongside tasks
- **Reduced Conflicts**: Per-task files minimize merge conflict scope
- **Scalability**: Handles 10,000+ tasks efficiently (100 tasks in ~100-200ms)
- **Flexible Organization**: Multiple views via symlinks
- **Git-Friendly**: Granular diffs, clear history
- **Human-Readable**: Plain text files, browsable with any tool

### Migration

Legacy `todos.json` files are automatically migrated:
- Backup created as `todos.json.backup`
- All todos converted to directory format
- Symlinks rebuilt for all views
- Atomic Git commit
- Zero data loss guaranteed

See `docs/MIGRATION.md` for details.

## Todo Data Model

```typescript
interface Todo {
  id: string;                                    // UUIDv7
  text: string;                                  // Required
  project: string;                               // Required
  status: 'todo' | 'in-progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  assignee?: string;
  createdBy?: string;
  createdAt: string;                             // ISO8601
  modifiedAt: string;                            // ISO8601
  dueDate?: string;                              // ISO8601
  completedAt?: string;                          // ISO8601
  description?: string;
  dependencies?: string[];                       // Todo IDs
  subtasks?: Subtask[];
  comments?: Comment[];
  fieldTimestamps: Record<string, string>;       // For conflict resolution
}

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}
```

## Environment Configuration

### For MCP Server (Claude Desktop/Code)
- `TODO_REPO_PATH` - Path to Git repository for storing todos (required)
- `TODO_REPO_URL` - Remote Git repository URL (optional, for sync)
- `GIT_USER_NAME` - Git user name for commits (required)
- `GIT_USER_EMAIL` - Git user email for commits (required)
- `AUTO_SYNC` - Enable automatic sync (true/false, default: false)
- `SYNC_INTERVAL_SECONDS` - Sync interval in seconds (default: 300)

### For API Server (Web UI)
Uses the same variables as MCP server, plus:
- `PORT` - API server port (default: 3001)
- `CORS_ORIGIN` - CORS origin for web frontend (default: http://localhost:5173)
- `NODE_ENV` - Environment mode (development/production)

## Implementation Status

All components are fully implemented:

1. ✅ **Core Types**: Complete type definitions with Zod validation
2. ✅ **Git Operations**: Full Git integration with LWW conflict resolution
3. ✅ **Todo CRUD**: Complete TodoRepository with all operations
4. ✅ **MCP Server**: Full MCP protocol implementation with all tools
5. ✅ **Tests**: Comprehensive test coverage (~94%)
6. ✅ **API Server**: Express server bridging web UI and MCP
7. ✅ **Web Frontend**: Full Svelte 5 kanban board with complete CRUD operations
   - Create todos with add modal
   - View todo details in detail modal
   - Edit todos with comprehensive edit modal (all fields)
   - Delete todos
   - Drag-and-drop status changes
   - Filter and search functionality

## Testing Approach

### Backend Tests (Jest)
- Jest with ts-jest for TypeScript support
- Mock Git operations and file system for unit tests
- Use temporary Git repos for integration tests
- Test error conditions and edge cases
- Supertest for API endpoint testing

### Frontend Tests (Vitest)
- Vitest with jsdom environment for store tests
- Store tests: 49 passing (100% coverage of business logic)
- Component tests: Excluded due to Svelte 5 runes + jsdom limitation (see `web/docs/TESTING_LIMITATIONS.md`)
- Mock API calls with fetch mocks
- Factory pattern enables isolated store testing
- Coverage: 100% for store logic, backend ~94%

## Key Dependencies

### Backend
- `@modelcontextprotocol/sdk` (v1.20.2) - MCP protocol
- `simple-git` (v3.28.0) - Git operations
- `express` (v5.1.0) - API server
- `zod` (v3.25.76) - Schema validation
- `uuidv7` (v1.0.2) - UUID generation
- `date-fns` (v4.1.0) - Date utilities
- TypeScript with CommonJS modules
- Jest with ts-jest for testing

### Frontend
- `svelte` (v5.39.6) - UI framework with Runes
- `vite` (v7.1.7) - Build tool and dev server
- `tailwindcss` (v4.1.16) - CSS framework
- `axios` (v1.13.1) - HTTP client
- `svelte-dnd-action` (v0.9.65) - Drag-and-drop
- TypeScript with ES modules
- Vitest for testing

## Common Pitfalls to Avoid

### General
1. Ensure Git repo is initialized at `TODO_REPO_PATH` before running
2. Set all required environment variables (TODO_REPO_PATH, GIT_USER_NAME, GIT_USER_EMAIL)
3. Validate all user input before processing
4. Use async/await for all Git and file operations
5. Handle concurrent modifications with LWW conflict resolution

### MCP Server
1. Ensure proper error handling with MCP-compliant error responses
2. Remember to commit changes after each todo modification
3. Test with stdio communication (not HTTP)

### API Server
1. Build MCP server (`npm run build`) before starting API server
2. Ensure API server and web frontend use same `TODO_REPO_PATH`
3. Configure CORS properly for production deployments
4. Handle MCP server connection failures gracefully

### Web Frontend
1. Run `npm install` in both root and `web/` directories
2. Start API server before starting web dev server
3. Use optimistic updates with rollback on errors
4. Test drag-and-drop functionality across different browsers

## References

- **Main Documentation**: `README.md` - Complete user guide and setup instructions
- **Migration Guide**: `docs/MIGRATION.md` - Migration from todos.json to directory structure
- **Claude Code Examples**: `docs/CLAUDE_CODE_EXAMPLES.md` - Configuration and usage examples
- **Quick Start Guide**: `docs/QUICKSTART.md` - Quick start for running the kanban board
- **Test Guide**: `docs/TEST_GUIDE.md` - Testing instructions and scenarios
- **Testing Limitations**: `docs/TESTING_LIMITATIONS.md` - Known testing limitations
- **Changelog**: `docs/CHANGELOG.md` - Version history and release notes
- **Architecture Decisions**: `docs/adr/` - Architecture Decision Records
  - **ADR-001**: Svelte 5 Runes Testing Strategy
  - **ADR-002**: Directory-Based Persistence Architecture (see `docs/adr/002-directory-based-persistence/`)
- **API Documentation**: REST API endpoints in `src/api/routes/todos.ts`
- **MCP Tools**: MCP tool definitions in `src/server/MCPServer.ts`
- **Type Definitions**: `src/types/Todo.ts` - Complete data model
- **Data Components**: `src/data/` - DirectoryManager, SymlinkManager, TodoRepository
- **Web Components**: `web/src/lib/components/` - Svelte component implementations