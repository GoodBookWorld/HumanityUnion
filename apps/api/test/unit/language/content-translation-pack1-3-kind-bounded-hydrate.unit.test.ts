/**
 * Pack 1.3 — staging warm --kinds hydrate bound + early --help.
 * No Mongo / no provider / no warm execution.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatStagingWarmHelp,
  isStagingWarmHelpRequested,
  parseStagingWarmKindsFromArgv,
  resolveContentTranslationOperatorHydrateScopes,
  StagingWarmCliValidationError,
} from "../../../src/modules/language/content-translation-staging-warm-operator-scope.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function readApi(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("Pack 1.3 — staging warm kind-bounded hydrate", () => {
  it("A. --help exits without Mongo/bootstrap (subprocess)", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(apiRoot, "src/scripts/warm-staging-content-translations.ts"),
        "--help",
      ],
      {
        cwd: apiRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          // Ensure a hung Mongo path would fail if help were ignored.
          MONGODB_URI: "mongodb://127.0.0.1:1/should-not-connect",
        },
        timeout: 15_000,
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /--kinds=/);
    assert.match(result.stdout, /initiative/);
    assert.doesNotMatch(result.stdout + result.stderr, /injected env|MONGODB_URI|connectMongoClient/i);
  });

  it("B. unknown --kinds fails before Mongo/bootstrap (subprocess)", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(apiRoot, "src/scripts/warm-staging-content-translations.ts"),
        "--kinds=not_a_kind",
      ],
      {
        cwd: apiRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          MONGODB_URI: "mongodb://127.0.0.1:1/should-not-connect",
        },
        timeout: 15_000,
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr || result.stdout, /Unknown --kinds|not_a_kind/);
    assert.doesNotMatch(result.stdout + result.stderr, /injected env|dotenv/i);
  });

  it("C. --kinds=initiative does not request CA/CD hydrate", () => {
    const scopes = resolveContentTranslationOperatorHydrateScopes(["initiative"]);
    assert.deepEqual(scopes, {
      initiative: true,
      collaborativeAnalysis: false,
      collectiveDecision: false,
    });

    const bootstrap = readApi(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    assert.match(bootstrap, /hydrateScopes\.collaborativeAnalysis/);
    assert.match(bootstrap, /hydrateScopes\.collectiveDecision/);
    assert.match(bootstrap, /if \(hydrateScopes\.initiative\)/);
  });

  it("D. default no --kinds retains full Initiative+CA+CD hydrate", () => {
    assert.deepEqual(resolveContentTranslationOperatorHydrateScopes(undefined), {
      initiative: true,
      collaborativeAnalysis: true,
      collectiveDecision: true,
    });
    assert.equal(parseStagingWarmKindsFromArgv(["node", "script.ts"]), undefined);
  });

  it("E. execute guards remain unchanged in script", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
    assert.match(script, /humanity_union_staging/);
    assert.match(script, /PLATFORM_MODE=production is not allowed/);
    assert.match(script, /assertStagingWarmGuards/);
    assert.match(script, /if \(!input\.execute\) \{\s*return;/);
  });

  it("F. repair semantics remain (--repair + execute / dry-run)", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /isRepairModeRequested/);
    assert.match(script, /runStagingInitiativePathContentTranslationRepair/);
    assert.match(script, /execute,\s*kinds,/);
  });

  it("blog_post / civic_media alone skip Initiative+CA+CD hydrate", () => {
    assert.deepEqual(resolveContentTranslationOperatorHydrateScopes(["blog_post"]), {
      initiative: false,
      collaborativeAnalysis: false,
      collectiveDecision: false,
    });
    assert.deepEqual(
      resolveContentTranslationOperatorHydrateScopes(["civic_media", "public_news"]),
      {
        initiative: false,
        collaborativeAnalysis: false,
        collectiveDecision: false,
      },
    );
  });

  it("collaborative_analysis hydrates Initiative + CA only", () => {
    assert.deepEqual(
      resolveContentTranslationOperatorHydrateScopes(["collaborative_analysis"]),
      {
        initiative: true,
        collaborativeAnalysis: true,
        collectiveDecision: false,
      },
    );
  });

  it("help helpers and kind parse unit contracts", () => {
    assert.equal(isStagingWarmHelpRequested(["node", "x", "--help"]), true);
    assert.equal(isStagingWarmHelpRequested(["node", "x", "-h"]), true);
    assert.equal(isStagingWarmHelpRequested(["node", "x"]), false);
    assert.match(formatStagingWarmHelp(), /--execute/);
    assert.deepEqual(parseStagingWarmKindsFromArgv(["node", "x", "--kinds=initiative,petition"]), [
      "initiative",
      "petition",
    ]);
    assert.throws(
      () => parseStagingWarmKindsFromArgv(["node", "x", "--kinds="]),
      (error: unknown) => error instanceof StagingWarmCliValidationError,
    );
  });
});
