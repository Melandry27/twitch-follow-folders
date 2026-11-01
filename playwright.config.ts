import { defineConfig } from '@playwright/test';

// Les tests e2e chargent l'extension compilée (dist/) dans Chromium.
// Lancer `npm run build` avant `npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    screenshot: 'only-on-failure',
  },
});
