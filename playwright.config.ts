import { defineConfig } from '@playwright/test';

export const config = defineConfig({
  fullyParallel: false,
  workers: 2,

  use: {
    baseURL: 'https://the-internet.herokuapp.com',

    headless: true,
    launchOptions: {
      slowMo: 1000,
    },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
});

export default config;