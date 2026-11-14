/**
 * HU-LC-05C.4C.7E.5B — remaining system-generated Petition text is WEB_UI,
 * authored Initiative context uses V5 Content Translation, and Petition
 * shares link to the specific Petition. Renders against each raw bundled
 * catalog (no English merge) so a missing translation fails.
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
  type CollectiveDecision,
  type Initiative,
  type PetitionState,
  type PublicPetitionRecord,
} from "@hu/types";

import { buildPublicPetitionSharePayload } from "../civic-share/civic-share.actions";
import { InitiativePetitionSignatureWidget } from "../initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget";
import { readRequestedPetitionId } from "../initiative-petition-lifecycle/petition-viewer-selection";
import { DecisionContext } from "./components/DecisionContext";
import { PetitionOutcomeSection } from "./components/PetitionOutcomeSection";
import { PetitionWorkspace } from "./components/PetitionWorkspace";
import {
  isPetitionSyntheticDecision,
  PETITION_OUTCOME_EXPLANATION_KEYS,
  petitionDecisionText,
  petitionOutcomeExplanationKey,
  signatureNotOpenKey,
  SYNTHETIC_DECISION_OPTION_LABEL_KEYS,
} from "./petition-status-i18n";
import {
  initiativeTranslationSourceId,
  selectInitiativeReadingText,
  type InitiativeReadingText,
} from "./use-initiative-reading-text";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const LOCALES = ["en", "uk", "ar", "zh-Hant"] as const;
type Locale = (typeof LOCALES)[number];

const STATUS = "author.petition.public.status";
const NEW_KEYS = [
  `${STATUS}.outcome.explanations.active`,
  `${STATUS}.outcome.explanations.closed`,
  `${STATUS}.outcome.explanations.archived`,
  `${STATUS}.decision.synthetic.question`,
  `${STATUS}.decision.synthetic.explanation`,
  `${STATUS}.decision.synthetic.options.approve`,
  `${STATUS}.decision.synthetic.options.reject`,
  `${STATUS}.decision.synthetic.note`,
] as const;

const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");
const catalog = (locale: Locale) =>
  JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)) as AbstractIntlMessages;

function leaf(messages: AbstractIntlMessages, dotted: string): string {
  const value = dotted
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);
  return typeof value === "string" ? value : "";
}

const message = (locale: Locale, key: string) => leaf(catalog(locale), `initiativeExperience.${key}`);

function translator(locale: Locale) {
  return createTranslator({
    locale,
    messages: catalog(locale),
    namespace: "initiativeExperience",
  }) as unknown as (key: string, values?: Record<string, string>) => string;
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

const PETITION_ID = "petition-7e5b";
const INITIATIVE_ID = "initiative-7e5b";
const API_OUTCOME_ENGLISH = "API English outcome sentence.";
const SYNTHETIC_QUESTION = 'Should "Clean Rivers" proceed to the Petition stage?';
const SYNTHETIC_EXPLANATION =
  'The Initiative Lifecycle Revision for "Clean Rivers" is ready for public participation.';

function petition(status: PetitionState, extra: Partial<PublicPetitionRecord> = {}) {
  return {
    petitionId: PETITION_ID,
    collectiveDecisionId: `decision-${PETITION_ID}`,
    status,
    createdAt: "2026-11-08T00:00:00.000Z",
    updatedAt: "2026-11-08T00:00:00.000Z",
    subject: {
      decisionId: `decision-${PETITION_ID}`,
      initiativeId: INITIATIVE_ID,
      title: "Clean Rivers Petition",
      summary: "Stop untreated discharge.",
    },
    policy: {
      endorsementPeriod: { opensAt: null, closesAt: null },
      withdrawalPolicy: { withdrawalPermitted: true, withdrawalPolicyDescription: null },
    },
    shareLink: null,
    supportMetrics: {
      totalSignatures: 7,
      participantSignatures: 7,
      dailyActivity: [],
      supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 7, thresholdCount: null },
    },
    outcome: null,
    ...extra,
  } as unknown as PublicPetitionRecord;
}

function syntheticDecision(overrides: Partial<CollectiveDecision> = {}): CollectiveDecision {
  return {
    decisionId: `decision-${PETITION_ID}`,
    decisionSubjectType: "Initiative",
    decisionSubjectId: INITIATIVE_ID,
    decisionMechanism: "CommunityPoll",
    status: "Completed",
    ballot: {
      ballotId: "ballot-petition-lifecycle-1",
      question: SYNTHETIC_QUESTION,
      options: [
        { optionId: "option-petition-bootstrap-approve", label: "Approve", description: "Proceed to the Petition stage.", value: "Approve", order: 1 },
        { optionId: "option-petition-bootstrap-reject", label: "Reject", description: "Do not proceed to the Petition stage.", value: "Reject", order: 2 },
      ],
    },
    decisionResult: { winningOptionId: "option-petition-bootstrap-approve" },
    outcome: { outcomeType: "Approved", explanation: SYNTHETIC_EXPLANATION },
    ...overrides,
  } as unknown as CollectiveDecision;
}

const COMMUNITY_DECISION = syntheticDecision({
  decisionId: "decision-community-vote",
  ballot: {
    question: "Which river should be restored first?",
    options: [{ optionId: "opt-1", label: "Northern river", value: "Approve" }],
  },
  outcome: { outcomeType: "Approved", explanation: "Most participants chose the northern river." },
  decisionResult: { winningOptionId: "opt-1" },
} as unknown as Partial<CollectiveDecision>);

const INITIATIVE_TEXT: InitiativeReadingText = {
  title: "Clean Rivers",
  description: "Restore the rivers.",
  lang: undefined,
};

const PUBLIC_INITIATIVE = {
  initiativeId: INITIATIVE_ID,
  title: "Clean Rivers",
  description: "Restore the rivers.",
  lifecyclePhase: "projected",
  visibility: { policy: "public" },
} as unknown as Initiative;

function decisionContext(decision: CollectiveDecision | null, locale: Locale, text = INITIATIVE_TEXT) {
  return renderIn(
    locale,
    createElement(DecisionContext, {
      collectiveDecision: decision,
      petition: petition("Open"),
      initiativeText: text,
      collaborativeAnalysis: null,
    }),
  );
}

describe("HU-LC-05C.4C.7E.5B — Petition outcome explanation", () => {
  it("A. every outcome token the API produces shows its WEB_UI explanation in every language", () => {
    for (const locale of LOCALES) {
      for (const [token, key] of [
        ["Active", "active"],
        ["Closed", "closed"],
        ["Archived", "archived"],
      ] as const) {
        assert.equal(petitionOutcomeExplanationKey(token), `${STATUS}.outcome.explanations.${key}`);
        const { html, errors } = renderIn(
          locale,
          createElement(PetitionOutcomeSection, {
            petition: petition("Closed", {
              outcome: { outcomeId: "o", outcomeType: token, derivedAt: "", explanation: API_OUTCOME_ENGLISH },
            } as Partial<PublicPetitionRecord>),
          }),
        );
        assert.deepEqual(errors, [], `${locale} ${token}`);
        assert.ok(html.includes(message(locale, `${STATUS}.outcome.explanations.${key}`)), `${locale} ${token}`);
        assert.ok(!html.includes(API_OUTCOME_ENGLISH), `${locale} ${token} shows API English`);
      }
    }
  });

  it("B. unknown or unexplained tokens use the localized 'Not available' fallback", () => {
    for (const token of ["ThresholdReached", "FutureOutcome", "toString", ""]) {
      assert.equal(petitionOutcomeExplanationKey(token), `${STATUS}.overview.notAvailable`, token);
    }
    const uk = renderIn(
      "uk",
      createElement(PetitionOutcomeSection, {
        petition: petition("Archived", {
          outcome: { outcomeId: "o", outcomeType: "FutureOutcome", derivedAt: "", explanation: API_OUTCOME_ENGLISH },
        } as unknown as Partial<PublicPetitionRecord>),
      }),
    ).html;
    assert.ok(uk.includes(message("uk", `${STATUS}.overview.notAvailable`)));
    assert.ok(!uk.includes(API_OUTCOME_ENGLISH));
  });

  it("keeps the API payload unchanged", () => {
    const record = petition("Closed", {
      outcome: { outcomeId: "o", outcomeType: "Closed", derivedAt: "", explanation: API_OUTCOME_ENGLISH },
    } as Partial<PublicPetitionRecord>);
    const before = structuredClone(record);
    renderIn("ar", createElement(PetitionOutcomeSection, { petition: record }));
    assert.deepEqual(record, before);
    assert.deepEqual(Object.keys(PETITION_OUTCOME_EXPLANATION_KEYS).sort(), ["Active", "Archived", "Closed"]);
  });
});

describe("HU-LC-05C.4C.7E.5B — public signature widget", () => {
  const widget = (status: PetitionState) =>
    createElement(InitiativePetitionSignatureWidget, {
      petitionId: PETITION_ID,
      petitionStatus: status,
      viewerHasSigned: false,
      signingAvailable: status === "Open",
      onSignatureChange: () => undefined,
    });

  it("C. guidance follows the actual Petition status in every language", () => {
    const expected: Record<PetitionState, string> = {
      Draft: "notOpenPreparing",
      Ready: "notOpenPreparing",
      Published: "notOpenPublished",
      Open: "signInGuidance",
      Closed: "notOpenEnded",
      Archived: "notOpenEnded",
    };
    for (const locale of LOCALES) {
      for (const [status, key] of Object.entries(expected) as Array<[PetitionState, string]>) {
        const { html, errors } = renderIn(locale, widget(status));
        assert.deepEqual(errors, [], `${locale} ${status}`);
        assert.ok(html.includes(message(locale, `petitionSignature.${key}`)), `${locale} ${status}`);
        assert.doesNotMatch(html, /<button/, `${locale} ${status}: signed-out viewers get no action`);
      }
    }
    assert.equal(signatureNotOpenKey("Published"), "petitionSignature.notOpenPublished");
  });

  it("D. failures use the HTTP-status mapping, never the API's message text", () => {
    const source = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    assert.match(source, /signatureActionErrorKey\(submissionError, "sign"\)/);
    assert.match(source, /signatureActionErrorKey\(submissionError, "withdraw"\)/);
    assert.match(source, /\{t\(errorKey\)\}/);
    assert.doesNotMatch(source, /\.message\b|detailFromError|registrationGatewayMessage/);
  });

  it("L. signing calls, auth gates, counts and selection wiring are unchanged", () => {
    const source = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    assert.match(source, /signPetitionAsCurrentParticipant\(petitionId\)/);
    assert.match(source, /withdrawPetitionSignature\(petitionId\)/);
    assert.match(source, /onSignatureChange\(true\)/);
    assert.match(source, /onSignatureChange\(false\)/);
    assert.match(source, /authStatus !== "authenticated"/);
    assert.match(source, /if \(!signingAvailable\)/);
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(result, /petitionStatus=\{petitionIdentity\.lifecycleStatus\}/);
    assert.match(result, /signingAvailable=\{projection\.participationEntryGuidance\.signingAvailable\}/);
    assert.match(result, /supportBreakdown\.participantSignatures/);
    assert.match(result, /signatureRefresher\.afterSignatureChange\(/);
    assert.match(
      readWeb("features/petition/components/SignatureSection.tsx"),
      /signPetitionAsCurrentParticipant\(petition\.petitionId, "Community"\)/,
    );
  });
});

describe("HU-LC-05C.4C.7E.5B — synthetic Collective Decision text", () => {
  it("E. detection uses the deterministic identity, not English text", () => {
    const record = petition("Open");
    assert.equal(isPetitionSyntheticDecision(syntheticDecision(), record), true);
    for (const decision of [
      syntheticDecision({ decisionId: "decision-other-petition" }),
      syntheticDecision({ decisionSubjectId: "initiative-other" }),
      syntheticDecision({ decisionSubjectType: "Analysis" } as unknown as Partial<CollectiveDecision>),
    ]) {
      assert.equal(isPetitionSyntheticDecision(decision, record), false, decision.decisionId);
    }
    assert.equal(
      isPetitionSyntheticDecision(syntheticDecision(), petition("Open", { collectiveDecisionId: "decision-x" })),
      false,
    );

    const t = translator("uk");
    const reworded = petitionDecisionText({
      decision: syntheticDecision({
        ballot: { ...syntheticDecision().ballot, question: "Any stored wording" },
      }),
      petition: record,
      initiativeTitle: "Clean Rivers",
      translate: t,
    });
    assert.equal(reworded.question, "Чи має «Clean Rivers» перейти до етапу петиції?");

    const lookalike = petitionDecisionText({
      decision: syntheticDecision({ decisionId: "decision-lookalike" }),
      petition: record,
      initiativeTitle: "Clean Rivers",
      translate: t,
    });
    assert.equal(lookalike.synthetic, false);
    assert.equal(lookalike.question, SYNTHETIC_QUESTION);
    assert.equal(lookalike.winningOption, "Approve");
  });

  it("localizes question, explanation and Approve/Reject for the verified bookkeeping decision", () => {
    for (const locale of LOCALES) {
      const t = translator(locale);
      const text = petitionDecisionText({
        decision: syntheticDecision(),
        petition: petition("Open"),
        initiativeTitle: "Clean Rivers",
        translate: t,
      });
      assert.equal(text.synthetic, true);
      assert.equal(text.question, t(`${STATUS}.decision.synthetic.question`, { initiativeTitle: "Clean Rivers" }));
      assert.equal(
        text.explanation,
        t(`${STATUS}.decision.synthetic.explanation`, { initiativeTitle: "Clean Rivers" }),
      );
      assert.equal(text.winningOption, t(SYNTHETIC_DECISION_OPTION_LABEL_KEYS.Approve ?? ""));
      assert.ok(text.question.includes("Clean Rivers"));

      const rejected = petitionDecisionText({
        decision: syntheticDecision({
          decisionResult: { winningOptionId: "option-petition-bootstrap-reject" },
        } as Partial<CollectiveDecision>),
        petition: petition("Open"),
        initiativeTitle: "Clean Rivers",
        translate: t,
      });
      assert.equal(rejected.winningOption, t(SYNTHETIC_DECISION_OPTION_LABEL_KEYS.Reject ?? ""));

      const { html, errors } = decisionContext(syntheticDecision(), locale);
      assert.deepEqual(errors, [], locale);
      assert.ok(html.includes(message(locale, `${STATUS}.decision.synthetic.note`)), `${locale} note`);
      if (locale !== "en") {
        assert.ok(!html.includes(SYNTHETIC_QUESTION), `${locale} question`);
        assert.ok(!html.includes(SYNTHETIC_EXPLANATION), `${locale} explanation`);
      }
    }
  });

  it("uses the translated Initiative title when available, otherwise the stored text", () => {
    const t = translator("uk");
    const translated = petitionDecisionText({
      decision: syntheticDecision(),
      petition: petition("Open"),
      initiativeTitle: "Чисті річки",
      translate: t,
    });
    assert.match(translated.question, /«Чисті річки»/);
    const noTitle = petitionDecisionText({
      decision: syntheticDecision(),
      petition: petition("Open"),
      initiativeTitle: null,
      translate: t,
    });
    assert.equal(noTitle.question, SYNTHETIC_QUESTION);
    assert.equal(noTitle.explanation, SYNTHETIC_EXPLANATION);
    assert.equal(noTitle.winningOption, t(`${STATUS}.decision.synthetic.options.approve`));
  });

  it("F. any other decision keeps its original question, labels and explanation", () => {
    for (const locale of LOCALES) {
      const { html } = decisionContext(COMMUNITY_DECISION, locale);
      for (const text of [
        "Which river should be restored first?",
        "Northern river",
        "Most participants chose the northern river.",
      ]) {
        assert.ok(html.includes(text), `${locale} ${text}`);
      }
      assert.ok(!html.includes(message(locale, `${STATUS}.decision.synthetic.note`)), locale);
    }
  });

  it("L. never changes the decision object, option ids or values", () => {
    const decision = syntheticDecision();
    const before = structuredClone(decision);
    petitionDecisionText({
      decision,
      petition: petition("Open"),
      initiativeTitle: "Clean Rivers",
      translate: translator("ar"),
    });
    decisionContext(decision, "ar");
    assert.deepEqual(decision, before);
    assert.deepEqual(
      decision.ballot.options.map((option) => [option.optionId, option.value]),
      [
        ["option-petition-bootstrap-approve", "Approve"],
        ["option-petition-bootstrap-reject", "Reject"],
      ],
    );
  });
});

describe("HU-LC-05C.4C.7E.5B — Initiative context Content Translation", () => {
  it("G. resolves the Initiative by its own id and kind, once per Status page", () => {
    assert.equal(initiativeTranslationSourceId(PUBLIC_INITIATIVE, "Open"), INITIATIVE_ID);
    const hook = readWeb("features/petition/use-initiative-reading-text.ts");
    assert.match(hook, /sourceKind: "initiative"/);
    assert.match(hook, /sourceRecordId: initiativeTranslationSourceId\(input\.initiative, input\.petitionStatus\)/);
    assert.match(hook, /fieldOrder: \["title", "description"\]/);
    assert.doesNotMatch(hook, /generate|POST/);
    const workspace = readWeb("features/petition/components/PetitionWorkspace.tsx");
    assert.equal(workspace.match(/useInitiativeReadingText\(/g)?.length, 1);
    assert.doesNotMatch(readWeb("features/petition/components/DecisionContext.tsx"), /useHuPersistedOrdinaryFields|resolveTranslatedContent/);
  });

  it("H. missing, stale or incomplete translations fall back to the canonical text", () => {
    const canonical = { title: "Clean Rivers", description: "Restore the rivers." };
    const fields = { title: "Чисті річки", description: "Відновити річки." };
    assert.deepEqual(
      selectInitiativeReadingText({ owner: "hu-persisted", presentationMode: "localized", fields, activeLanguage: "uk" }, canonical),
      { ...fields, lang: "uk" },
    );
    for (const state of [
      { owner: "hu-persisted", presentationMode: "original", fields, activeLanguage: "uk" },
      { owner: "browser-native", presentationMode: "localized", fields, activeLanguage: "uk" },
    ] as const) {
      assert.deepEqual(selectInitiativeReadingText(state, canonical), { ...canonical, lang: undefined });
    }
    assert.deepEqual(
      selectInitiativeReadingText(
        { owner: "hu-persisted", presentationMode: "localized", fields: { title: " ", description: "" }, activeLanguage: "ar" },
        canonical,
      ),
      { ...canonical, lang: "ar" },
    );
  });

  it("I. never requests translations for non-public Initiatives or unpublished Petitions", () => {
    const variants: Array<[string, Partial<Initiative>]> = [
      ["steward-only", { visibility: { policy: "steward_only" } } as Partial<Initiative>],
      ["draft", { lifecyclePhase: "draft" } as Partial<Initiative>],
      ["transient published", { lifecyclePhase: "published" } as Partial<Initiative>],
      ["blocked", { administrativelyBlocked: true }],
    ];
    for (const [name, change] of variants) {
      assert.equal(
        initiativeTranslationSourceId({ ...PUBLIC_INITIATIVE, ...change } as Initiative, "Open"),
        "",
        name,
      );
    }
    for (const status of ["Draft", "Ready"] as const) {
      assert.equal(initiativeTranslationSourceId(PUBLIC_INITIATIVE, status), "", status);
    }
    assert.equal(initiativeTranslationSourceId(null, "Open"), "");
  });

  it("the Status page shows the localized synthetic decision with the canonical title before CT loads", () => {
    const html = renderIn(
      "uk",
      createElement(PetitionWorkspace, {
        initialPetition: petition("Open"),
        collectiveDecision: syntheticDecision(),
        initiative: PUBLIC_INITIATIVE,
        collaborativeAnalysis: null,
      }),
    ).html;
    assert.ok(html.includes("Чи має «Clean Rivers» перейти до етапу петиції?"));
    assert.ok(html.includes("Restore the rivers."));
    assert.ok(html.includes(message("uk", `${STATUS}.decision.synthetic.note`)));
  });
});

describe("HU-LC-05C.4C.7E.5B — Petition share", () => {
  it("J. the share payload carries the reading title and summary the reader sees", () => {
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(result, /const reading = usePetitionReadingText\(\{/);
    assert.match(result, /title: reading\.title,/);
    assert.match(result, /optionalText: reading\.summary \|\| undefined/);
    assert.match(result, /shareAria", \{ title: reading\.title \}/);
    assert.doesNotMatch(result, /title: petitionIdentity\.title,\s*shareUrl/);
    const payload = buildPublicPetitionSharePayload({
      initiativeId: INITIATIVE_ID,
      petitionId: PETITION_ID,
      title: "Чисті річки",
      optionalText: "Зупинити скиди.",
      origin: "https://example.org",
    });
    assert.equal(payload.title, "Чисті річки");
    assert.equal(payload.optionalText, "Зупинити скиди.");
    assert.equal(payload.petitionId, PETITION_ID);
  });

  it("K. Petitions A and B get different Petition-specific URLs", () => {
    const url = (petitionId: string, shareUrl?: string) =>
      buildPublicPetitionSharePayload({
        initiativeId: "init 1",
        petitionId,
        title: "T",
        shareUrl,
        origin: "https://example.org",
      }).url;
    const apiShareUrl = "/initiatives/public/init%201#petition";
    assert.equal(url("petition-a", apiShareUrl), "https://example.org/initiatives/public/init%201?petition=petition-a#petition");
    assert.equal(url("petition-b", apiShareUrl), "https://example.org/initiatives/public/init%201?petition=petition-b#petition");
    assert.equal(url("petition-a"), "https://example.org/initiatives/public/init%201?petition=petition-a#petition");
    assert.equal(
      url("petition-a", "/initiatives/public/init%201?ref=x#petition"),
      "https://example.org/initiatives/public/init%201?ref=x&petition=petition-a#petition",
    );
    assert.equal(
      url("petition-a", "https://other.example/initiatives/public/init%201#petition"),
      "https://other.example/initiatives/public/init%201?petition=petition-a#petition",
    );
    for (const petitionId of ["petition-a", "pet.01:x_y"]) {
      const shared = new URL(url(petitionId, apiShareUrl));
      assert.equal(readRequestedPetitionId(shared.search), petitionId);
      assert.equal(shared.hash, "#petition");
    }
  });
});

describe("HU-LC-05C.4C.7E.5B — catalogs and layout", () => {
  it("M. every new key is translated, public-reader required and ICU-compatible", () => {
    for (const key of NEW_KEYS) {
      assert.equal(isPublicReaderWebUiRequiredPath(`initiativeExperience.${key}`), true, key);
      const english = message("en", key);
      assert.ok(english.trim(), `en ${key}`);
      const args = (text: string) => [...text.matchAll(/\{(\w+)(?:,|\})/g)].map((m) => m[1]).sort();
      for (const locale of LOCALES) {
        const value = message(locale, key);
        assert.ok(value.trim(), `${locale} ${key}`);
        assert.deepEqual(args(value), args(english), `${locale} ${key} ICU args`);
        if (locale !== "en") {
          assert.notEqual(value, english, `${locale} ${key} falls back to English`);
          assert.doesNotMatch(value, /'/, `${locale} ${key}: ASCII apostrophe`);
        }
      }
      assert.match(message("ar", key), /[\u0600-\u06FF]/, `ar ${key} is Arabic`);
    }
    for (const key of ["signInGuidance", "notOpenPreparing", "notOpenPublished", "notOpenEnded"]) {
      for (const locale of LOCALES) {
        assert.ok(message(locale, `petitionSignature.${key}`).trim(), `${locale} ${key}`);
      }
    }
  });

  it("M. packaged API catalogs are byte-identical to the Web catalogs", () => {
    for (const locale of LOCALES) {
      const packaged = readFileSync(
        path.resolve(WEB_SRC, `../../api/assets/packaged-web-ui-catalogs/${locale}.json`),
        "utf8",
      );
      assert.equal(packaged, readWeb(`features/i18n/messages/${locale}.json`), locale);
    }
  });

  it("N. reuses existing classes and logical layout, so RTL/LTR and narrow screens are unaffected", () => {
    const decision = readWeb("features/petition/components/DecisionContext.tsx");
    assert.match(decision, /className="decision-context__note">\{t\(`\$\{STATUS\}\.decision\.synthetic\.note`\)\}/);
    for (const css of [
      "features/petition/components/workspace.css",
      "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css",
    ]) {
      const source = readWeb(css);
      assert.doesNotMatch(source, /text-align:\s*(left|right)|white-space:\s*nowrap|overflow-x/, css);
    }
    const ar = decisionContext(syntheticDecision(), "ar").html;
    assert.match(ar, /«Clean Rivers»/);
    assert.match(ar, /class="decision-context__note"/);
  });
});
