/**
 * HU-LOC-BRAND-02D21G.2 — read-only WEB_UI linguistic quality report.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import type { WebUiMessageTree } from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  glossaryEvidenceFromPreferredTerms,
  loadLinguisticQualityPolicy,
  loadWebUiLinguisticQualityReport,
  parsePublicLanguageRegistry,
  selectTargetLocales,
} from "../../../src/modules/web-ui-message-packs/linguistic-quality-report-run.js";
import {
  LinguisticQualityPolicyError,
  buildLinguisticQualityReport,
  parseLinguisticQualityPolicy,
  renderLinguisticQualityReportJson,
  type GlossaryConceptEvidence,
  type LinguisticQualityCatalog,
  type LinguisticQualityPolicy,
} from "../../../src/modules/web-ui-message-packs/linguistic-quality-report.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import { WEB_UI_LEGAL_ENTITY_NAME } from "../../../src/modules/web-ui-message-packs/plan-selected-packaged-web-ui-updates.js";
import { flattenWebUiCatalogLeaves } from "../../../src/modules/web-ui-message-packs/web-ui-catalog-parity.js";
import { loadBundledWebUiMessagePackFromFs } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const emptyPolicy = parseLinguisticQualityPolicy({
  id: "test-policy",
  exceptions: [],
  terminologyRules: [],
});

function leaves(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

function concept(
  conceptId: string,
  canonicalEnglishTerm: string,
  preferredTerm: string | null = null,
): GlossaryConceptEvidence {
  return {
    conceptId,
    canonicalEnglishTerm,
    preferredTerm,
    preferredTermState: preferredTerm ? "published" : "absent-from-public-map",
  };
}

function catalog(input: {
  readonly locale: string;
  readonly textDirection?: "ltr" | "rtl";
  readonly englishName?: string;
  readonly entries: Record<string, string>;
  readonly web?: Record<string, string> | null;
  readonly api?: Record<string, string> | null;
  readonly published?: Record<string, string> | null;
  readonly publishedStatus?: LinguisticQualityCatalog["publishedStatus"];
  readonly glossary?: readonly GlossaryConceptEvidence[];
  readonly brandSiteName?: string | null;
}): LinguisticQualityCatalog {
  const published = input.published === undefined ? input.entries : input.published;
  return {
    locale: input.locale,
    textDirection: input.textDirection ?? "ltr",
    englishName: input.englishName ?? input.locale,
    nativeName: input.locale,
    web: input.web === null ? null : leaves(input.web ?? input.entries),
    api: input.api === null ? null : leaves(input.api ?? input.entries),
    published: published == null ? null : leaves(published),
    publishedRevision: published == null ? null : 3,
    publishedStatus: input.publishedStatus ?? (published == null ? "missing" : "present"),
    publishedSource: "test",
    glossaryStatus: "present",
    glossary: input.glossary ?? [],
    brandStatus: input.brandSiteName ? "present" : "unavailable",
    brandSiteName: input.brandSiteName ?? null,
    brandSource: input.brandSiteName ? "test" : null,
    readiness: null,
  };
}

function reportFor(input: {
  readonly english: Record<string, string>;
  readonly catalogs: readonly LinguisticQualityCatalog[];
  readonly policy?: LinguisticQualityPolicy;
  readonly filter?: Parameters<typeof buildLinguisticQualityReport>[0]["filter"];
}) {
  return buildLinguisticQualityReport({
    policy: input.policy ?? emptyPolicy,
    policySha256: "test",
    canonicalLocale: "en",
    english: leaves(input.english),
    catalogs: input.catalogs,
    filter: input.filter,
  });
}

describe("linguistic quality report", () => {
  it("reports placeholder, rich-tag, empty, and missing defects", () => {
    const report = reportFor({
      english: {
        "greet.name": "Hello {name}",
        "greet.rich": "Hello <b>there</b>",
        "greet.empty": "Ready",
        "greet.missing": "Present",
      },
      catalogs: [
        catalog({
          locale: "de",
          entries: {},
          published: {
            "greet.name": "Hallo",
            "greet.rich": "Hallo there",
            "greet.empty": "   ",
          },
        }),
      ],
    });
    const categories = report.findings.map((finding) => `${finding.path}:${finding.category}`);
    assert.ok(categories.includes("greet.name:placeholder_mismatch"));
    assert.ok(categories.includes("greet.rich:rich_tag_mismatch"));
    assert.ok(categories.includes("greet.empty:empty_value"));
    assert.ok(categories.includes("greet.missing:missing_path"));
    assert.equal(report.findings.filter((finding) => finding.classification === "CONFIRMED_DEFECT").length, 4);
  });

  it("accepts technical identical values and keeps genuine identical text for review", () => {
    const report = reportFor({
      english: { "count.value": "42", "action.save": "Save" },
      catalogs: [catalog({ locale: "fr", entries: { "count.value": "42", "action.save": "Save" } })],
    });
    const technical = report.findings.find((finding) => finding.path === "count.value");
    const suspicious = report.findings.find((finding) => finding.path === "action.save");
    assert.equal(technical?.category, "english_identical_technical");
    assert.equal(technical?.classification, "APPROVED_EXCEPTION");
    assert.equal(technical?.inReviewQueue, false);
    assert.equal(suspicious?.classification, "REVIEW_CANDIDATE");
    assert.equal(suspicious?.inReviewQueue, true);
    assert.equal(report.coverage.identicalTechnical, 1);
    assert.equal(report.coverage.identicalSuspiciousAfterExceptions, 1);
  });

  it("suppresses only the approved identical finding", () => {
    const policy = parseLinguisticQualityPolicy({
      id: "exception-policy",
      exceptions: [
        {
          id: "steward",
          locales: ["de"],
          paths: ["title.steward"],
          value: "Steward\u200F",
          suppresses: ["english_identical_suspicious"],
          reason: "Approved product term.",
        },
      ],
      terminologyRules: [],
    });
    const report = reportFor({
      policy,
      english: { "title.steward": "Steward\u200F", "body.text": "Hello {name}" },
      catalogs: [
        catalog({
          locale: "de",
          entries: { "title.steward": "Steward\u200F", "body.text": "Hallo" },
          api: { "title.steward": "Verwalter", "body.text": "Hallo" },
        }),
      ],
    });
    const steward = report.findings.find(
      (finding) => finding.path === "title.steward" && finding.category === "english_identical_suspicious",
    );
    const bidi = report.findings.find((finding) => finding.category === "bidirectional_control");
    const divergence = report.findings.find(
      (finding) => finding.path === "title.steward" && finding.category === "published_packaged_difference",
    );
    const placeholder = report.findings.find((finding) => finding.category === "placeholder_mismatch");
    assert.equal(steward?.classification, "APPROVED_EXCEPTION");
    assert.equal(steward?.inReviewQueue, false);
    assert.equal(bidi?.classification, "CONFIRMED_DEFECT");
    assert.equal(bidi?.inReviewQueue, true);
    assert.equal(divergence?.classification, "NOT_VERIFIED");
    assert.equal(divergence?.inReviewQueue, false);
    assert.match(divergence?.evidence ?? "", /Neither source is selected/);
    assert.equal(placeholder?.classification, "CONFIRMED_DEFECT");
  });

  it("does not treat a published/packaged difference as a defect", () => {
    const report = reportFor({
      english: { "label.title": "Title" },
      catalogs: [
        catalog({
          locale: "he",
          textDirection: "rtl",
          entries: { "label.title": "כותרת א" },
          api: { "label.title": "כותרת ב" },
        }),
      ],
    });
    const finding = report.findings.find((item) => item.category === "published_packaged_difference");
    assert.equal(finding?.classification, "NOT_VERIFIED");
    assert.equal(finding?.severity, "informational");
    assert.equal(finding?.textDirection, "rtl");
    assert.equal(finding?.inReviewQueue, false);
  });

  it("protects the legal name and reports a hardcoded platform name separately", () => {
    const legal = `Founded by ${WEB_UI_LEGAL_ENTITY_NAME}.`;
    const report = reportFor({
      english: { "legal.notice": legal, "legal.kept": legal },
      catalogs: [
        catalog({
          locale: "de",
          brandSiteName: "Union der Menschlichkeit",
          entries: {
            "legal.notice": "Founded by Humanity Union.",
            "legal.kept": legal,
          },
        }),
      ],
    });
    const notice = report.findings.filter((finding) => finding.path === "legal.notice");
    assert.ok(notice.some((finding) => finding.evidence.includes(WEB_UI_LEGAL_ENTITY_NAME)));
    assert.ok(notice.some((finding) => finding.category === "hardcoded_platform_name"));
    assert.equal(
      report.findings.some((finding) => finding.path === "legal.kept" && finding.category === "hardcoded_platform_name"),
      false,
    );
    assert.equal(
      report.findings.some((finding) => finding.path === "legal.kept" && finding.evidence.includes(WEB_UI_LEGAL_ENTITY_NAME)),
      false,
    );
  });

  it("keeps approved brand and abbreviation text out of mixed-script defects", () => {
    const report = reportFor({
      english: {
        "brand.keep": "Name",
        "brand.term": "Assistant",
        "brand.kana": "Name",
        "brand.latin": "Hallo",
      },
      catalogs: [
        catalog({
          locale: "ar",
          textDirection: "rtl",
          glossary: [concept("assistant", "Assistant", "مساعد")],
          entries: {
            "brand.keep": `مرحبا ${WEB_UI_LEGAL_ENTITY_NAME} WPC`,
            "brand.term": "مرحبا Assistant",
            "brand.kana": "日本語かな",
            "brand.latin": "Hallo",
          },
        }),
      ],
    });
    assert.equal(report.findings.some((finding) => finding.path === "brand.keep" && finding.category === "mixed_script"), false);
    const assistant = report.findings.find((finding) => finding.path === "brand.term" && finding.category === "mixed_script");
    assert.equal(assistant?.classification, "REVIEW_CANDIDATE");
    assert.equal(assistant?.evidenceStrength, "glossary");
    assert.equal(assistant?.inReviewQueue, true);
    assert.equal(report.findings.some((finding) => finding.path === "brand.kana"), false);
    assert.equal(report.findings.some((finding) => finding.path === "brand.latin" && finding.category === "mixed_script"), false);
    const secondary = reportFor({
      english: { "brand.facebook": "Name" },
      catalogs: [
        catalog({
          locale: "ar",
          entries: { "brand.facebook": "مرحبا Facebook" },
        }),
      ],
    });
    const facebook = secondary.findings.find((finding) => finding.category === "mixed_script");
    assert.equal(facebook?.evidenceStrength, "script-difference");
    assert.equal(facebook?.inReviewQueue, false);
    assert.equal(facebook?.classification, "REVIEW_CANDIDATE");
  });

  it("uses glossary terms as evidence and ignores an ordinary English plural", () => {
    const glossary = [
      concept("public_impact", "Public Impact", "Impacto Público"),
      concept("official_response", "Official Response", "Respuesta oficial"),
      concept("assistant", "Assistant", "Asistente"),
    ];
    const report = reportFor({
      english: {
        "impact.body": "Public Impact report",
        "impact.plural": "Official Response",
        "assistant.title": "{siteName} Assistant",
        "assistant.used": "Ask the assistant",
      },
      catalogs: [
        catalog({
          locale: "pt",
          glossary,
          entries: {
            "impact.body": "Relatório de Public Impacto",
            "impact.plural": "Official Responses",
            "assistant.title": "{siteName}Assistant",
            "assistant.used": "Pergunte ao Asistente",
          },
        }),
      ],
    });
    assert.equal(report.findings.some((finding) => finding.path === "impact.body" && finding.category === "partial_translation"), true);
    assert.equal(report.findings.some((finding) => finding.path === "impact.plural" && finding.category === "partial_translation"), false);
    assert.equal(report.findings.some((finding) => finding.path === "assistant.title" && finding.category === "placeholder_boundary"), true);
    assert.equal(report.findings.some((finding) => finding.path === "assistant.used" && finding.category === "glossary_terminology"), false);
    const missed = reportFor({
      english: { "assistant.ask": "Ask Assistant" },
      catalogs: [
        catalog({
          locale: "es",
          glossary,
          entries: { "assistant.ask": "Preguntar al Assistant" },
        }),
      ],
    });
    assert.equal(missed.findings.some((finding) => finding.category === "glossary_terminology"), true);
  });

  it("applies configured terminology without a locale-specific scanner branch", () => {
    const { policy, sha256 } = loadLinguisticQualityPolicy();
    const report = buildLinguisticQualityReport({
      policy,
      policySha256: sha256,
      canonicalLocale: "en",
      english: leaves({
        "notifications.types.member_badge_shipped.title": "Member badge shipped",
        "membershipPublic.status.memberCohort": "Member",
        "membershipPublic.status.participantCohort": "Participant",
        "membershipPublic.pageTitle": "Membership",
        "membershipPublic.labels.journeySummary": "{completed} of {total} steps complete",
        "institutionsPublic.records.wpc.nonNominationNote": "World Protection Corps is operational.",
        "initiativeExperience.author.sidebar.askAssistant": "Ask Assistant",
        "knowledgePublic.articles.steward-glossary.title": "Steward",
      }),
      catalogs: [
        catalog({
          locale: "de",
          entries: {
            "notifications.types.member_badge_shipped.title": "Offizieller Mitglied-Artikel verschickt",
            "knowledgePublic.articles.steward-glossary.title": "Steward",
            "institutionsPublic.records.wpc.nonNominationNote": "Das World Protection Corps ist operativ.",
          },
          api: {
            "notifications.types.member_badge_shipped.title": "Offizieller Mitgliedsartikel verschickt",
            "knowledgePublic.articles.steward-glossary.title": "Steward",
            "institutionsPublic.records.wpc.nonNominationNote": "Das World Protection Corps ist operativ.",
          },
        }),
        catalog({
          locale: "uk",
          entries: {
            "membershipPublic.status.memberCohort": "Член Союзу Людяності",
            "membershipPublic.status.participantCohort": "Учасник",
            "membershipPublic.pageTitle": "Членство Союзу Людяності",
            "membershipPublic.labels.journeySummary": "{completed} кроків виконано з {total}",
          },
          api: {
            "membershipPublic.status.memberCohort": "Член",
            "membershipPublic.status.participantCohort": "Учасник",
            "membershipPublic.pageTitle": "Членство",
            "membershipPublic.labels.journeySummary": "{completed} з {total} кроків завершено",
          },
        }),
        catalog({
          locale: "es",
          entries: {
            "initiativeExperience.author.sidebar.askAssistant": "Preguntar al Assistant",
          },
        }),
      ],
    });
    const badge = report.findings.find((finding) => finding.ruleId === "de-member-badge-titles");
    assert.equal(badge?.classification, "REVIEW_CANDIDATE");
    assert.equal(badge?.inReviewQueue, true);
    const member = report.findings.find(
      (finding) => finding.ruleId === "member-designation" && finding.affectedSide === "packaged",
    );
    assert.equal(member?.classification, "CONFIRMED_DEFECT");
    assert.equal(member?.published, "Член Союзу Людяності");
    assert.equal(member?.packagedApi, "Член");
    assert.equal(
      report.findings.some(
        (finding) => finding.ruleId === "member-designation" && finding.affectedSide === "published",
      ),
      false,
    );
    assert.equal(report.findings.some((finding) => finding.ruleId === "participant-not-member"), false);
    assert.equal(report.findings.some((finding) => finding.ruleId === "uk-membership-phrase"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "uk-journey-summary"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "english-institution-name"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "es-pt-assistant-label"), true);
    const steward = report.findings.find((finding) => finding.ruleId === "de-steward-product-term");
    assert.equal(steward?.classification, "APPROVED_EXCEPTION");
    assert.equal(steward?.inReviewQueue, false);
  });

  it("discovers registry locales and does not replace a missing published snapshot", async () => {
    const selected = selectTargetLocales([
      { locale: "en", englishName: "English", nativeName: "English", textDirection: "ltr", fallbackLocale: "en" },
      { locale: "xx-future", englishName: "Future", nativeName: "Future", textDirection: "rtl", fallbackLocale: "en" },
    ]);
    assert.equal(selected.canonicalLocale, "en");
    assert.deepEqual(selected.targets.map((locale) => locale.locale), ["xx-future"]);
    assert.throws(() => selectTargetLocales([
      { locale: "en", englishName: "English", nativeName: "English", textDirection: "ltr", fallbackLocale: "en" },
      { locale: "de", englishName: "German", nativeName: "Deutsch", textDirection: "ltr", fallbackLocale: "de" },
    ]), /disagree/);

    const root = mkdtempSync(path.join(tmpdir(), "hu-lq-"));
    const webDir = path.join(root, "web");
    const apiDir = path.join(root, "api");
    mkdirSync(webDir);
    mkdirSync(apiDir);
    writeFileSync(path.join(webDir, "en.json"), "{}\n");
    writeFileSync(path.join(apiDir, "en.json"), "{}\n");
    let fetched = false;
    const report = await loadWebUiLinguisticQualityReport({
      policy: emptyPolicy,
      policySha256: "test",
      registry: [
        { locale: "en", englishName: "English", nativeName: "English", textDirection: "ltr", fallbackLocale: "en" },
        { locale: "xx-future", englishName: "Future", nativeName: "Future", textDirection: "rtl", fallbackLocale: "en" },
      ],
      publishedSnapshots: new Map([["xx-future", null]]),
      glossarySnapshots: new Map([["xx-future", null]]),
      brandSnapshots: new Map([["xx-future", null]]),
      webMessagesDir: webDir,
      packagedDir: apiDir,
      fetchImpl: async () => {
        fetched = true;
        throw new Error("network");
      },
      loadWeb: (locale) => (locale === "en" ? { greeting: "Hello" } : { greeting: "Packaged must stay packaged" }) as WebUiMessageTree,
      loadApi: (locale) => (locale === "en" ? { greeting: "Hello" } : { greeting: "Packaged must stay packaged" }) as WebUiMessageTree,
    });
    assert.equal(fetched, false);
    assert.equal(report.localeSummaries[0]?.locale, "xx-future");
    assert.equal(report.localeSummaries[0]?.textDirection, "rtl");
    assert.equal(report.localeSummaries[0]?.diagnosticsNotRun.includes("english-identical"), true);
    assert.equal(report.findings.some((finding) => finding.published === "Packaged must stay packaged"), false);
    assert.equal(report.findings.some((finding) => finding.category === "published_snapshot_missing"), true);
    assert.equal(report.coverage.publishedEntriesExamined, 0);
  });

  it("keeps report output deterministic and distinguishes findings from unique entries", () => {
    const input = {
      english: { "one.title": "Hello {name}", "one.titleNote": "Note" },
      catalogs: [
        catalog({
          locale: "ar",
          textDirection: "rtl",
          entries: { "one.title": "مرحبا", "one.titleNote": "ملاحظة" },
          api: { "one.title": "عنوان", "one.titleNote": "ملاحظة" },
        }),
        catalog({
          locale: "de",
          entries: { "one.title": "Hallo", "one.titleNote": "Hinweis" },
          api: { "one.title": "Titel", "one.titleNote": "Hinweis" },
        }),
      ],
    };
    const first = reportFor(input);
    const second = reportFor(input);
    assert.equal(renderLinguisticQualityReportJson(first), renderLinguisticQualityReportJson(second));
    assert.ok(first.coverage.findingCount > first.coverage.uniqueEntryCount);
    const filtered = reportFor({ ...input, filter: { locale: "de", pathPrefix: "one.title" } });
    assert.equal(filtered.coverage.localesDiscovered, 2);
    assert.ok(filtered.findings.every((finding) => finding.locale === "de" && finding.path.startsWith("one.title")));
    assert.equal(filtered.coverage.publishedEntriesExamined, first.coverage.publishedEntriesExamined);
    const before = [...input.catalogs[0]!.published!.entries()];
    reportFor(input);
    assert.deepEqual([...input.catalogs[0]!.published!.entries()], before);
  });

  it("rejects an exception that would hide a structural defect", () => {
    assert.throws(
      () => parseLinguisticQualityPolicy({
        id: "bad",
        exceptions: [
          {
            id: "hide",
            paths: ["a.b"],
            value: "Hello",
            suppresses: ["placeholder_mismatch"],
            reason: "too broad",
          },
        ],
        terminologyRules: [],
      }),
      LinguisticQualityPolicyError,
    );
  });

  it("parses the public registry without a locale allowlist", () => {
    const parsed = parsePublicLanguageRegistry({
      data: {
        languages: [
          { locale: "en", englishName: "English", nativeName: "English", textDirection: "ltr", fallbackLocale: "en" },
          { locale: "qa", englishName: "Future", nativeName: "Future", fallbackLocale: "en" },
        ],
      },
    });
    assert.deepEqual(parsed.textDirectionDefaultedLocales, ["qa"]);
    assert.equal(parsed.locales[1]?.textDirection, "ltr");
    const glossary = glossaryEvidenceFromPreferredTerms({
      preferredByConceptId: new Map([["initiative", "Ініціатива"], ["custom_only", "Other"]]),
    });
    assert.equal(glossary.glossary.find((item) => item.conceptId === "initiative")?.preferredTermState, "published");
    assert.equal(glossary.glossary.find((item) => item.conceptId === "member")?.preferredTermState, "absent-from-public-map");
    assert.deepEqual(glossary.unjoinedGlossaryConceptIds, ["custom_only"]);
  });

  it("reuses catalog readiness without flagging English-identical text as fallback", () => {
    const english = loadBundledWebUiMessagePackFromFs("en");
    const german = loadPackagedWebUiCatalog("de");
    assert.ok(english);
    assert.ok(german);
    const slice = assessWebUiMessageTreeReadiness({
      messages: german,
      requiredPaths: [...flattenWebUiCatalogLeaves(english).keys()],
      flagEnglishIdenticalAsFallback: false,
    });
    assert.equal(slice.missingKeyCount, 0);
    assert.equal(slice.emptyKeyCount, 0);
    assert.equal(slice.englishFallbackKeyCount, 0);
  });
});
