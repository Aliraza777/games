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
    // Node ≥ 25's built-in localStorage shadows jsdom's and warns; tests use jsdom's.
    execArgv: Number(process.versions.node.split('.')[0]) >= 22 ? ['--no-experimental-webstorage'] : [],
  },
});
