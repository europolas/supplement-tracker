import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser-tests', timeout: 30000, fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4175', viewport: { width: 402, height: 874 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && node scripts/serve.mjs --port 4175', url: 'http://127.0.0.1:4175', reuseExistingServer: false }
});
