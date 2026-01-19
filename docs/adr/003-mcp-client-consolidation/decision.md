# ADR 003: MCP Client Consolidation and Codebase Refactoring

## Status

**ACCEPTED** - (2025-01-19)

Decision: Consolidate duplicated MCP client implementations into a shared abstract base class, modularize MCPServer, extract frontend modal components, and implement security improvements.

## Context

### Problem Statement

A comprehensive code review identified several issues in the codebase:

1. **Code Duplication**: Two nearly identical MCP client implementations
   - `src/api/mcpClient.ts` (265 lines)
   - `src/telegram/services/mcpClient.ts` (323 lines)
   - Both implement the same JSON-RPC communication logic

2. **SRP Violations**: Large monolithic files
   - `src/server/MCPServer.ts` (901 lines) - Contains tool schemas, routing, and 18 handlers
   - `web/src/lib/components/KanbanBoard.svelte` (567 lines) - Contains board layout and 3 modal dialogs

3. **Security Concerns**:
   - Hardcoded path in API client
   - No UUID validation on API routes
   - No XSS protection for markdown rendering

4. **Dead Code**:
   - Unused Vite template file (`Counter.svelte`)
   - Duplicate function (`setProjectFilter` vs `setProjectsFilter`)
   - Legacy file references (`todos.json` instead of `tasks/`)

5. **Performance Issues**:
   - Redundant cache reloads after CRUD operations
   - Inefficient column sorting (sorting 4x instead of once)

### Technical Background

**MCP Client Architecture:**
- Both API and Telegram bots communicate with MCP server via stdio
- JSON-RPC 2.0 protocol for request/response handling
- Similar patterns: spawn process, send requests, handle responses, manage timeouts

**MCPServer Structure:**
- Tool schema definitions (400+ lines)
- Request routing logic
- 18 individual handler methods
- Response formatting utilities

**Frontend Architecture:**
- Svelte 5 with Runes for reactive state
- KanbanBoard as central component
- Modal dialogs for todo CRUD operations

### Constraints

- Must maintain backward compatibility (no breaking changes)
- Must preserve all existing functionality
- Tests must continue passing
- Build must succeed
- API contracts must remain unchanged

## Decision Drivers

1. **Maintainability**: Reduce code duplication to simplify future changes
2. **Single Responsibility**: Each module should have one clear purpose
3. **Security**: Address potential vulnerabilities before exploitation
4. **Performance**: Eliminate unnecessary operations
5. **Testability**: Smaller modules are easier to test
6. **Developer Experience**: Easier to navigate and understand codebase

## Decision

### 1. MCP Client Consolidation

Create a shared abstract base class that encapsulates common JSON-RPC communication logic:

```
src/shared/
├── types.ts           # JSONRPCRequest, SpawnOptions, MCPToolResult, etc.
├── mcpClient.ts       # BaseMCPClient abstract class
└── index.ts           # Module exports
```

**BaseMCPClient provides:**
- Process spawning and lifecycle management
- JSON-RPC request/response handling
- Request ID generation and correlation
- Timeout handling
- Buffer management for partial responses
- Connection state tracking

**Subclasses implement:**
- `getSpawnOptions(): SpawnOptions` - Environment-specific configuration
- Optional: `generateRequestId()` - Custom ID generation
- Optional: `onProcessExit()` - Custom exit handling

### 2. MCPServer Modularization

Extract responsibilities into separate modules:

```
src/server/
├── MCPServer.ts           # Thin orchestrator (routing only)
├── tools/
│   ├── definitions.ts     # All 18 tool schemas
│   └── index.ts
├── handlers/
│   ├── todoHandlers.ts    # CRUD operations
│   ├── filterHandlers.ts  # Filter options
│   ├── syncHandlers.ts    # Git sync and history
│   └── index.ts
└── utils/
    └── response.ts        # successResponse, errorResponse
```

### 3. Frontend Modal Extraction

Extract modal components from KanbanBoard:

```
web/src/lib/components/modals/
├── TodoDetailModal.svelte  # View todo details
├── TodoAddModal.svelte     # Create new todo
└── TodoEditModal.svelte    # Edit existing todo
```

### 4. Security Improvements

- **UUID Validation**: Middleware validates `:id` parameters against UUID regex
- **DOMPurify**: Sanitize markdown content before rendering
- **Safe Defaults**: Use `path.join(os.homedir(), 'my-todos')` instead of hardcoded path

### 5. Performance Optimizations

- Remove redundant `loadTodos()` calls after CRUD operations (in-memory cache already updated)
- Sort todos once, then partition into columns (instead of sorting 4x)

## Consequences

### Positive

- **88% reduction** in API MCP client code (265 → 32 lines)
- **43% reduction** in Telegram MCP client code (323 → 183 lines)
- **90% reduction** in MCPServer.ts (901 → 92 lines)
- **63% reduction** in KanbanBoard.svelte (567 → 211 lines)
- **~1,250 lines eliminated** through consolidation
- Single source of truth for JSON-RPC communication
- Easier to add new MCP clients (just extend BaseMCPClient)
- Handlers can be unit tested independently
- Modal components can be reused elsewhere
- Improved security posture

### Negative

- Additional abstraction layer (minor complexity)
- Need to understand inheritance for MCP clients
- More files to navigate (but each is smaller and focused)

### Neutral

- No impact on API contracts
- No impact on end-user functionality
- Test coverage maintained

## Implementation

### Phase 1: Quick Wins (Completed)
1. Delete `web/src/lib/Counter.svelte`
2. Remove duplicate `setProjectFilter` function
3. Fix hardcoded path in `src/api/mcpClient.ts`
4. Update `get_history` to reference `tasks/`

### Phase 2: Security Fixes (Completed)
1. Add UUID validation middleware to API routes
2. Add DOMPurify for markdown sanitization

### Phase 3: MCP Client Consolidation (Completed)
1. Create `src/shared/types.ts` with shared types
2. Create `src/shared/mcpClient.ts` with BaseMCPClient
3. Refactor API mcpClient to extend base
4. Refactor Telegram mcpClient to extend base

### Phase 4: MCPServer Refactor (Completed)
1. Extract tool definitions to `src/server/tools/`
2. Extract handlers to `src/server/handlers/`
3. Create response utilities
4. Update MCPServer to use extracted modules

### Phase 5: Frontend Component Split (Completed)
1. Extract TodoDetailModal
2. Extract TodoAddModal
3. Extract TodoEditModal
4. Update KanbanBoard to use extracted components

### Phase 6: Performance Optimizations (Completed)
1. Remove redundant `loadTodos()` calls
2. Optimize `columnTodos` sorting

## Verification

After each phase:
- All backend tests pass (325+)
- All frontend tests pass (49)
- All API route tests pass (22)
- Build succeeds
- Manual testing of web UI

## References

- Original code review and refactoring plan
- ADR-001: Svelte 5 Runes Testing Strategy
- ADR-002: Directory-Based Persistence Architecture
- CHANGELOG.md v2.2.0
