/**
 * Localization Simplification Step 04A —
 * Terminology preferredTerm wins in public controlled lifecycle labels.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  getControlledLifecyclePreferredTerm,
  resetControlledLifecyclePreferredTermsCacheForTests,
  seedControlledLifecyclePreferredTermsForTests,
} from "../language/controlled-lifecycle-preferred-terms";
import { resolveLifecycleStageDisplayLabel } from "./initiative-experience-i18n";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

const ukMessages = {
  initiativeExperience: {
    stages: {
      discussion: "Обговорення (WEB_UI)",
      analysis: "Спільний аналіз (WEB_UI)",
    },
  },
} as const;

describe("Localization Simplification Step 04A — Terminology preferredTerm wiring", () => {
  afterEach(() => {
    resetControlledLifecyclePreferredTermsCacheForTests();
  });

  it("localized Terminology preferredTerm wins when available", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {
        discussion: "Обговорення",
        analysis: "Спільний аналіз",
      },
    });

    assert.equal(
      resolveLifecycleStageDisplayLabel("discussion", ukMessages, undefined, {
        locale: "uk",
      }),
      "Обговорення",
    );
    assert.equal(
      getControlledLifecyclePreferredTerm("uk", "discussion"),
      "Обговорення",
    );
  });

  it("WEB_UI localized label remains fallback when preferredTerm is absent", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {},
    });

    assert.equal(
      resolveLifecycleStageDisplayLabel("discussion", ukMessages, undefined, {
        locale: "uk",
      }),
      "Обговорення (WEB_UI)",
    );
  });

  it("canonical English remains final fallback", () => {
    const emptyMessages = { stages: {} } as const;
    assert.equal(
      resolveLifecycleStageDisplayLabel("discussion", emptyMessages, undefined, {
        locale: "uk",
        terminologyPreferredTerm: null,
      }),
      "Discussion",
    );
  });

  it("explicit preferredTerm override does not require cache", () => {
    assert.equal(
      resolveLifecycleStageDisplayLabel("petition", ukMessages, undefined, {
        terminologyPreferredTerm: "Петиція",
      }),
      "Петиція",
    );
  });

  it("locale is not hardcoded in resolution path", () => {
    const i18n = readWeb(
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    );
    const cache = readWeb("features/language/controlled-lifecycle-preferred-terms.ts");
    const apiPublic = readFileSync(
      path.join(
        webSrc,
        "../../api/src/modules/language/terminology-glossary/terminology-glossary.public.ts",
      ),
      "utf8",
    );

    assert.doesNotMatch(i18n, /terminologyPreferredTerm:\s*null/);
    assert.match(i18n, /getControlledLifecyclePreferredTerm/);
    assert.doesNotMatch(cache, /\b(?:uk|ar|zh-Hant|ka)\b/);
    assert.doesNotMatch(apiPublic, /\b(?:uk|ar|zh-Hant|ka)\b/);
    assert.match(apiPublic, /resolveWorkflowStagePreferredTerm/);
    assert.match(apiPublic, /INITIATIVE_LIFECYCLE_STAGE_REGISTRY/);
  });

  it("ordinary lifecycle stage banner labels remain browser-translation eligible", () => {
    const banner = readWeb(
      "features/public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
    );
    assert.doesNotMatch(banner, /ProtectedAuthoritativeText/);
    assert.match(banner, /useControlledLifecyclePreferredTermsLocale/);
    assert.match(banner, /resolveLifecycleStageDisplayLabel\([\s\S]*\{\s*locale\s*\}/);
  });
});
