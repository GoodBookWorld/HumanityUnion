import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/features",
  testMatch: [
    "**/pack08k-playwright.e2e.ts",
    "**/media-plp-cold-cache.playwright.e2e.ts",
    "**/media-plp-locale-switch.playwright.e2e.ts",
    "**/workspace-pwa-root-width-15d8e1.playwright.e2e.ts",
    "**/seo-a11y-contrast-seo10.playwright.e2e.ts",
    "**/hyd-01a-utc-dates.playwright.e2e.ts",
    "**/hyd-01b-geography-names.playwright.e2e.ts",
    "**/a11y-01-public-corrections.playwright.e2e.ts",
    "**/region-500a-dynamic-route.playwright.e2e.ts",
    "**/region-500b2-real-region-web.playwright.e2e.ts",
    "**/region-500b3-seo-a11y.playwright.e2e.ts",
  ],
  timeout: 60_000,
  retries: 0,
  use: {
    headless: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
