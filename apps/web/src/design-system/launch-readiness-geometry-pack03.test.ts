import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Readiness Pack 03 — Geometry Convergence", () => {
  it("defines canonical outer / reading / form / document / dialog tokens", () => {
    const tokens = read("design-system/tokens.css");
    assert.match(tokens, /--hu-page-max-width:\s*var\(--hu-content-max-width\)/);
    assert.match(tokens, /--hu-workspace-max-width:\s*75rem/);
    assert.match(tokens, /--hu-reading-max-width:\s*46rem/);
    assert.match(tokens, /--hu-form-max-width:\s*40rem/);
    assert.match(tokens, /--hu-document-max-width:\s*48rem/);
    assert.match(tokens, /--hu-dialog-max-width:\s*28rem/);
    assert.match(tokens, /--hu-sidebar-width:\s*13\.75rem/);
  });

  it("exposes shared page / reading / form / document container utilities", () => {
    const layout = read("design-system/layout.css");
    assert.match(layout, /\.hu-page-container\s*\{/);
    assert.match(layout, /\.humanity-workspace-page\s*\{/);
    assert.match(layout, /\.hu-reading-column\s*\{/);
    assert.match(layout, /\.hu-form-column\s*\{/);
    assert.match(layout, /\.hu-document-column\s*\{/);
    assert.match(layout, /grid-template-columns:\s*var\(--hu-sidebar-width\)/);
  });

  it("converges Civic Media outer shell to page max-width", () => {
    const css = read("features/civic-media-center/civic-media-center.css");
    assert.match(css, /\.civic-media-page__container\s*\{[^}]*var\(--hu-page-max-width\)/s);
    assert.doesNotMatch(css, /width:\s*min\(100%,\s*90rem\)/);
  });

  it("centers former 720px lifecycle public shells on page max-width", () => {
    const petition = read("app/petitions/public/[petitionId]/public-petition-page.css");
    assert.match(petition, /var\(--hu-page-max-width\)/);
    assert.match(petition, /margin-inline:\s*auto/);
    assert.doesNotMatch(petition, /720px/);
  });

  it("wraps Publishing / Editorial / Authoring with humanity-workspace-page", () => {
    for (const rel of [
      "app/workspace/authoring/page.tsx",
      "app/workspace/publishing/page.tsx",
      "app/workspace/editorial/page.tsx",
      "app/workspace/publishing/new/page.tsx",
    ]) {
      assert.match(read(rel), /humanity-workspace-page/);
    }
  });

  it("keeps Blog editorial measure on the reading token inside the page container", () => {
    const css = read("features/blog/blog.css");
    assert.match(css, /var\(--hu-reading-max-width\)/);
    assert.match(css, /hu-page-container|var\(--hu-page-max-width\)/);
  });
});
