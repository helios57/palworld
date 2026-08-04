import { test, expect } from '@playwright/test';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await expect(page.locator('#compute-btn')).toBeEnabled({ timeout: 15000 });
    // Clear any pre-existing state
    await page.locator('#clear-owned-btn').click();
    await page.locator('#clear-targets-btn').click();
  });

  test('should show error when computing with no owned pals', async ({ page }) => {
    // Clear everything to ensure empty state
    await page.locator('#clear-owned-btn').click();
    await page.locator('#clear-targets-btn').click();

    // Add a target so we have something to compute
    const searchInput = page.locator('#pal-search');
    await searchInput.fill('Foxparks');
    await page.waitForTimeout(300);

    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });
    await firstItem.click({ button: 'right' });

    // Clear owned again to make sure we have targets but no owned
    await page.locator('#clear-owned-btn').click();

    // Click compute
    await page.locator('#compute-btn').click();

    // Should show error about needing owned pals
    await expect(page.locator('#results .box.error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#results .box.error')).toContainText('owned');
  });

  test('should show error when computing with no targets', async ({ page }) => {
    // Add owned pals but no targets
    const csvTextarea = page.locator('#csv-input');
    await csvTextarea.fill('Arsox,Cattiva');
    await page.locator('#csv-load-btn').click();
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Ensure no targets
    await page.locator('#clear-targets-btn').click();

    // Click compute
    await page.locator('#compute-btn').click();

    // Should show error about needing at least one target
    await expect(page.locator('#results .box.error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#results .box.error')).toContainText('target');
  });

  test('should clear all owned pals when clicking Clear All', async ({ page }) => {
    // Add owned pals
    const csvTextarea = page.locator('#csv-input');
    await csvTextarea.fill('Arsox,Cattiva,Chikipi');
    await page.locator('#csv-load-btn').click();
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Verify pals are there
    await expect(page.locator('#owned-tags')).toContainText('Arsox');

    // Clear all owned
    await page.locator('#clear-owned-btn').click();

    // Verify they're gone
    await expect(page.locator('#owned-tags')).not.toContainText('Arsox', { timeout: 3000 });
    await expect(page.locator('#owned-tags')).not.toContainText('Cattiva', { timeout: 3000 });

    // Should show the "no pals" message
    await expect(page.locator('#owned-tags')).toContainText('No pals added yet');
  });

  test('should clear all targets when clicking Clear All', async ({ page }) => {
    // Add a target
    const searchInput = page.locator('#pal-search');
    await searchInput.fill('Anubis');
    await page.waitForTimeout(300);

    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });
    await firstItem.click({ button: 'right' });

    // Verify target is there
    await expect(page.locator('#target-tags')).toContainText('Anubis');

    // Clear all targets
    await page.locator('#clear-targets-btn').click();

    // Verify it's gone
    await expect(page.locator('#target-tags')).not.toContainText('Anubis', { timeout: 3000 });
    await expect(page.locator('#target-tags')).toContainText('No targets selected');
  });

  test('should show no-results message for empty search', async ({ page }) => {
    const searchInput = page.locator('#pal-search');
    const palList = page.locator('#pal-select-list');

    // Type something that won't match any pal
    await searchInput.fill('XYZZYNotFound12345');
    await page.waitForTimeout(500);

    // Should show appropriate message
    await expect(palList).toContainText('No pals found');
  });
});
