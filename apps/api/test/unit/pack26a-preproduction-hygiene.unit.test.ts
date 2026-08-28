/**
 * Pack 26A — health surface, visitor cookies, civic API base, tsbuildinfo hygiene.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Pack 26A — repository hygiene and public surfaces", () => {
  it("gitignore covers *.tsbuildinfo and generated web tsbuildinfo is not tracked", () => {
    const gitignore = readRepo(".gitignore");
    assert.match(gitignore, /\*\.tsbuildinfo/);

    const tracked = execSync("git ls-files -- 'apps/web/tsconfig.tsbuildinfo'", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const stagedDelete = execSync(
      "git diff --cached --name-only -- 'apps/web/tsconfig.tsbuildinfo'",
      { cwd: repoRoot, encoding: "utf8" },
    ).trim();

    // `git rm --cached` removes the path from the index (ls-files empty) and stages
    // the deletion. Either state proves Pack 26A untrack work is in place.
    assert.ok(
      tracked === "" || stagedDelete === "apps/web/tsconfig.tsbuildinfo",
      `expected tsbuildinfo untracked or staged for deletion; tracked=${tracked || "(none)"} stagedDelete=${stagedDelete || "(none)"}`,
    );
  });

  it("civic delivery and compatibility public clients use canonical API_BASE_URL", () => {
    const delivery = readRepo("apps/web/src/features/civic-delivery/api.ts");
    const compatibility = readRepo("apps/web/src/features/civic-compatibility-review/api.ts");
    assert.match(delivery, /from \"\.\.\/\.\.\/lib\/api-base-url\"/);
    assert.match(compatibility, /from \"\.\.\/\.\.\/lib\/api-base-url\"/);
    assert.doesNotMatch(delivery, /const API_BASE_URL = \"http:\/\/localhost:4000\"/);
    assert.doesNotMatch(compatibility, /const API_BASE_URL = \"http:\/\/localhost:4000\"/);
  });

  it("visitor petition cookie sets Secure in production", () => {
    const petition = readRepo("apps/api/src/modules/petition/public-petition.routes.ts");
    const support = readRepo("apps/api/src/modules/initiative-support/initiative-support.routes.ts");
    assert.match(petition, /secure:\s*process\.env\.NODE_ENV === \"production\"/);
    assert.match(support, /secure:\s*process\.env\.NODE_ENV === \"production\"/);
  });

  it("production public health omits readiness checklist / provider internals", () => {
    const health = readRepo("apps/api/src/routes/health.routes.ts");
    assert.match(health, /isPublicMinimalHealthSurface/);
    assert.match(health, /resolvePlatformMode\(\) === \"production\"/);
    assert.match(health, /liveness:\s*\"alive\"/);
    assert.match(health, /ready:\s*mongo\.connected/);
  });

  it("legacy Member Badge contributions remain disabled by default in env example", () => {
    const envExample = readRepo("apps/api/.env.example");
    assert.match(envExample, /MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false/);
  });
});
