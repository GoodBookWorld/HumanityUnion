/**
 * Localization Authority Closure 01 — public presentation authority contract.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOCALIZATION_RESOLUTION_PRIORITY,
  PERSISTED_TRANSLATION_MECHANISM_RULE,
  PUBLIC_NEWS_PROTECTED_ORIGINAL_RULE,
  PUBLIC_PRESENTATION_AUTHORITY,
  PUBLIC_PRESENTATION_AUTHORITY_INVARIANTS,
  PUBLIC_PRESENTATION_FIELD_CLASS_ELIGIBLE_AUTHORITIES,
  PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY,
  classifyPublicPresentationLocalizationPresence,
  comparePublicPresentationAuthority,
  isHigherPublicPresentationAuthority,
  publicPresentationFieldClassAllowsAuthority,
  registryCanonicalLifecycleStageLabel,
  resolveControlledLifecycleLabel,
  selectWinningPublicPresentationCandidate,
  type PublicPresentationAuthority,
} from "@hu/types";

describe("Localization Authority Closure 01 — PUBLIC_PRESENTATION_AUTHORITY", () => {
  it("defines the normative ladder Protected → … → Canonical English fallback", () => {
    assert.deepEqual([...PUBLIC_PRESENTATION_AUTHORITY], [
      "PROTECTED_CANONICAL",
      "LEGAL",
      "BRAND",
      "MANUAL_AUTHOR",
      "CONTROLLED_VOCABULARY",
      "GEOGRAPHY",
      "PERSISTED_TRANSLATION",
      "CANONICAL_ENGLISH_FALLBACK",
    ]);
    assert.ok(PUBLIC_PRESENTATION_AUTHORITY_INVARIANTS.length >= 7);
  });

  it("Legal outranks Brand; Brand outranks Manual; Manual outranks Controlled", () => {
    assert.ok(isHigherPublicPresentationAuthority("LEGAL", "BRAND"));
    assert.ok(isHigherPublicPresentationAuthority("BRAND", "MANUAL_AUTHOR"));
    assert.ok(
      isHigherPublicPresentationAuthority("MANUAL_AUTHOR", "CONTROLLED_VOCABULARY"),
    );
    assert.ok(
      isHigherPublicPresentationAuthority("CONTROLLED_VOCABULARY", "GEOGRAPHY"),
    );
    assert.ok(
      isHigherPublicPresentationAuthority("GEOGRAPHY", "PERSISTED_TRANSLATION"),
    );
    assert.ok(
      isHigherPublicPresentationAuthority(
        "PERSISTED_TRANSLATION",
        "CANONICAL_ENGLISH_FALLBACK",
      ),
    );
  });

  it("Terminology preferredTerm beats WEB_UI controlled label", () => {
    const resolved = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: "Спільний аналіз",
      webUiControlledLabel: "Спільний аналіз (WEB_UI)",
      registryCanonicalEnglishLabel: "Collaborative Analysis",
    });
    assert.equal(resolved.source, "terminology_preferred_term");
    assert.equal(resolved.label, "Спільний аналіз");
    assert.equal(resolved.authority, "CONTROLLED_VOCABULARY");
  });

  it("WEB_UI controlled lifecycle label beats Registry English when preferredTerm missing", () => {
    const resolved = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: null,
      webUiControlledLabel: "التحليل التعاوني",
      registryCanonicalEnglishLabel: "Collaborative Analysis",
      stageId: "analysis",
    });
    assert.equal(resolved.source, "web_ui_controlled_label");
    assert.equal(resolved.label, "التحليل التعاوني");
    assert.equal(resolved.authority, "CONTROLLED_VOCABULARY");
    assert.notEqual(resolved.label, "Collaborative Analysis");
  });

  it("Registry English is last resort only when Terminology and WEB_UI are absent", () => {
    const resolved = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: "  ",
      webUiControlledLabel: "",
      stageId: "analysis",
    });
    assert.equal(resolved.source, "registry_canonical_english");
    assert.equal(resolved.label, registryCanonicalLifecycleStageLabel("analysis"));
    assert.equal(resolved.label, "Collaborative Analysis");
    assert.equal(resolved.authority, "CANONICAL_ENGLISH_FALLBACK");
  });

  it("Brand beats machine/persisted translation", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "PERSISTED_TRANSLATION",
        value: "Machine Brand Name",
        eligible: true,
      },
      {
        authority: "BRAND",
        value: "Published Brand Name",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "BRAND");
    assert.equal(winner?.value, "Published Brand Name");
  });

  it("Legal beats machine/persisted translation", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "PERSISTED_TRANSLATION",
        value: "MT legal body",
        eligible: true,
      },
      {
        authority: "LEGAL",
        value: "Counsel-approved body",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "LEGAL");
    assert.equal(winner?.value, "Counsel-approved body");
  });

  it("Manual/author beats machine/persisted translation when eligible", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "PERSISTED_TRANSLATION",
        value: "MT title",
        eligible: true,
      },
      {
        authority: "MANUAL_AUTHOR",
        value: "Author title",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "MANUAL_AUTHOR");
  });

  it("Geography beats machine/persisted translation", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "PERSISTED_TRANSLATION",
        value: "Ukraine (MT)",
        eligible: true,
      },
      {
        authority: "GEOGRAPHY",
        value: "Україна",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "GEOGRAPHY");
    assert.equal(winner?.value, "Україна");
  });

  it("Persisted translation beats canonical English fallback", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "CANONICAL_ENGLISH_FALLBACK",
        value: "English title",
        eligible: true,
      },
      {
        authority: "PERSISTED_TRANSLATION",
        value: "Localized title",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "PERSISTED_TRANSLATION");
  });

  it("Protected canonical remains unchanged and outranks everything", () => {
    const winner = selectWinningPublicPresentationCandidate([
      {
        authority: "PROTECTED_CANONICAL",
        value: "Original RSS title",
        eligible: true,
      },
      {
        authority: "PERSISTED_TRANSLATION",
        value: "Should never win",
        eligible: true,
      },
      {
        authority: "BRAND",
        value: "Also must not win",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "PROTECTED_CANONICAL");
    assert.equal(winner?.value, "Original RSS title");
    assert.equal(
      classifyPublicPresentationLocalizationPresence(winner),
      "intentional_protected_canonical",
    );
  });

  it("Canonical English is used only when no higher localized authority is eligible", () => {
    const onlyEnglish = selectWinningPublicPresentationCandidate([
      {
        authority: "PERSISTED_TRANSLATION",
        value: "stale",
        eligible: false,
      },
      {
        authority: "CONTROLLED_VOCABULARY",
        value: "missing",
        eligible: false,
      },
      {
        authority: "CANONICAL_ENGLISH_FALLBACK",
        value: "English only",
        eligible: true,
      },
    ]);
    assert.equal(onlyEnglish?.authority, "CANONICAL_ENGLISH_FALLBACK");
    assert.equal(
      classifyPublicPresentationLocalizationPresence(onlyEnglish),
      "canonical_english_fallback_only",
    );
  });

  it("public_news protected original remains protected (field class + rule)", () => {
    assert.match(PUBLIC_NEWS_PROTECTED_ORIGINAL_RULE, /PROTECTED_CANONICAL/);
    assert.match(PUBLIC_NEWS_PROTECTED_ORIGINAL_RULE, /public_news/i);
    assert.ok(
      publicPresentationFieldClassAllowsAuthority(
        "protected_original_content",
        "PROTECTED_CANONICAL",
      ),
    );
    assert.equal(
      publicPresentationFieldClassAllowsAuthority(
        "protected_original_content",
        "PERSISTED_TRANSLATION",
      ),
      false,
    );
    assert.deepEqual(
      [...PUBLIC_PRESENTATION_FIELD_CLASS_ELIGIBLE_AUTHORITIES.protected_original_content],
      ["PROTECTED_CANONICAL"],
    );
  });

  it("ui_system_chrome never consults persisted translation", () => {
    assert.equal(
      publicPresentationFieldClassAllowsAuthority(
        "ui_system_chrome",
        "PERSISTED_TRANSLATION",
      ),
      false,
    );
    assert.ok(
      publicPresentationFieldClassAllowsAuthority(
        "ui_system_chrome",
        "CONTROLLED_VOCABULARY",
      ),
    );
  });

  it("same authority ordering applies to uk, ar, zh-Hant (no locale branch)", () => {
    const locales = ["uk", "ar", "zh-Hant"] as const;
    for (const locale of locales) {
      const webUiByLocale: Record<(typeof locales)[number], string> = {
        uk: "Спільний аналіз",
        ar: "التحليل التعاوني",
        "zh-Hant": "協作分析",
      };
      const resolved = resolveControlledLifecycleLabel({
        terminologyPreferredTerm: null,
        webUiControlledLabel: webUiByLocale[locale],
        registryCanonicalEnglishLabel: "Collaborative Analysis",
      });
      assert.equal(resolved.source, "web_ui_controlled_label");
      assert.equal(resolved.label, webUiByLocale[locale]);
      assert.equal(
        comparePublicPresentationAuthority("LEGAL", "BRAND") < 0,
        true,
        `locale=${locale}`,
      );
    }
  });

  it("documents CT/PLP as persistence beneath presentation authority", () => {
    assert.match(PERSISTED_TRANSLATION_MECHANISM_RULE, /persistence mechanisms/i);
    assert.match(PERSISTED_TRANSLATION_MECHANISM_RULE, /content_translations/);
    assert.match(
      PERSISTED_TRANSLATION_MECHANISM_RULE,
      /published_localized_presentations/,
    );
    assert.match(PERSISTED_TRANSLATION_MECHANISM_RULE, /Do not merge CT and PLP/);
    assert.match(PERSISTED_TRANSLATION_MECHANISM_RULE, /Do not move WEB_UI chrome/);
  });

  it("aligns with PLP provenance Legal-before-Brand; notes Pack 08I.15 compatibility divergence", () => {
    assert.ok(
      PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("LEGAL_LOCALIZATION") <
        PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("BRAND_LOCALIZATION"),
    );
    assert.ok(
      PUBLIC_PRESENTATION_AUTHORITY.indexOf("LEGAL") <
        PUBLIC_PRESENTATION_AUTHORITY.indexOf("BRAND"),
    );
    // Historical Pack 08I.15 enum remains Brand-before-Legal — not Closure 01.
    assert.ok(
      LOCALIZATION_RESOLUTION_PRIORITY.indexOf("BRAND_LOCALIZATION") <
        LOCALIZATION_RESOLUTION_PRIORITY.indexOf("LEGAL_LOCALIZATION"),
    );
  });

  it("ineligible higher authority does not suppress lower eligible value", () => {
    const winner = selectWinningPublicPresentationCandidate([
      { authority: "BRAND", value: "absent", eligible: false },
      {
        authority: "PERSISTED_TRANSLATION",
        value: "Localized",
        eligible: true,
      },
    ]);
    assert.equal(winner?.authority, "PERSISTED_TRANSLATION");
  });
});

describe("Localization Authority Closure 01 — authority totality", () => {
  it("every PUBLIC_PRESENTATION_AUTHORITY step is distinct and comparable", () => {
    const set = new Set<PublicPresentationAuthority>(PUBLIC_PRESENTATION_AUTHORITY);
    assert.equal(set.size, PUBLIC_PRESENTATION_AUTHORITY.length);
    for (let i = 0; i < PUBLIC_PRESENTATION_AUTHORITY.length - 1; i += 1) {
      const higher = PUBLIC_PRESENTATION_AUTHORITY[i]!;
      const lower = PUBLIC_PRESENTATION_AUTHORITY[i + 1]!;
      assert.ok(isHigherPublicPresentationAuthority(higher, lower));
    }
  });
});
