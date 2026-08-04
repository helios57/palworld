import { test, expect } from '@playwright/test';

test.describe('UI Select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await expect(page.locator('#compute-btn')).toBeEnabled({ timeout: 15000 });
    // Clear any pre-existing state
    await page.locator('#clear-owned-btn').click();
  });

  test('should show matching results when typing in search', async ({ page }) => {
    const searchInput = page.locator('#pal-search');
    const palList = page.locator('#pal-select-list');

    // Initial state: the list has items (all pals)
    await page.waitForSelector('#pal-select-list .pal-select-item', { timeout: 10000 });

    // Type a specific search
    await searchInput.fill('Anubis');

    // Wait for results to filter
    await page.waitForTimeout(300);

    const items = palList.locator('.pal-select-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    // All visible items should contain "Anubis" (case-insensitive)
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('anubis');
    }
  });

  test('should add a pal to owned on click', async ({ page }) => {
    const searchInput = page.locator('#pal-search');

    // Search for a specific pal
    await searchInput.fill('Anubis');
    await page.waitForTimeout(300);

    // Click the first matching result
    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });
    await firstItem.click();

    // Verify it appears in owned-tags
    await expect(page.locator('#owned-tags')).toContainText('Anubis');
  });

  test('should remove a pal from owned on second click', async ({ page }) => {
    const searchInput = page.locator('#pal-search');

    // Search and add a pal
    await searchInput.fill('Anubis');
    await page.waitForTimeout(300);

    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click to add
    await firstItem.click();
    await expect(page.locator('#owned-tags')).toContainText('Anubis');

    // Click again to remove
    await firstItem.click();
    await expect(page.locator('#owned-tags')).not.toContainText('Anubis', { timeout: 3000 });
  });

  test('should show "no results" message for unmatched search', async ({ page }) => {
    const searchInput = page.locator('#pal-search');
    const palList = page.locator('#pal-select-list');

    // Type something that won't match any pal
    await searchInput.fill('ZZZZZZZZZZNotAPal');
    await page.waitForTimeout(300);

    // Should show the "no pals found" message
    await expect(palList).toContainText('No pals found matching your search');
  });
});
