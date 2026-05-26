import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/fixtures/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'src/runtime/playwright/**',
        'src/runtime/metrics/lighthouse.js',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
    testTimeout: 15000,
  },
});
