import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

/**
 * Vitest Configuration
 *
 * Supports both Node.js and Browser testing:
 * - Node environment: Unit/integration tests (fast)
 * - Browser environment: Tests requiring real browser (authentication, HTMX)
 *
 * Compatible with Playwright E2E tests (run separately)
 */
export default defineConfig({
  test: {
    // Enable globals (Jest-compatible)
    globals: true,

    // Test file patterns
    // Node tests: *.test.js (exclude browser tests)
    // Browser tests: *.browser.test.js (only when --browser flag used)
    include: process.env.VITEST_BROWSER ? ['tests/**/*.browser.test.js'] : ['tests/**/*.test.js'],
    exclude: process.env.VITEST_BROWSER
      ? ['tests/e2e/**', 'node_modules/**']
      : ['tests/**/*.browser.test.js', 'tests/e2e/**', 'node_modules/**'],

    // Browser mode configuration
    // Only enabled when --browser flag is used
    browser: {
      enabled: false, // Only enable when --browser flag is used
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      // Browser-specific test files
      isolate: true,
      // Headless mode (set to false to see browser)
      headless: true,
    },

    // Default environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['server.js', 'src/**/*.js'],
      exclude: ['src/**/*.test.js', 'tests/**', 'node_modules/**'],
      reportsDirectory: './coverage',
      // Coverage thresholds - require 85% coverage
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
        // Allow coverage to be calculated even if thresholds not met
        autoUpdate: false,
      },
    },

    // Setup files
    setupFiles: [],

    // Test timeout
    testTimeout: 30000, // Increased to 30s to handle network operations and large evidence arrays

    // Watch mode
    watch: false,
  },

  // ES modules support
  esbuild: {
    target: 'node20',
  },
});
