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
