import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '*.config.js',
        'dist/',
        'android/',
        'ios/',
      ],
    },
    // Run tests sequentially to match backend pattern
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
