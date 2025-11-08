# E2E Tests for Todo Kanban Board

This directory contains end-to-end tests for the Todo Kanban Board web application, built with Playwright.

## Setup

The E2E testing infrastructure is already set up. If you need to install browsers:

```bash
npx playwright install
```

## Running Tests

### Run all E2E tests (headless mode)
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### View test report (after running tests)
```bash
npm run test:e2e:report
```

## Prerequisites

Before running E2E tests, ensure:

1. **API Server is running**: The tests expect the API server to be available
   ```bash
   # From project root
   PORT=3001 npm run dev:api
   ```

2. **Git repository is initialized**: The backend requires a Git repository
   ```bash
   # From project root
   git init
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```

3. **Environment variables are set**: Create a `.env` file in the project root:
   ```
   TODO_REPO_PATH=/path/to/your/todo/repo
   GIT_USER_NAME=Your Name
   GIT_USER_EMAIL=you@example.com
   ```

## Test Coverage

The E2E test suite covers:

### Basic UI
- ✅ Kanban board displays with all columns
- ✅ Statistics in header
- ✅ Search bar functionality
- ✅ Filter options display

### CRUD Operations
- ✅ Create new todo
- ✅ Edit existing todo
- ✅ View todo details
- ✅ Form validation

### User Interactions
- ✅ Double-click to open details
- ✅ Modal open/close
- ✅ Filter by priority
- ✅ Search functionality
- ✅ Clear all filters
- ✅ Refresh todos

### Theme
- ✅ Toggle between light/dark/system modes
- ✅ Theme persistence across reloads

### Drag and Drop
- ✅ Drag todos between columns (basic test)
- Note: Actual drag-drop behavior depends on the drag-drop library implementation

### Responsive Design
- ✅ Mobile viewport (375x667)
- ✅ Tablet viewport (768x1024)
- ✅ Desktop viewport (default)

## Test Structure

```
e2e/
├── README.md                 # This file
└── kanban-board.spec.ts      # Main test suite
```

## Writing New Tests

When adding new tests:

1. **Use descriptive test names**: Clearly state what is being tested
2. **Wait for elements**: Always use `waitForSelector` or `expect().toBeVisible()`
3. **Handle async operations**: Use `await` for all Playwright operations
4. **Clean up**: Tests should not depend on each other
5. **Test isolation**: Each test should set up its own data if needed

Example:
```typescript
test('should do something specific', async ({ page }) => {
  // Setup
  await page.goto('/');
  await page.waitForSelector('.kanban-board');

  // Action
  await page.locator('#someButton').click();

  // Assertion
  await expect(page.locator('#result')).toBeVisible();
});
```

## Debugging Tips

1. **Use UI mode** for interactive debugging:
   ```bash
   npm run test:e2e:ui
   ```

2. **Add screenshots** on failure (already configured in playwright.config.ts)

3. **Use debug mode** to step through tests:
   ```bash
   npm run test:e2e:debug
   ```

4. **Check test-results/** folder for failure artifacts after tests run

5. **View trace files** in the Playwright trace viewer

## Known Limitations

1. **Drag-and-drop tests**: The drag-drop tests are basic and may need adjustment based on the actual drag-drop library behavior (svelte-dnd-action).

2. **Dynamic data**: Tests assume some todos exist. Tests create their own todos where possible, but some tests check for existing items.

3. **Timing**: Some operations may need additional wait times depending on API response speed.

## CI/CD Integration

To run tests in CI:

```bash
# Install dependencies
npm ci
cd web && npm ci

# Install Playwright browsers
cd web && npx playwright install --with-deps chromium

# Start API server in background
PORT=3001 npm run dev:api &

# Run tests
cd web && npm run test:e2e

# Tests will automatically start the dev server if not running
```

## Configuration

See `playwright.config.ts` for:
- Base URL configuration
- Timeout settings
- Browser settings
- Reporter configuration
- WebServer auto-start configuration
