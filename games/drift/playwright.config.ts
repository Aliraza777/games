import { defineConfig, devices } from '@playwright/test';

const PORT = 5181;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the locally installed Chrome; run `npx playwright install chromium` and drop this to use the bundled one.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
});
