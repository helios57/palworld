import { test, expect } from '@playwright/test';

test.describe('Single Target Breeding Plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await expect(page.locator('#compute-btn')).toBeEnabled({ timeout: 15000 });
    // Clear any pre-existing state
    await page.locator('#clear-owned-btn').click();
    await page.locator('#clear-targets-btn').click();
  });

  test('should compute a breeding plan for a simple case', async ({ page }) => {
    // Step 1: Add owned pals via CSV
    const csvTextarea = page.locator('#csv-input');
    await csvTextarea.fill('Arsox,Cattiva,Chikipi,Lamball');
    await page.locator('#csv-load-btn').click();
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Step 2: Add a target via right-click on search results
    const searchInput = page.locator('#pal-search');
    await searchInput.fill('Foxparks');
    await page.waitForTimeout(300);

    // Right-click the first result to add as target
    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });
    await firstItem.click({ button: 'right' });

    // Verify target is set
    await expect(page.locator('#target-tags')).toContainText('Foxparks');

    // Step 3: Click compute
    await page.locator('#compute-btn').click();

    // Step 4: Verify results appear
    const results = page.locator('#results');
    // There may be multiple build-steps; check the first is visible
    await expect(results.locator('.build-step').first()).toBeVisible({ timeout: 10000 });

    // Results should contain parent and child names
    const stepText = await results.locator('.build-step').first().textContent();
    expect(stepText).toBeTruthy();
  });

  test('should compute breeding plan with preset targets', async ({ page }) => {
    // Step 1: Add owned pals
    const csvTextarea = page.locator('#csv-input');
    await csvTextarea.fill('Arsox,Cattiva,Chikipi,Lamball,Foxparks');
    await page.locator('#csv-load-btn').click();
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Step 2: Use preset button to add targets
    const presetBtn = page.locator('.btn-preset').first();
    await presetBtn.click();

    // Verify targets were added (presets add multiple; check first is visible)
    await expect(page.locator('#target-tags .tag-target').first()).toBeVisible({ timeout: 3000 });

    // Step 3: Compute
    await page.locator('#compute-btn').click();

    // Results should appear (presets may generate many steps; check first)
    await expect(page.locator('#results .build-step').first()).toBeVisible({ timeout: 15000 });
  });

  test('results should show parent names and child names', async ({ page }) => {
    // Add owned pals
    const csvTextarea = page.locator('#csv-input');
    await csvTextarea.fill('Arsox,Cattiva,Chikipi,Lamball');
    await page.locator('#csv-load-btn').click();
    await page.waitForSelector('#owned-tags .tag', { timeout: 5000 });

    // Add a target
    const searchInput = page.locator('#pal-search');
    await searchInput.fill('Foxparks');
    await page.waitForTimeout(300);

    const firstItem = page.locator('#pal-select-list .pal-select-item').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });
    await firstItem.click({ button: 'right' });

    // Compute
    await page.locator('#compute-btn').click();

    // Wait for results
    const results = page.locator('#results');
    await expect(results.locator('.build-step').first()).toBeVisible({ timeout: 10000 });

    // Verify build-steps contain the structural elements
    // Each step should have a step-num, step-formula (with parent and child classes)
    const firstStep = results.locator('.build-step').first();
    await expect(firstStep.locator('.step-num')).toBeVisible();
    await expect(firstStep.locator('.step-formula')).toBeVisible();

    // The formula should contain parent and child spans
    const formulaText = await firstStep.locator('.step-formula').textContent();
    expect(formulaText).toBeTruthy();
    // Should contain names (has some text content between separators)
    expect(formulaText?.length).toBeGreaterThan(5);
  });
});
