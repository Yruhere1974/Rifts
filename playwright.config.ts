import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry",
    reducedMotion: "reduce",
  },
  webServer: [
    {
      command: "npm run dev -w @rifts/server",
      url: "http://127.0.0.1:2568/__healthcheck",
      env: { PORT: "2568" },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -w @rifts/web -- --host 127.0.0.1 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
