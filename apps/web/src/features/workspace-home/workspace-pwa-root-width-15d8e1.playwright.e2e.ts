/**
 * Step 15D.8E.1 — Workspace Home geometry fixture (emulated viewports).
 *
 * Measures document scrollWidth and card edges for Current Workspace /
 * Getting started / Welcome. Emulated browser only — NOT a claim of real
 * installed-PWA PASS.
 */

import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";

/** Playwright cwd is `apps/web` (see playwright.config.ts). */
const webSrc = path.join(process.cwd(), "src");

function readCss(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

function buildWorkspaceFixtureHtml(options: {
  lang: string;
  dir: "ltr" | "rtl";
  longCopy: boolean;
}): string {
  const tokens = readCss("design-system/tokens.css");
  const layout = readCss("design-system/layout.css");
  const workspacePage = readCss("app/workspace/workspace-page.css");
  const member = readCss("components/member/member-workspace.css");
  const safeArea = readCss("features/pwa/pwa-safe-area.css");
  const section = readCss("components/member/profile-section.css");
  const welcome = readCss("features/workspace-home/components/workspace-welcome-banner.css");
  const personal = readCss("features/workspace-home/components/workspace-personal-header.css");

  const current = options.longCopy
    ? "Current Workspace — " + "W".repeat(48)
    : "Current Workspace";
  const getting = options.longCopy
    ? "Getting started — " + "G".repeat(48)
    : "Getting started";
  const welcomeTitle = options.longCopy
    ? "Welcome to Humanity Union — " + "H".repeat(48)
    : "Welcome to Humanity Union";

  return `<!doctype html>
<html lang="${options.lang}" dir="${options.dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>15D.8E.1 workspace width fixture</title>
<style>
${tokens}
${layout}
${workspacePage}
${member}
${safeArea}
${section}
${welcome}
${personal}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f4f7fa; }
.hu-card { padding: 1rem 1.25rem; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; }
.beta-onboarding { margin-bottom: 1.5rem; }
.workspace-home-dashboard { display: grid; gap: 1.25rem; width: 100%; max-width: 100%; min-width: 0; }
</style>
</head>
<body class="humanity-app">
<div class="humanity-layout">
  <div class="humanity-layout__main" id="main-content">
    <main class="workspace-page humanity-workspace-page">
      <div class="member-workspace member-workspace--with-assistant">
        <aside class="member-workspace__nav" aria-label="Workspace">
          <nav>Sidebar link that must not widen document</nav>
        </aside>
        <div class="member-workspace__main">
          <div class="workspace-personal-header" data-card="current-workspace">
            <div class="workspace-personal-header__actions">
              <span class="workspace-personal-header__workspace-label">${current}</span>
              <a class="workspace-personal-header__link" href="#">Profile</a>
              <button type="button" class="workspace-personal-header__logout">Log out</button>
            </div>
          </div>
          <div class="member-workspace__content-grid">
            <div class="member-workspace__content">
              <div class="workspace-home-dashboard">
                <div class="hu-card beta-onboarding" data-card="getting-started">
                  <h2>${getting}</h2>
                  <p>Complete your profile and explore civic work.</p>
                </div>
                <section class="workspace-welcome-banner" data-card="welcome" aria-label="Welcome">
                  <div class="workspace-welcome-banner__accent"></div>
                  <div class="workspace-welcome-banner__body">
                    <h2 class="workspace-welcome-banner__title">${welcomeTitle}</h2>
                    <p class="workspace-welcome-banner__text">Your operating center for civic participation.</p>
                  </div>
                </section>
                <section class="profile-section">
                  <h2 class="profile-section__title">Quick Actions</h2>
                  <p>Other Workspace Home content stays inside the shell.</p>
                </section>
              </div>
            </div>
            <div class="workspace-home-assistant-rail">
              <button type="button" class="hu-assistant-open-button" style="width:100%;max-width:100%;min-width:0">
                <span class="hu-assistant-open-button__label">Assistant</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
</body>
</html>`;
}

async function withFixtureServer(
  html: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to bind fixture server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function assertViewportFit(
  page: import("@playwright/test").Page,
  width: number,
): Promise<{ scrollWidth: number; clientWidth: number }> {
  await page.setViewportSize({ width, height: 844 });
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const cards = ["current-workspace", "getting-started", "welcome"].map((id) => {
      const el = document.querySelector(`[data-card="${id}"]`) as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      return {
        id,
        left: rect ? rect.left : null,
        right: rect ? rect.right : null,
      };
    });
    return {
      innerWidth: window.innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      cards,
    };
  });

  expect(metrics.scrollWidth, `scrollWidth at ${width}px`).toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  );
  for (const card of metrics.cards) {
    expect(card.left, `${card.id} left`).not.toBeNull();
    expect(card.right, `${card.id} right`).not.toBeNull();
    expect(card.left!, `${card.id} left`).toBeGreaterThanOrEqual(-0.5);
    expect(card.right!, `${card.id} right`).toBeLessThanOrEqual(metrics.innerWidth + 0.5);
  }
  return { scrollWidth: metrics.scrollWidth, clientWidth: metrics.clientWidth };
}

test.describe("15D.8E.1 workspace width fixture", () => {
  test("320 / 390 English LTR — document and cards fit", async ({ page }) => {
    const html = buildWorkspaceFixtureHtml({ lang: "en", dir: "ltr", longCopy: false });
    await withFixtureServer(html, async (baseUrl) => {
      await page.goto(baseUrl);
      await assertViewportFit(page, 320);
      await assertViewportFit(page, 390);
    });
  });

  test("390 long-content LTR — document and cards fit", async ({ page }) => {
    const html = buildWorkspaceFixtureHtml({ lang: "en", dir: "ltr", longCopy: true });
    await withFixtureServer(html, async (baseUrl) => {
      await page.goto(baseUrl);
      await assertViewportFit(page, 390);
    });
  });

  test("390 Arabic RTL — document and cards fit", async ({ page }) => {
    const html = buildWorkspaceFixtureHtml({ lang: "ar", dir: "rtl", longCopy: true });
    await withFixtureServer(html, async (baseUrl) => {
      await page.goto(baseUrl);
      await assertViewportFit(page, 390);
    });
  });

  test("standalone body-class geometry collapses sidebar (display-mode covered in unit CSS)", async ({
    page,
  }) => {
    // Chromium in this runner cannot reliably fake CSS display-mode via CDP.
    // First-paint display-mode rules are asserted statically in the unit suite;
    // body-class rules share the same geometry and are measured here.
    const html = buildWorkspaceFixtureHtml({ lang: "en", dir: "ltr", longCopy: false }).replace(
      '<body class="humanity-app">',
      '<body class="humanity-app humanity-app--pwa-standalone">',
    );
    await withFixtureServer(html, async (baseUrl) => {
      await page.setViewportSize({ width: 1025, height: 900 });
      await page.goto(baseUrl);
      const columns = await page.evaluate(
        () => getComputedStyle(document.querySelector(".member-workspace")!).gridTemplateColumns,
      );
      expect(columns.split(/\s+/).filter(Boolean).length).toBe(1);
      await assertViewportFit(page, 390);
    });
  });
});
