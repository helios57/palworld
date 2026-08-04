import { test, expect } from '@playwright/test';

test.describe('CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await expect(page.locator('#compute-btn')).toBeEnabled({ timeout: 15000 });
  });

  test('should import pals from CSV textarea', async ({ page }) => {
    const csvTextarea = page.locator('#csv-input');
    const loadBtn = page.locator('#csv-load-btn');
    const ownedTags = page.locator('#owned-tags');

    // Clear any existing state first
    await page.locator('#clear-owned-btn').click();

    // Fill in pal names
    await csvTextarea.fill('Arsox\nCattiva\nChikipi\nLamball');
    await loadBtn.click();

    // Wait for tags to appear
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Verify each pal appears in owned-tags
    await expect(ownedTags).toContainText('Arsox');
    await expect(ownedTags).toContainText('Cattiva');
    await expect(ownedTags).toContainText('Chikipi');
    await expect(ownedTags).toContainText('Lamball');
  });

  test('should show correct badge count after import', async ({ page }) => {
    const csvTextarea = page.locator('#csv-input');
    const loadBtn = page.locator('#csv-load-btn');

    // Clear existing state
    await page.locator('#clear-owned-btn').click();

    // Fill and load
    await csvTextarea.fill('Arsox,Cattiva,Chikipi');
    await loadBtn.click();

    // Wait for tags to appear
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Badge should show correct count
    await expect(page.locator('#owned-tags .badge')).toContainText('3 owned');
  });

  test('should import from comma-separated values', async ({ page }) => {
    const csvTextarea = page.locator('#csv-input');
    const loadBtn = page.locator('#csv-load-btn');

    // Clear existing state
    await page.locator('#clear-owned-btn').click();

    // Use comma-separated format
    await csvTextarea.fill('Foxparks,Pengullet,Teafant');
    await loadBtn.click();

    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });
    await expect(page.locator('#owned-tags')).toContainText('Foxparks');
    await expect(page.locator('#owned-tags')).toContainText('Pengullet');
    await expect(page.locator('#owned-tags')).toContainText('Teafant');
  });

  test('should show error for unrecognized pal names', async ({ page }) => {
    const csvTextarea = page.locator('#csv-input');
    const loadBtn = page.locator('#csv-load-btn');

    // Clear existing state
    await page.locator('#clear-owned-btn').click();

    // Type a clearly fictional pal name
    await csvTextarea.fill('NotARealPalXYZ');
    await loadBtn.click();

    // Error message should appear in results
    await expect(page.locator('#results .box.error')).toBeVisible({ timeout: 5000 });
  });
});
