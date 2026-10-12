import { test, expect } from '@playwright/test';

test('fails on purpose', async () => {
  expect(1 + 1).toBe(3);
});

test.fixme('fixme on purpose', async () => {
  expect(true).toBe(false);
});
