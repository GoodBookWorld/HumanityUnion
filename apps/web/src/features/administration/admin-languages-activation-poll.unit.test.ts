/**
 * Admin activation polling is bounded and never re-invokes Activate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_ACTIVATION_POLL_INTERVAL_MS,
  shouldPollLanguageActivationJob,
} from "./admin-languages-activation-poll";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Admin activation polling", () => {
  it("15–17 polls only queued/running and the effect does not call Activate", () => {
    assert.equal(shouldPollLanguageActivationJob("queued"), true);
    assert.equal(shouldPollLanguageActivationJob("running"), true);
    assert.equal(shouldPollLanguageActivationJob("completed"), false);
    assert.equal(shouldPollLanguageActivationJob("failed"), false);
    assert.equal(shouldPollLanguageActivationJob("waiting_for_data"), false);
    assert.equal(shouldPollLanguageActivationJob(null), false);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS >= 2000);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS <= 5000);

    const section = readFileSync(
      path.join(here, "components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    const start = section.indexOf("const pollingKey = pollingLanguageIds.join");
    const end = section.indexOf("}, [pollingKey]);", start);
    assert.ok(start > 0 && end > start);
    const effect = section.slice(start, end);
    assert.match(effect, /fetchAdminLanguageActivationStatus/);
    assert.doesNotMatch(effect, /activateAdminLanguageLocalization/);
  });
});
