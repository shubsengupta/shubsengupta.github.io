import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  webServer: { command: 'python3 -m http.server 4381 -d dist', port: 4381, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4381' },
});
