import { test, expect } from '@playwright/test';

test('adds numbers', async ({ page }) => {
  await page.setContent('<p id="sum">3</p>');
  await expect(page.locator('#sum')).toHaveText(String(1 + 2));
});

test('handles (parens) [brackets] "quotes"', async ({ page }) => {
  await page.setContent('<p id="ok">ok</p>');
  await expect(page.locator('#ok')).toHaveText('ok');
});

test.describe('math', () => {
  test('same title', async ({ page }) => {
    await page.setContent('<p id="v">4</p>');
    await expect(page.locator('#v')).toHaveText(String(2 + 2));
  });

  test('multiplies', async ({ page }) => {
    await page.setContent('<p id="v">6</p>');
    await expect(page.locator('#v')).toHaveText(String(2 * 3));
  });
});

test.describe('strings', () => {
  test('same title', async ({ page }) => {
    await page.setContent('<p id="v">ab</p>');
    await expect(page.locator('#v')).toHaveText('a' + 'b');
  });

  test('concatenates', async ({ page }) => {
    await page.setContent('<p id="v">abc</p>');
    await expect(page.locator('#v')).toHaveText(['a', 'b', 'c'].join(''));
  });
});

for (const n of [1, 2]) test(`loop ${n}`, async ({ page }) => { await page.setContent(`<p id="n">${n}</p>`); await expect(page.locator('#n')).toHaveText(String(n)); });

test.skip('skipped on purpose', async ({ page }) => {
  await page.setContent('<p>never runs</p>');
});

// Real end-to-end tests against the public TodoMVC demo (network required).
test.describe('todomvc', () => {
  const url = 'https://demo.playwright.dev/todomvc/#/';

  test('shows the empty app', async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'todos' })).toBeVisible();
    await expect(page.getByPlaceholder('What needs to be done?')).toBeVisible();
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });

  test('adds a todo item', async ({ page }) => {
    await page.goto(url);
    const input = page.getByPlaceholder('What needs to be done?');
    await input.fill('buy milk');
    await input.press('Enter');
    await expect(page.getByTestId('todo-title')).toHaveText(['buy milk']);
    await expect(page.getByTestId('todo-count')).toHaveText('1 item left');
  });

  test('completes a todo and filters it out of Active', async ({ page }) => {
    await page.goto(url);
    const input = page.getByPlaceholder('What needs to be done?');
    await input.fill('buy milk');
    await input.press('Enter');
    await input.fill('walk the dog');
    await input.press('Enter');
    await page.getByTestId('todo-item').nth(0).getByRole('checkbox').check();
    await expect(page.getByTestId('todo-item').nth(0)).toHaveClass(/completed/);
    await page.getByRole('link', { name: 'Active' }).click();
    await expect(page.getByTestId('todo-title')).toHaveText(['walk the dog']);
  });
});
