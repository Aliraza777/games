import { defineConfig, devices } from '@playwright/test';

const PORT = 5182;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 90_000,
  workers: 3,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
});
