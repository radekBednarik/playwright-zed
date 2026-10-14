import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Feature 005: a second project that also runs on Chromium, so CI installs no extra browser.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
