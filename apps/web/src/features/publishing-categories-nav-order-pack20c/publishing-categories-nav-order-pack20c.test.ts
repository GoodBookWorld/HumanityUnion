/**
 * Pack 20C — Publishing Categories navigation & priority ordering (Web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  moveCategoryIdInOrder,
  moveCategoryIndexInOrder,
} from "../administration/blog-category-reorder";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 20C — Publishing Categories navigation & ordering (web)", () => {
  it("Categories submenu targets Publication Categories section with stable id", () => {
    const section = read("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /PUBLICATION_CATEGORIES_HASH\s*=\s*"publication-categories"/);
    assert.match(section, /id=\{PUBLICATION_CATEGORIES_HASH\}/);
    assert.match(section, /selectPublishingTab\("categories"\)/);
    assert.match(section, /scrollIntoView\(\{\s*behavior:\s*"smooth",\s*block:\s*"start"\s*\}\)/);
    assert.match(section, /getElementById\(PUBLICATION_CATEGORIES_HASH\)/);
  });

  it("supports direct hash deep-link to categories", () => {
    const section = read("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /readInitialPublishingTab/);
    assert.match(section, /hashchange/);
    assert.match(section, /setPublicationCategoriesHash/);
    const css = read("features/administration/components/admin-publishing.css");
    assert.match(css, /#publication-categories\s*\{[^}]*scroll-margin-top/s);
  });

  it("renders category management as one priority table", () => {
    const panel = read("features/administration/components/AdminBlogCategoriesPanel.tsx");
    assert.match(panel, /admin-blog-categories__table/);
    assert.match(panel, /<th scope="col">Order<\/th>/);
    assert.match(panel, /<th scope="col">Category<\/th>/);
    assert.match(panel, /<th scope="col">Slug<\/th>/);
    assert.match(panel, /<th scope="col">Status<\/th>/);
    assert.match(panel, /<th scope="col">Publications<\/th>/);
    assert.match(panel, /<th scope="col">Actions<\/th>/);
    assert.doesNotMatch(panel, /admin-blog-categories__list/);
  });

  it("wires drag reorder and accessible Move up/down to the same persist helper", () => {
    const panel = read("features/administration/components/AdminBlogCategoriesPanel.tsx");
    assert.match(panel, /moveCategoryIndexInOrder/);
    assert.match(panel, /moveCategoryIdInOrder/);
    assert.match(panel, /persistOrder/);
    assert.match(panel, /reorderAdminBlogCategories/);
    assert.match(panel, /Move .* up/);
    assert.match(panel, /Move .* down/);
    assert.match(panel, /draggable/);
  });

  it("persists immediately and restores previous order on failure", () => {
    const panel = read("features/administration/components/AdminBlogCategoriesPanel.tsx");
    assert.match(panel, /Category order saved\./);
    assert.match(panel, /setCategories\(previous\)/);
    assert.match(panel, /formatAuthFormError\(err\)/);
  });

  it("exposes reorder API client", () => {
    const api = read("features/administration/admin-publishing-api.ts");
    assert.match(api, /\/api\/v1\/admin\/publishing\/categories\/reorder/);
    assert.match(api, /orderedCategoryIds/);
  });

  it("move helpers produce deterministic order changes", () => {
    const ids = ["a", "b", "c", "d"];
    assert.deepEqual(moveCategoryIdInOrder(ids, "c", "up"), ["a", "c", "b", "d"]);
    assert.deepEqual(moveCategoryIdInOrder(ids, "a", "up"), ["a", "b", "c", "d"]);
    assert.deepEqual(moveCategoryIndexInOrder(ids, 0, 3), ["b", "c", "d", "a"]);
    assert.deepEqual(moveCategoryIndexInOrder(ids, 3, 1), ["a", "d", "b", "c"]);
  });

  it("preserves Pack 16F CRUD regression expectations", () => {
    const pack16f = read("features/publication-categories-pack16f/publication-categories-pack16f.test.ts");
    assert.match(pack16f, /AdminBlogCategoriesPanel/);
    assert.match(pack16f, /Create category/);
    assert.match(pack16f, /Deactivate/);
  });
});
