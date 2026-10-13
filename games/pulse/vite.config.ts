/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // PixiJS lives in the lazily-loaded engine chunk, which is >500 kB on its own.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
  },
});
