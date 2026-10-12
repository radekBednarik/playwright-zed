import { test, expect } from '@playwright/test';

test('fails on purpose', async () => {
  expect(1 + 1).toBe(3);
});

test.fixme('fixme on purpose', async () => {
  expect(true).toBe(false);
});

// Real end-to-end failure against the public TodoMVC demo (network required).
test.describe('todomvc', () => {
  test('expects a wrong heading', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc/#/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('tasks', { timeout: 2000 });
  });
});
