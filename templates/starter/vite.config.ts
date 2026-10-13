/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { versions: { node: string } };

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Node ≥ 22 has a built-in localStorage that shadows jsdom's; turn it off for tests.
    execArgv: Number(process.versions.node.split('.')[0]) >= 22 ? ['--no-experimental-webstorage'] : [],
  },
});
