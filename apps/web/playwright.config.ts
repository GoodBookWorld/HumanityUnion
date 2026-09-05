import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/features/language",
  testMatch: "**/pack08k-playwright.e2e.ts",
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
