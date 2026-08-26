/**
 * Pack 20C — publication category priority ordering (API unit).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareBlogCategoryOrder,
  moveCategoryIdInOrder,
  planBlogCategoryReorder,
} from "../../../src/modules/blog/blog-category-order.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("Pack 20C — publication category priority ordering (API)", () => {
  it("plans sequential sortOrder assignments for a full valid reorder", () => {
    const plan = planBlogCategoryReorder({
      existingCategoryIds: ["a", "b", "c"],
      orderedCategoryIds: ["c", "a", "b"],
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) {
      return;
    }
    assert.deepEqual(plan.assignments, [
      { categoryId: "c", sortOrder: 1 },
      { categoryId: "a", sortOrder: 2 },
      { categoryId: "b", sortOrder: 3 },
    ]);
  });

  it("rejects duplicate, missing, and unknown category ids", () => {
    assert.equal(
      planBlogCategoryReorder({
        existingCategoryIds: ["a", "b"],
        orderedCategoryIds: ["a", "a"],
      }).ok,
      false,
    );
    assert.equal(
      planBlogCategoryReorder({
        existingCategoryIds: ["a", "b"],
        orderedCategoryIds: ["a"],
      }).ok,
      false,
    );
    assert.equal(
      planBlogCategoryReorder({
        existingCategoryIds: ["a", "b"],
        orderedCategoryIds: ["a", "z"],
      }).ok,
      false,
    );
  });

  it("sorts by sortOrder then name", () => {
    const rows = [
      { categoryId: "b", name: "Beta", sortOrder: 2 },
      { categoryId: "a", name: "Alpha", sortOrder: 1 },
      { categoryId: "c", name: "Gamma", sortOrder: 2 },
    ];
    const sorted = [...rows].sort(compareBlogCategoryOrder);
    assert.deepEqual(
      sorted.map((row) => row.categoryId),
      ["a", "b", "c"],
    );
  });

  it("move up/down matches drag index semantics for persistence payloads", () => {
    const ids = ["a", "b", "c"];
    assert.deepEqual(moveCategoryIdInOrder(ids, "b", "up"), ["b", "a", "c"]);
    assert.deepEqual(moveCategoryIdInOrder(ids, "b", "down"), ["a", "c", "b"]);
  });

  it("wires reorder route and admin service with authorization", () => {
    const routes = readApi("src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/categories\/reorder/);
    assert.match(routes, /reorderAdminBlogCategories/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);

    const service = readApi("src/modules/blog/blog-category-admin.service.ts");
    assert.match(service, /reorderAdminBlogCategories/);
    assert.match(service, /planBlogCategoryReorder/);
    assert.match(service, /assertAdminActor/);
    assert.match(service, /maxSortOrder \+ 1/);
    assert.match(service, /applyBlogCategorySortOrders/);
  });

  it("lists and public cache sort by sortOrder", () => {
    const categories = readApi("src/modules/blog/blog-categories.ts");
    assert.match(categories, /compareBlogCategoryOrder/);
    assert.match(categories, /sortOrder: index \+ 1/);

    const admin = readApi("src/modules/blog/blog-category-admin.service.ts");
    assert.doesNotMatch(admin, /localeCompare\(b\.name\)/);
    assert.match(admin, /compareBlogCategoryOrder/);
  });

  it("BlogCategoryRecord includes sortOrder in types", () => {
    const types = readFileSync(
      path.resolve(apiRoot, "../../packages/types/src/domain/blog.ts"),
      "utf8",
    );
    assert.match(types, /readonly sortOrder: number/);
  });
});
