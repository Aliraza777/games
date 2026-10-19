import { defineConfig, devices } from '@playwright/test';

// PW_PROD=1 runs the same tests against a production build (vite preview).
const PROD = !!process.env.PW_PROD;
const PORT = PROD ? 5198 : 5195;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 120_000,
  workers: 2,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 800 } }, grep: /@desktop/ },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] }, grep: /@touch/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: PROD ? `VITE_E2E=1 npm run build && npx vite preview --port ${PORT} --strictPort` : `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !PROD,
    timeout: 120_000,
  },
});
