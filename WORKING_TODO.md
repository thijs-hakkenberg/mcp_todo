# Working TODO - Git-Based MCP Todo Server

**Last Updated**: 2025-11-08
**Status**: Post-v1.9.0 Development

---

## Recently Completed (v1.9.0) ✅

### ADR-002: Directory-Based Persistence (All 10 Phases Complete)
- ✅ Phase 1-5: Core architecture implementation (DirectoryManager, SymlinkManager, Migration, CRUD)
- ✅ Phase 6-7: Conflict resolution and sync updates
- ✅ Phase 8: Integration tests (20 tests)
- ✅ Phase 9: Performance benchmarks (18 tests, all targets exceeded 10-100x)
- ✅ Phase 10: Documentation & cleanup

### API Server Improvements
- ✅ Fixed MCP client logging (distinguish errors from info messages)
- ✅ Fixed Git initialization messages (show "Loading" vs "Creating")
- ✅ Added .env file support (dotenv integration)
- ✅ Fixed dotenv output parsing (skip non-JSON lines)
- ✅ Implemented graceful shutdown (Ctrl+C works properly)

### Test Suite
- ✅ 326 tests passing (100% suite passing)
- ✅ Performance validated: 1000 todos load in 0ms, write in 1ms
- ✅ Zero regressions

---

## Current Status: Testing & Verification 🧪

### Immediate Testing Required
- [ ] **Restart API server** with new fixes
  - Verify clean startup (no JSON parse errors)
  - Verify proper logging (`[MCP Server]` prefix)
  - Verify todos appear in web frontend
  - Verify graceful shutdown with Ctrl+C

- [ ] **Test Web UI functionality**
  - Load todos from directory structure
  - Create new todos
  - Edit existing todos
  - Delete todos
  - Drag-and-drop status changes
  - Filter and search operations

### Manual Testing (Optional)
- [ ] Test with Claude Desktop integration
- [ ] Test with Claude Code integration
- [ ] Test on Windows (verify symlink/junction support)
- [ ] Test Git sync with remote repository
- [ ] Test concurrent usage (Web UI + Claude simultaneously)

---

## Phase 3: Optional Enhancements (Low Priority) 🔧

### MCP Client Robustness
**Purpose**: Improve reliability of API server ↔ MCP server communication

- [ ] Add reconnection logic for MCP server failures
  - Automatic retry on disconnect (exponential backoff)
  - Maximum retry attempts (e.g., 5 retries)
  - Clear error messages to user

- [ ] Add health check endpoint
  - `/api/health` returns MCP server status
  - Include uptime, last successful operation
  - Monitor child process health

- [ ] Improve error recovery
  - Handle MCP server crashes gracefully
  - Auto-restart MCP server on failure
  - Queue pending requests during reconnection

**Effort**: 2-3 hours
**Risk**: Low
**Priority**: Low (current implementation works well)

---

## Future Feature Ideas 💡

### High Priority

#### 1. Artifact Support (UI)
**Status**: Infrastructure ready (from ADR-002), needs UI
- [ ] Add file upload to todo cards
- [ ] Display attachments in detail modal
- [ ] Support images, PDFs, documents
- [ ] Store in `todos/tasks/{task-id}/artifacts/` directory
- [ ] Preview images in UI

**Effort**: 4-6 hours
**Dependency**: None (infrastructure exists)

#### 2. Rich Task Descriptions
**Status**: README.md extraction implemented, needs UI rendering
- [ ] Render long descriptions (>300 chars) in detail modal
- [ ] Support Markdown rendering
- [ ] Display README.md content from task directory
- [ ] Add visual indicator for tasks with long descriptions

**Effort**: 2-3 hours
**Dependency**: None (README.md extraction works)

#### 3. Project Metadata (PROJECT.md)
**Status**: Directory structure supports it, needs implementation
- [ ] Add PROJECT.md creation UI
- [ ] Display project metadata in project view
- [ ] Support project-level planning documents
- [ ] Show project description in filter dropdown

**Effort**: 3-4 hours
**Dependency**: None (directory structure ready)

### Medium Priority

#### 4. Subtasks and Comments UI
**Status**: Data model supports it, needs UI components
- [ ] Display subtasks in detail modal
- [ ] Add/remove subtasks
- [ ] Display comments thread
- [ ] Add new comments
- [ ] Real-time comment updates

**Effort**: 6-8 hours
**Dependency**: None (backend fully supports subtasks/comments)

