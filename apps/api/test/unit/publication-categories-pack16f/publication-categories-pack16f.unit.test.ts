/**
 * Pack 16F — Admin publication category management (unit / seed contracts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BLOG_CATEGORIES, BLOG_SEED_CATEGORY_IDS } from "@hu/types";

import {
  ensureBlogCategoriesSeeded,
  invalidateBlogCategoryCache,
  isActiveBlogCategoryId,
  isBlogCategoryId,
  listBlogCategories,
  listBlogCategoryRecordsCached,
} from "../../../src/modules/blog/blog-categories.js";
import { validateBlogCategoryId } from "../../../src/modules/blog/blog.validators.js";
import { BlogValidationError } from "../../../src/modules/blog/blog.errors.js";

describe("Pack 16F — publication category management (unit)", () => {
  it("seed catalog keeps stable IDs for existing posts", () => {
    assert.deepEqual(
      [...BLOG_SEED_CATEGORY_IDS],
      ["conscious_existence", "human_security", "our_life"],
    );
    assert.equal(BLOG_CATEGORIES.length, 3);
    assert.ok(BLOG_CATEGORIES.every((category) => category.categoryId !== category.name));
  });

  it("memory/seed cache exposes active categories for selectors", async () => {
    invalidateBlogCategoryCache();
    await ensureBlogCategoriesSeeded();
    const active = listBlogCategories();
    assert.ok(active.length >= 3);
    assert.ok(isActiveBlogCategoryId("our_life"));
    assert.ok(isBlogCategoryId("conscious_existence"));
    assert.equal(validateBlogCategoryId("human_security"), "human_security");
    assert.throws(() => validateBlogCategoryId("not-a-category"), BlogValidationError);
    assert.ok(listBlogCategoryRecordsCached().every((row) => row.status === "active"));
  });
});
