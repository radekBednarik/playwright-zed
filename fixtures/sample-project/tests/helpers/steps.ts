import { test, type Page } from '@playwright/test';

// Feature 006: a step located in a helper file, so step marks can be checked outside the spec.
export async function openSum(page: Page): Promise<void> {
  await test.step('open sum', async () => {
    await page.waitForTimeout(1500); // long enough to watch the mark in this file
    await page.setContent('<p id="sum">3</p>');
  });
}