#### 5. Dependencies Visualization
**Status**: Data model supports it, needs UI
- [ ] Display task dependencies in detail modal
- [ ] Visualize dependency graph
- [ ] Warn about circular dependencies
- [ ] Show blocking/blocked by relationships

**Effort**: 8-10 hours
**Dependency**: None (backend supports dependencies)

#### 6. Advanced Search
**Status**: Basic search works, needs enhancement
- [ ] Search by multiple fields simultaneously
- [ ] Search within descriptions and comments
- [ ] Save search queries
- [ ] Search history
- [ ] Regular expression support

**Effort**: 4-6 hours
**Dependency**: None

### Low Priority

#### 7. Undo/Redo
**Status**: Not implemented
- [ ] Command pattern for operations
- [ ] Undo stack (configurable depth)
- [ ] Redo stack
- [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- [ ] Visual feedback for undo/redo

**Effort**: 8-10 hours
**Dependency**: Significant refactoring required

#### 8. Keyboard Shortcuts
**Status**: Not implemented
- [ ] Global shortcut handler
- [ ] Create todo (Ctrl+N)
- [ ] Search (Ctrl+F)
- [ ] Navigate between columns (arrow keys)
- [ ] Help modal showing shortcuts (Ctrl+?)

**Effort**: 4-6 hours
**Dependency**: None

#### 9. Dark Mode
**Status**: Not implemented
- [ ] Theme switcher component
- [ ] Dark theme CSS variables
- [ ] Persist theme preference (localStorage)
- [ ] Respect system preference

**Effort**: 2-3 hours
**Dependency**: None

#### 10. Export/Import
**Status**: Not implemented
- [ ] Export todos to JSON
- [ ] Export to CSV
- [ ] Export to Markdown
- [ ] Import from other formats
- [ ] Bulk operations via import

**Effort**: 6-8 hours
**Dependency**: None

---

## Technical Debt & Improvements 🔨

### Code Quality

#### 1. Error Handling Standardization
- [ ] Create consistent error handling patterns across API
- [ ] Standardize error response format
- [ ] Add error logging service
- [ ] Client-side error boundary component

**Effort**: 3-4 hours

#### 2. API Documentation
- [ ] Generate OpenAPI/Swagger documentation
- [ ] Document all endpoints with examples
- [ ] Add request/response schemas
- [ ] Interactive API explorer

**Effort**: 4-6 hours

#### 3. Performance Monitoring
- [ ] Add performance metrics collection
- [ ] Monitor API response times
- [ ] Track MCP server health
- [ ] Dashboard for monitoring

**Effort**: 6-8 hours

### Testing

#### 4. E2E Tests
- [ ] Set up Playwright or Cypress
- [ ] Critical user flow tests
- [ ] Cross-browser testing
- [ ] Visual regression testing

**Effort**: 8-12 hours

#### 5. Load Testing
- [ ] Test with 10,000+ todos
- [ ] Measure performance degradation
- [ ] Identify bottlenecks
- [ ] Optimize if needed

**Effort**: 4-6 hours

### DevOps

#### 6. Docker Support
- [ ] Create Dockerfile for API server
- [ ] Docker Compose setup
- [ ] Development environment in Docker
- [ ] Production-ready image

**Effort**: 4-6 hours

#### 7. CI/CD Pipeline
- [ ] GitHub Actions workflow
- [ ] Automated testing on push
- [ ] Build and deploy automation
- [ ] Release automation

**Effort**: 6-8 hours

---

## Known Issues 🐛

### Critical
- None

### Minor
- ~~Dotenv promotional message appears in logs~~ ✅ FIXED (v1.9.0)
- ~~API server doesn't shutdown gracefully~~ ✅ FIXED (v1.9.0)
- ~~No todos appear in web frontend~~ ✅ FIXED (v1.9.0)

### Cosmetic
- None

---

## Documentation Needs 📚

- [ ] Video tutorial for setup and usage
- [ ] Architecture diagram (visual)
- [ ] API reference documentation
- [ ] Contributing guide
- [ ] Code of conduct
- [ ] Security policy

---

## Decision Needed ❓

None currently. All major architectural decisions completed (ADR-001, ADR-002).

---

## Notes

- **Performance**: System exceeds all targets (10-100x better than requirements)
- **Test Coverage**: 326/326 tests passing (100%)
- **Architecture**: Directory-based persistence provides excellent scalability
- **Next Focus**: Testing current implementation, then artifact support in UI
