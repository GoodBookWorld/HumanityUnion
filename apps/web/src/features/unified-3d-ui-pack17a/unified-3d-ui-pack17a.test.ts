/**
 * Pack 17A — Unified 3D UI surface and control system contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 17A — Unified 3D UI surface and control system", () => {
  it("extends shared tokens for raised/inset/elevated/selected surfaces", () => {
    const tokens = readWeb("design-system/tokens.css");
    assert.match(tokens, /--hu-surface-raised/);
    assert.match(tokens, /--hu-surface-inset/);
    assert.match(tokens, /--hu-border-card/);
    assert.match(tokens, /--hu-shadow-3d/);
    assert.match(tokens, /--hu-shadow-elevated/);
    assert.match(tokens, /--hu-shadow-hover-elevated/);
    assert.match(tokens, /--hu-shadow-inset-field/);
    assert.match(tokens, /--hu-shadow-selected-control/);
    assert.match(tokens, /--hu-color-primary:\s*#0174b0/);
    assert.match(tokens, /--hu-color-accent:\s*#df9815/);
  });

  it("reuses Button control shadow language and adds hu-tab-control / hu-surface utilities", () => {
    const css = readWeb("design-system/components.css");
    assert.match(css, /\.hu-button/);
    assert.match(css, /box-shadow:\s*var\(--hu-shadow-control\)/);
    assert.match(css, /\.hu-surface-raised/);
    assert.match(css, /\.hu-surface-inset/);
    assert.match(css, /\.hu-tab-control/);
    assert.match(css, /aria-selected="true"/);
    assert.match(css, /border-bottom-width:\s*3px/);
    assert.match(css, /--hu-shadow-inset-field/);
    assert.doesNotMatch(css, /glossy|skeuomorph|bevel-hard/i);
  });

  it("Admin Publishing tabs use shared hu-tab-control with accessible selection", () => {
    const section = readWeb(
      "features/administration/components/AdminPublishingSection.tsx",
    );
    assert.match(section, /hu-tab-control/);
    assert.match(section, /hu-tab-control--selected/);
    assert.match(section, /role="tablist"/);
    assert.match(section, /aria-selected/);
    assert.match(section, /Pending applications/);
    assert.match(section, /Pending Review/);
    assert.match(section, /Categories/);

    const css = readWeb("features/administration/components/admin-publishing.css");
    assert.match(css, /--hu-shadow-elevated|--hu-border-card/);
    assert.match(css, /admin-blog-categories__create/);
    assert.match(css, /--hu-shadow-inset-field/);
  });

  it("Publishing forms/dashboard reuse the same surface language", () => {
    const dash = readWeb("features/blog/components/PublishingDashboard.tsx");
    assert.match(dash, /hu-tab-control/);
    assert.match(dash, /publishing-dashboard__tab/);

    const publishing = readWeb("features/blog/publishing.css");
    assert.match(publishing, /publication-list-item[\s\S]*--hu-shadow-elevated/s);
    assert.match(publishing, /blog-post-editor__aside[\s\S]*--hu-border-card/s);
    assert.match(publishing, /blog-publication-optimization[\s\S]*--hu-shadow-elevated/s);
    assert.match(publishing, /blog-authoring-assistant[\s\S]*--hu-border-card/s);
  });
});
