import { defineConfig, devices } from '@playwright/test';

const PORT = 5194;

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  outputDir: 'e2e/.results',
  timeout: 90_000,
  workers: 3,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 820 } }, grep: /@desktop/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@mobile/ },
  ],
  webServer: { command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: true },
});
