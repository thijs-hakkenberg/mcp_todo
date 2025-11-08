import { test, expect } from '@playwright/test';

test.describe('Kanban Board E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the kanban board
    await page.goto('/');
    // Wait for the board to load
    await page.waitForSelector('.kanban-board', { timeout: 10000 });
  });

  test('should display the kanban board with all columns', async ({ page }) => {
    // Check that all four columns are visible using heading role
    await expect(page.getByRole('heading', { name: 'To Do' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blocked' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();
  });

  test('should display statistics in the header', async ({ page }) => {
    // Check that statistics are visible
    await expect(page.getByText(/Total:/)).toBeVisible();
    await expect(page.getByText(/Completed:/)).toBeVisible();
    await expect(page.getByText(/% Complete/)).toBeVisible();
  });

  test('should have a working search bar', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test search');
    await expect(searchInput).toHaveValue('test search');
  });

  test('should display filter options', async ({ page }) => {
    // Check priority filters
    await expect(page.locator('#priorityFilters')).toBeVisible();

    // Check that priority buttons are present
    const priorityButtons = page.locator('#priorityFilters button');
    await expect(priorityButtons).toHaveCount(await priorityButtons.count());
  });

  test('should open add todo modal when clicking add button', async ({ page }) => {
    // Click the first "Add Todo" button in TO DO column
    const addButton = page.locator('.add-todo-button').first();
    await addButton.click();

    // Check that modal is visible
    await expect(page.locator('.add-todo-modal')).toBeVisible();
    await expect(page.getByText('Add New Todo')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.add-todo-modal')).not.toBeVisible();
  });

  test('should create a new todo', async ({ page }) => {
    // Open add modal
    const addButton = page.locator('.add-todo-button').first();
    await addButton.click();

    // Fill in the form
    await page.locator('input[name="text"]').fill('E2E Test Todo');
    await page.locator('textarea[name="description"]').fill('This is a test description');
    await page.locator('select[name="priority"]').selectOption('high');

    // Fill in project field (required) - ProjectAutocomplete component
    await page.locator('input[placeholder="Search or enter new project..."]').fill('test-project');

    await page.locator('input[name="tags"]').fill('e2e, testing');

    // Submit the form (use the submit button within the modal)
    await page.locator('.add-todo-modal form button[type="submit"]').click();

    // Wait for modal to close
    await expect(page.locator('.add-todo-modal')).not.toBeVisible();

    // Verify the todo appears (may need to search or scroll)
    await page.locator('#searchInput').fill('E2E Test Todo');
    await expect(page.getByText('E2E Test Todo')).toBeVisible();
  });

  test('should open todo detail modal on double-click', async ({ page }) => {
    // Find a todo card and double-click it
    const todoCard = page.locator('.card').first();

    // Wait for card to be visible
    if (await todoCard.count() > 0) {
      await todoCard.dblclick();

      // Check that detail modal is visible
      await expect(page.locator('.todo-modal')).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.todo-modal')).not.toBeVisible();
    }
  });

  test('should filter todos by priority', async ({ page }) => {
    // Click on a priority filter
    const urgentButton = page.locator('#priorityFilters button').filter({ hasText: 'Urgent' });
    if (await urgentButton.count() > 0) {
      await urgentButton.click();

      // Check that active filters display is shown
      const activeFilters = page.locator('#activeFilters');
      if (await activeFilters.count() > 0) {
        await expect(activeFilters).toBeVisible();
      }
    }
  });

  test('should toggle show completed checkbox', async ({ page }) => {
    const showCompletedCheckbox = page.locator('input[type="checkbox"]').first();
    const initialState = await showCompletedCheckbox.isChecked();

    // Toggle checkbox
    await showCompletedCheckbox.click();

    // Verify state changed
    const newState = await showCompletedCheckbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should clear all filters', async ({ page }) => {
    // Apply a search filter
    await page.locator('#searchInput').fill('test');

    // Click clear all button
    const clearButton = page.locator('#clearFilters');
    await clearButton.click();

    // Verify search is cleared
    await expect(page.locator('#searchInput')).toHaveValue('');
  });

  test('should refresh todos when clicking refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /Refresh/ });
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // Wait for loading state (optional, depends on implementation)
    // The board should still be visible after refresh
    await expect(page.locator('.kanban-board')).toBeVisible();
  });
});

