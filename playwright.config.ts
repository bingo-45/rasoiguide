import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm --filter @rasoiguide/web preview --host 127.0.0.1",
    port: 4173,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 5"] }
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
