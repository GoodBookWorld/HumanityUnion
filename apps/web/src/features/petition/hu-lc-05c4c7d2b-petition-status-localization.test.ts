/**
 * HU-LC-05C.4C.7D.2B — Petition Status WEB_UI localization.
 * Renders against each raw bundled catalog (no English merge) so a missing
 * translation fails instead of silently falling back to English.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createTranslator,
  NextIntlClientProvider,
  type AbstractIntlMessages,
  type IntlError,
} from "next-intl";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  isPublicReaderWebUiRequiredPath,
  type CollaborativeAnalysis,
  type CollectiveDecision,
  type Initiative,
  type PetitionState,
  type PublicPetitionRecord,
} from "@hu/types";

import { normalizeWorkspaceNavSection } from "../../components/member/WorkspaceSectionNav";
import { ApiRequestError } from "../../lib/api-client";
import { PetitionDocumentViewsTabs } from "../initiative-petition-lifecycle/components/PetitionDocumentViews";
import { PetitionWorkspace } from "./components/PetitionWorkspace";
import { SignatureSection } from "./components/SignatureSection";
import {
  COLLECTIVE_DECISION_STATUS_LABEL_KEYS,
  DECISION_OUTCOME_LABEL_KEYS,
  PETITION_OUTCOME_LABEL_KEYS,
  PETITION_PIPELINE_STAGES,
  PETITION_STATE_LABEL_KEYS,
  PETITION_STATUS_SECTIONS,
  formatPetitionDate,
  formatPetitionList,
  formatPetitionNumber,
  formatPetitionPercent,
  nextMeaningfulActionKeys,
  petitionPipelineStageStateKey,
  petitionStatusNavItems,
  signatureActionErrorKey,
  supportStatusSummaryKey,
  translateToken,
} from "./petition-status-i18n";
import { resolveSignatureSectionState } from "./petition-utils";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const LOCALES = ["en", "uk", "ar", "zh-Hant"] as const;
type Locale = (typeof LOCALES)[number];

const STATUS = "author.petition.public.status";
const PETITION_STATES: readonly PetitionState[] = [
  "Draft",
  "Ready",
  "Published",
  "Open",
  "Closed",
  "Archived",
];

function readWeb(relative: string): string {
  return readFileSync(path.join(WEB_SRC, relative), "utf8");
}

function catalog(locale: Locale): AbstractIntlMessages {
  return JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;
}

function leaf(messages: AbstractIntlMessages, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);
}

function flatten(node: unknown, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[dotted] = value;
    } else if (value && typeof value === "object") {
      flatten(value, dotted, out);
    }
  }
  return out;
}

function renderIn(locale: Locale, element: ReactElement): { html: string; errors: string[] } {
  const errors: string[] = [];
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: catalog(locale),
        timeZone: "UTC",
        onError: (error: IntlError) => {
          errors.push(error.message);
        },
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      element,
    ),
  );
  return { html, errors };
}

function petition(status: PetitionState, extra: Partial<PublicPetitionRecord> = {}) {
  return {
    petitionId: "petition-7d2b",
    collectiveDecisionId: "decision-7d2b",
    status,
    createdAt: "2026-11-08T00:00:00.000Z",
    updatedAt: "2026-11-08T00:00:00.000Z",
    subject: {
      decisionId: "decision-7d2b",
      initiativeId: "initiative-7d2b",
      title: "Safer School Crossings",
      summary: "Protected crossings near every primary school.",
    },
    policy: {
      endorsementPeriod: { opensAt: "2026-11-10T00:00:00.000Z", closesAt: "2026-12-10T00:00:00.000Z" },
      withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
    },
    shareLink: null,
    supportMetrics: {
      totalSignatures: 1234,
      participantSignatures: 1200,
      dailyActivity: [
        { date: "2026-11-09", signatureCount: 1 },
        { date: "2026-11-10", signatureCount: 2 },
        { date: "2026-11-11", signatureCount: 5 },
      ],
      supportThresholdStatus: {
        thresholdDefined: true,
        thresholdReached: false,
        currentCount: 1234,
        thresholdCount: 5000,
      },
    },
    outcome:
      status === "Closed" || status === "Archived"
        ? { outcomeType: "ThresholdReached", explanation: "Council review requested." }
        : null,
    ...extra,
  } as unknown as PublicPetitionRecord;
}

const DECISION = {
  status: "Completed",
  ballot: {
    question: "Should crossings be protected?",
    options: [{ optionId: "yes", label: "Protect crossings" }],
  },
  decisionResult: { winningOptionId: "yes" },
  outcome: { outcomeType: "Approved", explanation: "Majority approved." },
} as unknown as CollectiveDecision;
const INITIATIVE = { description: "Make school routes safer." } as unknown as Initiative;
const ANALYSIS = { readiness: { readinessScore: 75 } } as unknown as CollaborativeAnalysis;

function workspace(status: PetitionState) {
  return createElement(PetitionWorkspace, {
    initialPetition: petition(status),
    collectiveDecision: DECISION,
    initiative: INITIATIVE,
    collaborativeAnalysis: ANALYSIS,
  });
}

function signature(status: PetitionState, authStatus: "authenticated" | "unauthenticated" | "pending", viewer: "signed" | "unsigned" | "unavailable" | "unknown") {
  return createElement(SignatureSection, {
    petition: petition(status),
    authStatus,
    viewerSignature: viewer,
    onPetitionUpdated: () => undefined,
    onViewerSignatureChange: () => undefined,
    onSignatureStatusStale: () => undefined,
  });
}

/** Every `initiativeExperience` key the Petition Status code can ask for. */
function referencedKeys(): string[] {
  const keys = new Set<string>();
  for (const section of PETITION_STATUS_SECTIONS) keys.add(section.labelKey);
  for (const map of [
    PETITION_STATE_LABEL_KEYS,
    COLLECTIVE_DECISION_STATUS_LABEL_KEYS,
    DECISION_OUTCOME_LABEL_KEYS,
    PETITION_OUTCOME_LABEL_KEYS,
  ]) {
    for (const key of Object.values(map)) keys.add(key);
  }
  for (const { stage, labelKey } of PETITION_PIPELINE_STAGES) {
    keys.add(labelKey);
    keys.add(petitionPipelineStageStateKey(stage));
  }
  for (const state of PETITION_STATES) {
    const summary = supportStatusSummaryKey(state);
    if (summary) keys.add(summary);
    for (const signed of [true, false]) {
      const action = nextMeaningfulActionKeys(state, signed);
      keys.add(action.titleKey);
      keys.add(action.detailKey);
    }
  }
  for (const status of [401, 403, 404, 409, 500]) {
    for (const action of ["sign", "withdraw"] as const) {
      keys.add(signatureActionErrorKey(new ApiRequestError("x", status), action));
    }
  }

  const sources = [
    "app/petitions/[petitionId]/page.tsx",
    "features/petition/components/PetitionStatus.tsx",
    "features/petition/components/PetitionSubject.tsx",
    "features/petition/components/DecisionContext.tsx",
    "features/petition/components/SignatureSection.tsx",
    "features/petition/components/SupportMetrics.tsx",
    "features/petition/components/PetitionOutcomeSection.tsx",
    "features/petition/components/ContributionRecognition.tsx",
    "features/petition/components/RelatedLinks.tsx",
    "features/implementation-commitment/components/ViewImplementationCommitmentLink.tsx",
    "features/implementation/components/ViewImplementationLink.tsx",
  ];
  for (const file of sources) {
    const source = readWeb(file);
    const prefixes = new Map<string, string>();
    for (const match of source.matchAll(/const (\w+) = "([\w.]+)";/g)) {
      prefixes.set(match[1] ?? "", match[2] ?? "");
    }
    for (const match of source.matchAll(/\bt\(`\$\{(\w+)\}\.([\w.]+)`/g)) {
      const prefix = prefixes.get(match[1] ?? "");
      assert.ok(prefix, `${file}: unknown prefix ${match[1]}`);
      keys.add(`${prefix}.${match[2]}`);
    }
    for (const match of source.matchAll(/\bt\("([\w.]+)"/g)) {
      keys.add(match[1] ?? "");
    }
  }
  return [...keys].sort();
}

describe("HU-LC-05C.4C.7D.2B — Petition Status localization", () => {
  it("every referenced key has a non-empty translation in en, uk, ar and zh-Hant", () => {
    const keys = referencedKeys();
    assert.ok(keys.length > 100, `only ${keys.length} keys found`);
    for (const locale of LOCALES) {
      const messages = catalog(locale);
      for (const key of keys) {
        const value = leaf(messages, `initiativeExperience.${key}`);
        assert.equal(typeof value, "string", `${locale}: initiativeExperience.${key}`);
        assert.ok((value as string).trim(), `${locale}: initiativeExperience.${key} is empty`);
      }
      for (const key of ["auth.yes", "auth.no"]) {
        assert.ok(String(leaf(messages, key) ?? "").trim(), `${locale}: ${key}`);
      }
    }
  });

  it("every referenced key is public-reader required, so future languages translate it", () => {
    for (const key of [
      ...referencedKeys().map((relative) => `initiativeExperience.${relative}`),
      "auth.yes",
      "auth.no",
    ]) {
      assert.equal(isPublicReaderWebUiRequiredPath(key), true, key);
    }
  });

  it("new subtrees have identical key sets and ICU arguments in all four catalogs", () => {
    const english = catalog("en");
    const subtrees = [`initiativeExperience.${STATUS}`, "initiativeExperience.petitionSignature"];
    for (const subtree of subtrees) {
      const en = flatten(leaf(english, subtree));
      for (const locale of LOCALES) {
        const localized = flatten(leaf(catalog(locale), subtree));
        assert.deepEqual(Object.keys(localized).sort(), Object.keys(en).sort(), `${locale} ${subtree}`);
        for (const [key, value] of Object.entries(en)) {
          const args = (text: string) =>
            [...text.matchAll(/\{(\w+)(?:,|\})/g)].map((match) => match[1]).sort();
          assert.deepEqual(args(localized[key] ?? ""), args(value), `${locale} ${subtree}.${key}`);
          if (locale !== "en") {
            assert.doesNotMatch(localized[key] ?? "", /'/, `${locale} ${key}: ASCII apostrophe`);
          }
        }
      }
    }
  });

  it("packaged API catalogs are byte-identical to the Web catalogs", () => {
    for (const locale of LOCALES) {
      const packaged = readFileSync(
        path.resolve(WEB_SRC, `../../api/assets/packaged-web-ui-catalogs/${locale}.json`),
        "utf8",
      );
      assert.equal(packaged, readWeb(`features/i18n/messages/${locale}.json`), locale);
    }
  });

  it("renders every Petition state in every language without a missing message", () => {
    for (const locale of LOCALES) {
      for (const state of PETITION_STATES) {
        const { html, errors } = renderIn(locale, workspace(state));
        assert.deepEqual(errors, [], `${locale} ${state}`);
        assert.doesNotMatch(html, /author\.petition\.public|petitionSignature\./, `${locale} ${state}`);
      }
    }
  });

  it("English and Ukrainian render their own section titles and field labels", () => {
    const en = renderIn("en", workspace("Open")).html;
    const uk = renderIn("uk", workspace("Open")).html;
    for (const text of ["Petition Status", "Petition Subject", "Support Metrics", "Lifecycle State", "Related Links"]) {
      assert.match(en, new RegExp(text), `en ${text}`);
      assert.doesNotMatch(uk, new RegExp(`>${text}<`), `uk still shows ${text}`);
    }
    for (const text of ["Стан петиції", "Предмет петиції", "Показники підтримки", "Стан життєвого циклу", "Пов’язані посилання", "Відкрита"]) {
      assert.match(uk, new RegExp(text), `uk ${text}`);
    }
  });

  it("Traditional Chinese and Arabic render translated section titles", () => {
    assert.match(renderIn("zh-Hant", workspace("Open")).html, /請願主題/);
    assert.match(renderIn("zh-Hant", workspace("Open")).html, /支持指標/);
    assert.match(renderIn("ar", workspace("Open")).html, /موضوع العريضة/);
    assert.match(renderIn("ar", workspace("Open")).html, /مؤشرات التأييد/);
  });

  it("keeps the English-derived section anchors in every language", () => {
    const legacyTitles = [
      "Petition Status",
      "Petition Subject",
      "Decision Context",
      "Signature",
      "Support Metrics",
      "Petition Outcome",
      "Contribution Recognition",
      "Next Meaningful Action",
      "Related Links",
    ];
    assert.deepEqual(
      PETITION_STATUS_SECTIONS.map((section) => section.id),
      legacyTitles.map((title) => title.replace(/\s+/g, "-").toLowerCase()),
    );
    const nav = petitionStatusNavItems((key) => `label:${key}`);
    assert.deepEqual(
      nav.map((item) => item.id),
      legacyTitles.map((title) => normalizeWorkspaceNavSection(title).id),
    );
    for (const locale of LOCALES) {
      const { html } = renderIn(locale, workspace("Open"));
      for (const section of PETITION_STATUS_SECTIONS) {
        assert.match(html, new RegExp(`<section class="profile-section" id="${section.id}" aria-labelledby="section-${section.id}"`), `${locale} ${section.id}`);
        assert.match(html, new RegExp(`id="section-${section.id}"`), `${locale} heading ${section.id}`);
      }
    }
    assert.doesNotMatch(readWeb("app/petitions/[petitionId]/page.tsx"), /NAV_ITEMS|"Petition Status"/);
  });

  it("formats dates, numbers and percentages in the app locale", () => {
    const iso = "2026-11-08T00:00:00.000Z";
    assert.equal(formatPetitionDate("en", iso), "November 8, 2026");
    assert.match(formatPetitionDate("uk", iso) ?? "", /листопада 2026/);
    assert.match(formatPetitionDate("ar", iso) ?? "", /نوفمبر/);
    assert.match(formatPetitionDate("zh-Hant", iso) ?? "", /2026年11月8日/);
    assert.equal(formatPetitionDate("en", null), null);
    assert.equal(formatPetitionDate("en", "not-a-date"), null);
    assert.equal(formatPetitionNumber("en", 12345), "12,345");
    assert.equal(formatPetitionNumber("uk", 12345), new Intl.NumberFormat("uk").format(12345));
    assert.notEqual(formatPetitionNumber("uk", 12345), "12,345");
    assert.equal(formatPetitionPercent("en", 75), "75%");
    assert.equal(formatPetitionPercent("uk", 75), new Intl.NumberFormat("uk", { style: "percent" }).format(0.75));
    assert.equal(formatPetitionList("en", ["a", "b"]), new Intl.ListFormat("en", { style: "short", type: "unit" }).format(["a", "b"]));

    const uk = renderIn("uk", workspace("Open")).html;
    assert.match(uk, new RegExp(new Intl.NumberFormat("uk").format(1234)));
    assert.match(uk, /листопада 2026/);
    assert.doesNotMatch(uk, /November/);
  });

  it("uses each language's plural categories, including all six Arabic forms", () => {
    const say = (locale: Locale, count: number) => {
      const translate = createTranslator({
        locale,
        messages: catalog(locale),
        namespace: "initiativeExperience",
      }) as unknown as (key: string, values: Record<string, string | number>) => string;
      return translate(`${STATUS}.support.activityEntry`, { date: "D", count });
    };
    assert.equal(say("en", 1), "D: 1 signature");
    assert.equal(say("en", 2), "D: 2 signatures");
    assert.equal(say("uk", 1), "D: 1 підпис");
    assert.equal(say("uk", 3), "D: 3 підписи");
    assert.equal(say("uk", 5), "D: 5 підписів");
    assert.equal(say("uk", 21), "D: 21 підпис");
    const arabic = [0, 1, 2, 3, 11, 100].map((count) => say("ar", count));
    assert.equal(new Set(arabic).size, 6, arabic.join(" | "));
    assert.match(say("zh-Hant", 2), /2 個簽名/);
  });

  it("maps every raw enum token to a label and keeps unknown tokens unchanged", () => {
    const t = (key: string) => `T(${key})`;
    for (const map of [
      PETITION_STATE_LABEL_KEYS,
      COLLECTIVE_DECISION_STATUS_LABEL_KEYS,
      DECISION_OUTCOME_LABEL_KEYS,
      PETITION_OUTCOME_LABEL_KEYS,
    ]) {
      for (const [token, key] of Object.entries(map)) {
        assert.equal(translateToken(t, map, token), `T(${key})`);
      }
    }
    assert.equal(translateToken(t, PETITION_STATE_LABEL_KEYS, "FutureState"), "FutureState");
    assert.equal(translateToken(t, PETITION_STATE_LABEL_KEYS, "toString"), "toString");
    assert.equal(resolveSignatureSectionState({ authStatus: "unauthenticated", viewerSignature: "unknown", justSigned: false, petitionStatus: "Open" }), "sign_in");
    const uk = renderIn("uk", workspace("Closed")).html;
    assert.match(uk, /Закрита/);
    assert.match(uk, /Завершено/);
    assert.match(uk, /Схвалено/);
    assert.match(uk, /Поріг досягнуто/);
  });

  it("keeps the signing request, payload and server-derived signer state unchanged", () => {
    const source = readWeb("features/petition/components/SignatureSection.tsx");
    assert.match(source, /signPetitionAsCurrentParticipant\(petition\.petitionId, "Community"\)/);
    assert.match(source, /withdrawPetitionSignature\(petition\.petitionId\)/);
    assert.doesNotMatch(source, /participantId|BOOTSTRAP_PARTICIPANT_ID/);
    assert.doesNotMatch(source, /error\.message|registrationGatewayMessage/);
    assert.match(readWeb("features/petition/use-viewer-petition-signature.ts"), /projection\.viewerHasSigned/);
    assert.doesNotMatch(readWeb("features/petition/use-viewer-petition-signature.ts"), /registrationGatewayMessage/);
  });

  it("maps signature failures by HTTP status and action, never by API text", () => {
    const failure = (status: number) => new ApiRequestError("Raw English API message", status);
    const cases: Array<[unknown, "sign" | "withdraw", string]> = [
      [failure(401), "sign", "petitionSignature.errors.signInAgain"],
      [failure(401), "withdraw", "petitionSignature.errors.signInAgain"],
      [failure(403), "sign", "petitionSignature.errors.notEligible"],
      [failure(403), "withdraw", "petitionSignature.errors.withdrawNotAllowed"],
      [failure(404), "sign", "petitionSignature.errors.petitionUnavailable"],
      [failure(409), "sign", "petitionSignature.errors.statusChanged"],
      [failure(409), "withdraw", "petitionSignature.errors.statusChanged"],
      [failure(500), "sign", "petitionSignature.recordFailed"],
      [failure(0), "withdraw", "petitionSignature.withdrawFailed"],
      [new Error("network"), "sign", "petitionSignature.recordFailed"],
      [new Error("You are not eligible"), "withdraw", "petitionSignature.withdrawFailed"],
    ];
    for (const [error, action, expected] of cases) {
      assert.equal(signatureActionErrorKey(error, action), expected);
    }
  });

  it("derives registration guidance from the Petition status in every language", () => {
    for (const locale of LOCALES) {
      const messages = catalog(locale);
      const text = (key: string) => String(leaf(messages, `initiativeExperience.petitionSignature.${key}`));
      const open = renderIn(locale, signature("Open", "unauthenticated", "signed"));
      assert.deepEqual(open.errors, []);
      assert.ok(open.html.includes(text("signInGuidance")), locale);
      assert.doesNotMatch(open.html, /<button/);
      const published = renderIn(locale, signature("Published", "unauthenticated", "unknown")).html;
      assert.ok(published.includes(text("notOpenPublished")), locale);
      assert.ok(!published.includes(text("signInGuidance")), locale);
      const closed = renderIn(locale, signature("Closed", "unauthenticated", "unknown")).html;
      assert.ok(closed.includes(text("notOpenEnded")), locale);
      for (const [auth, viewer] of [
        ["authenticated", "signed"],
        ["authenticated", "unsigned"],
        ["authenticated", "unavailable"],
        ["pending", "unknown"],
      ] as const) {
        assert.deepEqual(renderIn(locale, signature("Open", auth, viewer)).errors, [], `${locale} ${auth} ${viewer}`);
      }
    }
  });

  it("shows the Editing Petition tab only to the steward, with localized tab labels", () => {
    const tabs = (canEdit: boolean) =>
      renderIn(
        "uk",
        createElement(PetitionDocumentViewsTabs, {
          activeView: "editing",
          canEdit,
          onSelect: () => undefined,
          statusPanel: createElement("p", null, "STATUS"),
          editingPanel: createElement("p", null, "EDITING"),
        }),
      ).html;
    const reader = tabs(false);
    assert.match(reader, /Стан петиції/);
    assert.doesNotMatch(reader, /ipl-document-tab-editing/);
    assert.match(reader, /STATUS/);
    assert.doesNotMatch(reader, /EDITING/);
    const steward = tabs(true);
    assert.match(steward, /ipl-document-tab-editing/);
    assert.match(steward, /EDITING/);
  });

  it("leaves authored Petition and non-synthetic decision content untranslated (7E)", () => {
    const uk = renderIn("uk", workspace("Closed")).html;
    for (const text of [
      "Safer School Crossings",
      "Protected crossings near every primary school.",
      "Should crossings be protected?",
      "Protect crossings",
      "Majority approved.",
      "Make school routes safer.",
      "decision-7d2b",
    ]) {
      assert.ok(uk.includes(text), text);
    }
    assert.ok(!uk.includes("Council review requested."), "7E.5B: outcome explanation is WEB_UI");
    for (const file of [
      "features/petition/components/PetitionStatus.tsx",
      "features/petition/components/PetitionSubject.tsx",
      "features/petition/components/DecisionContext.tsx",
      "features/petition/components/PetitionOutcomeSection.tsx",
      "features/petition/petition-status-i18n.ts",
    ]) {
      assert.doesNotMatch(readWeb(file), /content-translation|ContentTranslation|translateContent/, file);
    }
  });

  it("uses logical alignment and keeps link rows wrapping without horizontal overflow", () => {
    const page = readWeb("app/petitions/petition-page.css");
    assert.match(page, /\.petition-page \{\s*text-align: start;/);
    assert.doesNotMatch(page, /text-align:\s*(left|right)/);
    assert.match(page, /\.petition-page__links \{[^}]*flex-wrap: wrap;/);
    const workspaceCss = readWeb("features/petition/components/workspace.css");
    assert.match(workspaceCss, /\.related-links \{[^}]*flex-wrap: wrap;/);
    for (const css of [page, workspaceCss]) {
      assert.doesNotMatch(css, /overflow-x|white-space:\s*nowrap|\bwidth:\s*\d+px/);
    }
  });
});
