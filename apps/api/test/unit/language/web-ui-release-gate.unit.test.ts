/**
 * HU-LC-05C.4C.7F.7W.8 — focused WEB_UI release gate tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WebUiMessageTree } from "@hu/types";

import {
  assessWebUiReleaseGateLocale,
  formatWebUiReleaseGateReport,
  listEnabledLocalesFromPublicApi,
  loadPublishedWebUiPackFromPublicApi,
  runWebUiReleaseGate,
} from "../../../src/modules/web-ui-message-packs/web-ui-release-gate.js";

const FIXTURE_EN: WebUiMessageTree = {
  common: { save: "Save", cancel: "Cancel" },
  navigation: { home: "Home" },
  workspace: { drafts: { heading: "Drafts" } },
};

function completeLocale(): WebUiMessageTree {
  return {
    common: { save: "შენახვა", cancel: "გაუქმება" },
    navigation: { home: "მთავარი" },
    workspace: { drafts: { heading: "პროექტები" } },
  };
}

describe("WEB_UI release gate", () => {
  it("complete locale PASS for public, participant, and full scopes", () => {
    const result = assessWebUiReleaseGateLocale({
      locale: "ka",
      sourceKind: "local-catalog-injection",
      catalog: { status: "ok", messages: completeLocale(), publishedRevision: 8 },
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(result.pass, true);
    assert.equal(result.catalogStatus, "ok");
    assert.equal(result.public?.dataReady, true);
    assert.equal(result.participant?.dataReady, true);
    assert.equal(result.full?.dataReady, true);
    assert.equal(result.full?.missingKeyCount, 0);
  });

  it("missing keys FAIL with actionable samples", () => {
    const incomplete: WebUiMessageTree = {
      common: { save: "შენახვა" },
    };
    const result = assessWebUiReleaseGateLocale({
      locale: "ka",
      sourceKind: "local-catalog-injection",
      catalog: { status: "ok", messages: incomplete },
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(result.pass, false);
    assert.ok((result.full?.missingKeyCount ?? 0) > 0);
    assert.ok(result.missingKeySamples.length > 0);
    assert.match(result.detail, /full ready=false/);
  });

  it("missing published pack is an explicit FAIL result", () => {
    const result = assessWebUiReleaseGateLocale({
      locale: "fr",
      sourceKind: "live-public-api",
      catalog: { status: "missing_published_pack" },
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(result.pass, false);
    assert.equal(result.catalogStatus, "missing_published_pack");
    assert.match(result.detail, /No published WEB_UI pack/);
  });

  it("source unavailable fails closed (not false PASS)", () => {
    const result = assessWebUiReleaseGateLocale({
      locale: "uk",
      sourceKind: "live-public-api",
      catalog: { status: "source_unavailable", reason: "network down" },
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(result.pass, false);
    assert.equal(result.catalogStatus, "source_unavailable");
    assert.match(result.detail, /fail closed/);

    const report = runWebUiReleaseGate({
      sourceKind: "live-public-api",
      requiredLocales: ["uk"],
      loadCatalog: () => ({ status: "source_unavailable", reason: "boom" }),
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(report.pass, false);
    assert.deepEqual(report.failedLocales, ["uk"]);
  });

  it("english foundation locale is gated as PASS without requiring a pack", () => {
    const result = assessWebUiReleaseGateLocale({
      locale: "en",
      sourceKind: "live-public-api",
      catalog: { status: "missing_published_pack" },
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    assert.equal(result.pass, true);
    assert.equal(result.catalogStatus, "english_foundation");
  });

  it("public API pack loader maps 404 and transport failures correctly", async () => {
    const missing = await loadPublishedWebUiPackFromPublicApi({
      apiBaseUrl: "https://example.test",
      locale: "xx",
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        text: async () => "",
      }),
    });
    assert.equal(missing.status, "missing_published_pack");

    const unavailable = await loadPublishedWebUiPackFromPublicApi({
      apiBaseUrl: "https://example.test",
      locale: "uk",
      fetchImpl: async () => {
        throw new Error("connect reset");
      },
    });
    assert.equal(unavailable.status, "source_unavailable");
    if (unavailable.status === "source_unavailable") {
      assert.match(unavailable.reason, /connect reset/);
    }

    const ok = await loadPublishedWebUiPackFromPublicApi({
      apiBaseUrl: "https://example.test",
      locale: "ka",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: { locale: "ka", revision: 8, messages: completeLocale() },
          }),
      }),
    });
    assert.equal(ok.status, "ok");
    if (ok.status === "ok") {
      assert.equal(ok.publishedRevision, 8);
    }
  });

  it("languages list fails closed when public API is unavailable", async () => {
    const listed = await listEnabledLocalesFromPublicApi({
      apiBaseUrl: "https://example.test",
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => "nope",
      }),
    });
    assert.equal(listed.ok, false);
  });

  it("format report distinguishes packaged diagnostic from live authority", () => {
    const report = runWebUiReleaseGate({
      sourceKind: "local-packaged-diagnostic",
      requiredLocales: ["ka"],
      loadCatalog: () => ({ status: "ok", messages: completeLocale() }),
      loadEnglishFoundation: () => FIXTURE_EN,
    });
    const text = formatWebUiReleaseGateReport(report);
    assert.match(text, /local-packaged-diagnostic/);
    assert.match(text, /NOT published Mongo authority/);
  });
});
