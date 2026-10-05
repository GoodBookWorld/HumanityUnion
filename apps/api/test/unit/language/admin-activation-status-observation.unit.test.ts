/**
 * F.3.4 — activation-status timing log. No content, bodies, or secrets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_ACTIVATION_STATUS_LOG_FIELDS,
  adminActivationStatusInFlightForTests,
  beginAdminActivationStatusObservation,
  resetAdminActivationStatusObservationForTests,
} from "../../../src/modules/language/language-registry/admin-activation-status-observation.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("admin activation-status observation", () => {
  afterEach(() => {
    resetAdminActivationStatusObservationForTests();
  });

  it("logs start concurrency and completion duration without content fields", () => {
    const events: Array<{ message: string; fields: Record<string, unknown> }> = [];
    const log = (message: string, fields: Readonly<Record<string, unknown>>) => {
      events.push({ message, fields: { ...fields } });
    };
    const first = beginAdminActivationStatusObservation({
      correlationId: "corr-1",
      languageId: "lang-uk",
      log,
    });
    const second = beginAdminActivationStatusObservation({
      correlationId: "corr-2",
      languageId: "lang-zh-hant",
      log,
    });
    assert.equal(first.inFlightAtStart, 0);
    assert.equal(second.inFlightAtStart, 1);
    assert.equal(adminActivationStatusInFlightForTests(), 2);
    second.complete({ result: "ok", httpStatus: 200, locale: "zh-Hant" });
    first.complete({ result: "error", httpStatus: 500, locale: null });
    assert.equal(adminActivationStatusInFlightForTests(), 0);
    assert.deepEqual(
      events.map((event) => event.message),
      [
        "admin.activation_status.start",
        "admin.activation_status.start",
        "admin.activation_status.complete",
        "admin.activation_status.complete",
      ],
    );
    const complete = events[3]!.fields;
    assert.equal(complete.result, "error");
    assert.equal(typeof complete.durationMs, "number");
    assert.equal(complete.inFlightAtStart, 0);
    for (const event of events) {
      for (const key of Object.keys(event.fields)) {
        assert.ok(
          (ADMIN_ACTIVATION_STATUS_LOG_FIELDS as readonly string[]).includes(key),
          key,
        );
      }
    }
    const route = readFileSync(
      path.resolve(here, "../../../src/modules/language/language-registry/admin-languages.routes.ts"),
      "utf8",
    );
    const handlerStart = route.indexOf('"/:languageId/activation-status"');
    const handler = route.slice(handlerStart, handlerStart + 2200);
    assert.match(handler, /beginAdminActivationStatusObservation/);
    assert.match(handler, /observation\.complete/);
    const observation = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-registry/admin-activation-status-observation.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(observation, /req\.auth|translated|providerPrompt|password|token/);
  });
});
