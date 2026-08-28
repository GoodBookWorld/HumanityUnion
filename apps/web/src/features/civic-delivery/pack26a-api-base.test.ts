/**
 * Pack 26A — Web-side civic API base + Admin Pack 03 Subscribers regression helpers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Pack 26A — public civic clients use canonical API base", () => {
  it("civic-delivery imports API_BASE_URL from api-base-url", () => {
    const source = readRepo("apps/web/src/features/civic-delivery/api.ts");
    assert.match(source, /import \{ API_BASE_URL \} from "\.\.\/\.\.\/lib\/api-base-url"/);
    assert.doesNotMatch(source, /localhost:4000/);
  });

  it("civic-compatibility-review imports API_BASE_URL from api-base-url", () => {
    const source = readRepo("apps/web/src/features/civic-compatibility-review/api.ts");
    assert.match(source, /import \{ API_BASE_URL \} from "\.\.\/\.\.\/lib\/api-base-url"/);
    assert.doesNotMatch(source, /localhost:4000/);
  });
});
