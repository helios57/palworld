import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    cwd: './docs',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:8080',
  },
});
