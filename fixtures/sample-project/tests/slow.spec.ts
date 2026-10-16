import { test, expect } from '@playwright/test';
import { openSum } from './helpers/steps';

// Feature 006: steps long enough to watch the executing mark move, plus a printed line.
test('slow steps', async ({ page }) => {
  console.log('hello from the test');
  await test.step('step one', async () => {
    await page.waitForTimeout(2000);
  });
  await test.step('step two', async () => {
    await page.waitForTimeout(2000);
  });
  await test.step('step three', async () => {
    await page.waitForTimeout(2000);
  });
  await openSum(page);
  await expect(page.locator('#sum')).toHaveText('3');
});
