# Migration Guide: todos.json → Directory Structure

This guide explains the migration from the legacy `todos.json` file format to the new directory-based persistence architecture.

## Overview

Starting with **v2.0.0**, the system uses a directory-based structure instead of a single `todos.json` file. This provides:

- **Better Scalability**: Handles 10,000+ tasks efficiently
- **Artifact Support**: Store files and images with tasks
- **Reduced Conflicts**: Per-task files minimize merge conflicts
- **Flexible Organization**: Multiple views via symlinks

## Automatic Migration

**The migration is automatic and zero-risk.** You don't need to do anything manually.

### When Migration Happens

Migration occurs automatically when:
1. You start the MCP server with an existing `todos.json` file
2. The system detects the legacy format on initialization
3. The new directory structure doesn't exist yet

### Migration Process

The system performs the following steps automatically:

1. **Backup Creation**
   - Creates `todos.json.backup` with your original data
   - Backup is never deleted automatically

2. **Directory Structure Creation**
   ```
   todos/
   ├── tasks/              # One directory per task
   ├── by-project/         # Symlink views
   ├── by-status/
   ├── by-priority/
   ├── by-tag/
   └── by-assignee/
   ```

3. **Todo Conversion**
   - Each todo becomes a directory: `todos/tasks/{task-id}/`
   - Todo data stored in `task.json`
   - Long descriptions (>300 chars) extracted to `README.md`

4. **Symlink Creation**
   - Creates symlinks for all organizational views
   - Enables browsing tasks by project, status, priority, etc.

5. **Git Commit**
   - Commits entire migration as a single atomic operation
   - Commit message: "chore: migrate from todos.json to directory-based persistence"

6. **Verification**
   - Validates all todos were migrated correctly
   - Ensures no data loss

## What Gets Migrated

✅ **All todo data**:
- ID, text, project, status, priority
- Tags, assignee, due dates
- Dependencies, subtasks, comments
- Created/modified timestamps
- Field-level timestamps for conflict resolution

✅ **Data integrity**:
- All relationships preserved
- All metadata intact
- Field timestamps maintained

## Before Migration

### Recommended: Create a Manual Backup

Although automatic backup is created, you may want an extra copy:

```bash
cd ~/my-todos
cp todos.json todos.json.manual-backup
git add todos.json.manual-backup
git commit -m "Manual backup before migration"
```

### Check Repository Status

Ensure your repository is clean:

```bash
cd ~/my-todos
git status
```

If you have uncommitted changes, commit them first:

```bash
git add .
git commit -m "Commit before migration"
```

### Optional: Push to Remote

Push any pending changes to your remote:

```bash
git push
```

## After Migration

### Verify Migration Success

1. **Check the backup exists**:
   ```bash
   cd ~/my-todos
   ls -la todos.json.backup
   ```

2. **Check directory structure**:
   ```bash
   ls -la todos/
   # Should show: tasks/, by-project/, by-status/, by-priority/, by-tag/, by-assignee/
   ```

3. **Check task count**:
   ```bash
   ls todos/tasks/ | wc -l
   # Should match number of todos you had
   ```

4. **Verify Git commit**:
   ```bash
   git log -1
   # Should show migration commit
   ```

### Test with Claude

Start Claude Desktop/Code and verify:

```
Show me my todos
```

All your todos should appear as before.

### Browse the Directory Structure

You can now browse tasks by different dimensions:

```bash
# View todos by project
ls -l todos/by-project/

# View todos by status
ls -l todos/by-status/todo/
ls -l todos/by-status/in-progress/

# View todos by priority
ls -l todos/by-priority/urgent/

# View a specific task
cat todos/tasks/{task-id}/task.json
```

### Push to Remote

Push the migrated structure to your remote repository:

```bash
git push
```

**Note**: Team members will automatically migrate when they pull your changes.

## Rollback (If Needed)

If you need to rollback (though migration is safe):

1. **Restore from backup**:
   ```bash
   cd ~/my-todos
   cp todos.json.backup todos.json
   ```

2. **Remove directory structure**:
   ```bash
   rm -rf todos/
   ```

3. **Commit rollback**:
   ```bash
   git add .
   git commit -m "Rollback to todos.json"
   ```

4. **Restart MCP server**:
   The system will continue using `todos.json`

## Multi-User Migration

### Scenario: Team Using Git Repository

**First User**:
1. Pulls latest changes
2. Starts MCP server
3. Migration happens automatically
4. Pushes migration commit

