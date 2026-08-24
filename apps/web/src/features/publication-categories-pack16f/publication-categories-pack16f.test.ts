/**
 * Pack 16F — Admin category management + editor/public consumers (Web).
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

describe("Pack 16F — publication category management (web)", () => {
  it("Admin Publishing exposes Categories tab and management panel", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /categories/);
    assert.match(section, /AdminBlogCategoriesPanel/);
    assert.match(section, /Publication Categories/);

    const panel = readWeb("features/administration/components/AdminBlogCategoriesPanel.tsx");
    assert.match(panel, /Create category/);
    assert.match(panel, /Deactivate/);
    assert.match(panel, /Activate/);
    assert.match(panel, /Delete/);
    assert.match(panel, /reassignToCategoryId|Reassign publications/);
    assert.match(panel, /stable category ID|Category ID stays/i);
    assert.doesNotMatch(panel, /display name as canonical|name as identity/i);
  });

  it("admin API client wires category CRUD endpoints", () => {
    const api = readWeb("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/categories/);
    assert.match(api, /createAdminBlogCategory/);
    assert.match(api, /updateAdminBlogCategory/);
    assert.match(api, /activateAdminBlogCategory/);
    assert.match(api, /deactivateAdminBlogCategory/);
    assert.match(api, /deleteAdminBlogCategory/);
  });

  it("BlogPostEditor and public dropdown consume canonical active category list", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /fetchPublicBlogCategories/);
    assert.match(editor, /categoryOptions/);

    const publicApi = readWeb("features/blog/api.ts");
    assert.match(publicApi, /\/api\/v1\/public\/blog\/categories/);

    const sidebar = readWeb("features/blog/components/BlogCategoriesSidebar.tsx");
    assert.match(sidebar, /categories\.map/);
    assert.match(sidebar, /All Categories/);

    const chart = readWeb("features/blog/components/BlogCategoryChart.tsx");
    assert.match(chart, /PublicBlogCategoryCount/);
  });
});
