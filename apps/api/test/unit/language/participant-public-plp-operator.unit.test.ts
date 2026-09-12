/**
 * Bounded participant_public PLP materialize operator — parse + safety guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateParticipantPublicPlpExecuteGuards,
  evaluateParticipantPublicPlpProductionRefusal,
  parseParticipantPublicPlpMaterializeArgs,
} from "../../../src/modules/language/published-localized-presentation/universal/participant-public-plp-operator-args.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function read(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("materialize:participant-public-plp operator", () => {
  it("requires --mongo and exactly one bounded selector", () => {
    assert.equal(
      parseParticipantPublicPlpMaterializeArgs(["--profile-id", "p1"]).ok,
      false,
    );
    const ok = parseParticipantPublicPlpMaterializeArgs([
      "--mongo",
      "--profile-id",
      "p1",
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.args.profileId, "p1");
      assert.equal(ok.args.execute, false);
    }
  });

  it("refuses --all/--corpus and oversized --limit", () => {
    assert.equal(
      parseParticipantPublicPlpMaterializeArgs(["--mongo", "--all"]).ok,
      false,
    );
    assert.equal(
      parseParticipantPublicPlpMaterializeArgs(["--mongo", "--limit", "99"]).ok,
      false,
    );
    const limited = parseParticipantPublicPlpMaterializeArgs([
      "--mongo",
      "--limit",
      "5",
    ]);
    assert.equal(limited.ok, true);
  });

  it("refuses production and non-staging execute", () => {
    assert.equal(
      evaluateParticipantPublicPlpProductionRefusal({
        platformMode: "production",
        database: "humanity_union_staging",
      }).refused,
      true,
    );
    assert.equal(
      evaluateParticipantPublicPlpExecuteGuards({
        platformMode: "staging",
        database: "humanity_union",
      }).refused,
      true,
    );
    assert.equal(
      evaluateParticipantPublicPlpExecuteGuards({
        platformMode: "staging",
        database: "humanity_union_staging",
      }).refused,
      false,
    );
  });

  it("wires package script and uses processPlpBuildRequest + Registry locales", () => {
    const pkg = read("package.json");
    assert.match(pkg, /materialize:participant-public-plp/);
    const args = read(
      "src/modules/language/published-localized-presentation/universal/participant-public-plp-operator-args.ts",
    );
    assert.match(args, /refuses --all\/--corpus/);
    const operator = read(
      "src/modules/language/published-localized-presentation/universal/participant-public-plp-operator.ts",
    );
    assert.match(operator, /processPlpBuildRequest/);
    assert.match(operator, /resolvePlpAutoBuildLocales/);
    assert.match(operator, /excludeSourceLanguage:\s*"en"/);
    assert.match(operator, /SKIP_CURRENT/);
    assert.match(operator, /ADMIN_REBUILD/);
    assert.doesNotMatch(operator, /localization:check|warm:staging-content-translations/);
  });

  it("profile mutations still enqueue rebuilds for future updates", () => {
    const service = read("src/modules/member-profile/member-profile.service.ts");
    assert.match(service, /enqueueParticipantPublicPlpBuilds/);
    assert.match(service, /profileProseChanged/);
  });
});