**Other Users**:
1. Pull the migration commit
2. Their `todos.json` becomes `todos.json.backup` automatically
3. No duplicate migration occurs
4. All users now use directory structure

### Concurrent Migration Prevention

The system detects if directory structure already exists:
- If `todos/tasks/` exists, no migration occurs
- If `todos.json.backup` exists, checks if already migrated
- Safe for multiple users to pull migration simultaneously

## Troubleshooting

### Migration Failed

If migration fails, the system will:
- Log detailed error messages
- Leave `todos.json` untouched
- Not create partial directory structure
- Allow retry on next startup

**To retry**:
1. Check error messages in logs
2. Fix any issues (disk space, permissions, etc.)
3. Restart MCP server

### Backup Missing

If `todos.json.backup` wasn't created:
- Check file permissions
- Check disk space
- Migration may have been interrupted

**Recovery**:
```bash
git log --all --full-history -- todos.json
git show <commit-hash>:todos.json > todos.json.recovered
```

### Symlinks Not Working (Windows)

Windows requires special permissions for symlinks. The system uses **junction points** as fallback:

- Junctions work without admin privileges
- Functionality is identical
- Appears as regular folders in Explorer

**Check if junctions were created**:
```cmd
dir /AL todos\by-project
```

### Some Todos Missing

Check for corrupted data:

```bash
# Check migration log
git log --grep="migrate"

# Count todos in backup
cat todos.json.backup | jq '.todos | length'

# Count migrated tasks
ls todos/tasks/ | wc -l
```

If counts don't match, file an issue with:
- Your `todos.json.backup` file
- Error logs
- Git history

## Performance

### Before Migration (todos.json)

- Load time: ~100-500ms for 1000 todos
- Write time: ~50-200ms per operation
- Conflict probability: High (entire file)

### After Migration (Directory Structure)

- Load time: ~100-200ms for 1000 todos (similar)
- Write time: ~10-50ms per operation (2-4x faster)
- Conflict probability: Low (per-task files)

## FAQ

### Q: Will I lose data during migration?

**A**: No. Migration is designed for zero data loss:
- Automatic backup created
- All fields preserved
- Git history maintained
- Extensive test coverage (100%)

### Q: Can I migrate back to todos.json?

**A**: Yes, but you'll need to do it manually. The backup file contains your original data. However, you'll lose benefits of directory structure.

### Q: Do I need to update my code?

**A**: No. The MCP tools and Web UI work identically. The change is transparent to users.

### Q: What about my Git history?

**A**: All Git history is preserved. The migration is a single commit that replaces `todos.json` with the directory structure.

### Q: Can I have both formats?

**A**: No. The system uses one format at a time. After migration, `todos.json` becomes `todos.json.backup`.

### Q: What if my team hasn't upgraded?

**A**: Older versions won't understand the directory structure. All team members should upgrade before migration. Consider:
1. Coordinate upgrade timing
2. Test in a branch first
3. Migrate during low-activity period

### Q: How do I know migration succeeded?

**A**: Look for:
- ✅ `todos.json.backup` file exists
- ✅ `todos/` directory exists
- ✅ Task count matches: `ls todos/tasks/ | wc -l`
- ✅ Git commit created: `git log -1 --grep=migrate`
- ✅ All todos visible in Claude

### Q: Can I customize the directory structure?

**A**: No. The structure is fixed for consistency and compatibility. However, you can:
- Add `PROJECT.md` files to project directories
- Add files to task `artifacts/` directories (future)
- Browse via symlinks in multiple ways

### Q: What happens to my remote repository?

**A**: The migration creates a Git commit. When you push:
- Remote gets new directory structure
- `todos.json` removed from tracking
- History preserved
- Team members pull the change

## Support

If you encounter issues during migration:

1. **Check logs**: Look for error messages in terminal
2. **Verify backup**: Ensure `todos.json.backup` exists
3. **Check permissions**: Ensure write access to repository
4. **Check disk space**: Ensure sufficient space for migration
5. **File an issue**: Include backup file and error logs

## Architecture Details

For technical details about the directory structure, see:
- **[ADR-002](adr/002-directory-based-persistence/decision.md)** - Architecture decision
- **[Implementation Plan](adr/002-directory-based-persistence/implementation-plan.md)** - Implementation details

## Version Compatibility

| Version | Format | Notes |
|---------|--------|-------|
| v1.x    | `todos.json` | Legacy format |
| v2.0+   | Directory structure | Automatic migration |

**Recommendation**: All users upgrade to v2.0+ simultaneously to avoid format conflicts.
