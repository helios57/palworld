import { test, expect } from '@playwright/test';

test.describe('Page Load', () => {
  test('should display the correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Palworld Breeding Calculator');
  });

  test('should render key UI elements', async ({ page }) => {
    await page.goto('/');

    // Key elements from the HTML
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#csv-input')).toBeVisible();
    await expect(page.locator('#pal-search')).toBeVisible();
    await expect(page.locator('#compute-btn')).toBeVisible();
    await expect(page.locator('#owned-tags')).toBeVisible();
    await expect(page.locator('#target-tags')).toBeVisible();
    // #results starts empty; check it's attached to the DOM
    await expect(page.locator('#results')).toBeAttached();
    await expect(page.locator('#results-panel')).toBeVisible();
  });

  test('compute button should be enabled after data loads', async ({ page }) => {
    await page.goto('/');

    // Compute button may be enabled from localStorage; wait for app init either way
    const computeBtn = page.locator('#compute-btn');
    await expect(computeBtn).toBeEnabled({ timeout: 15000 });
  });

  test('search input should render pal list items', async ({ page }) => {
    await page.goto('/');

    // Wait for the pal list to be populated (initial render with no filter)
    await page.waitForSelector('#pal-select-list .pal-select-item', { timeout: 15000 });
    const items = page.locator('#pal-select-list .pal-select-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });
});