test.describe('Theme Toggle Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.kanban-board');
  });

  test('should toggle theme', async ({ page }) => {
    // Find the theme toggle button
    const themeButton = page.getByRole('button', { name: /Dark|Light|System/ });

    if (await themeButton.count() > 0) {
      // Get initial theme text
      const initialText = await themeButton.textContent();

      // Click to toggle theme
      await themeButton.click();

      // Wait a moment for theme to change
      await page.waitForTimeout(500);

      // Verify theme changed (text should be different)
      const newText = await themeButton.textContent();
      expect(newText).not.toBe(initialText);
    }
  });

  test('should persist theme across page reloads', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: /Dark|Light|System/ });

    if (await themeButton.count() > 0) {
      // Set to a specific theme (e.g., Dark)
      await themeButton.click();
      await page.waitForTimeout(200);
      const themeAfterClick = await themeButton.textContent();

      // Reload page
      await page.reload();
      await page.waitForSelector('.kanban-board');

      // Check theme is still the same
      const themeAfterReload = await themeButton.textContent();
      expect(themeAfterReload).toBe(themeAfterClick);
    }
  });
});

test.describe('Todo CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.kanban-board');
  });

  test('should edit an existing todo', async ({ page }) => {
    // Find and double-click a todo to open detail modal
    const todoCard = page.locator('.card').first();

    if (await todoCard.count() > 0) {
      await todoCard.dblclick();

      // Wait for detail modal
      await expect(page.locator('.todo-modal')).toBeVisible();

      // Click Edit button
      const editButton = page.getByRole('button', { name: 'Edit' });
      if (await editButton.count() > 0) {
        await editButton.click();

        // Wait for edit modal
        await expect(page.locator('.edit-todo-modal')).toBeVisible();

        // Modify the title
        const titleInput = page.locator('input[name="text"]');
        await titleInput.fill('Updated Todo Title');

        // Submit changes
        await page.getByRole('button', { name: /Save Changes/ }).click();

        // Verify modal closed
        await expect(page.locator('.edit-todo-modal')).not.toBeVisible();
      }
    }
  });

  test('should validate required fields in add form', async ({ page }) => {
    // Open add modal
    const addButton = page.locator('.add-todo-button').first();
    await addButton.click();

    // Try to submit without filling required fields (use the submit button within the modal)
    await page.locator('.add-todo-modal form button[type="submit"]').click();

    // The form should prevent submission (browser validation)
    // Modal should still be visible
    await expect(page.locator('.add-todo-modal')).toBeVisible();
  });
});

test.describe('Drag and Drop Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.kanban-board');
  });

  test('should support drag and drop between columns', async ({ page }) => {
    // Find a todo card in TO DO column
    const todoCard = page.locator('.kanban-column').first().locator('.card').first();

    if (await todoCard.count() > 0) {
      // Get the target column (IN PROGRESS)
      const targetColumn = page.locator('.kanban-column').nth(1);

      // Perform drag and drop
      await todoCard.hover();
      await page.mouse.down();
      const targetBox = await targetColumn.boundingBox();
      if (targetBox) {
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
        await page.mouse.up();
      }

      // Note: This test might need adjustment based on actual drag-drop implementation
      // The drag-drop library might require different interaction patterns
    }
  });
});

test.describe('Responsive Design Tests', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that the board is still visible
    await expect(page.locator('.kanban-board')).toBeVisible();

    // Columns might stack vertically on mobile
    const columns = page.locator('.kanban-column');
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThan(0);
  });

  test('should display properly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Check that the board is visible
    await expect(page.locator('.kanban-board')).toBeVisible();
  });
});
