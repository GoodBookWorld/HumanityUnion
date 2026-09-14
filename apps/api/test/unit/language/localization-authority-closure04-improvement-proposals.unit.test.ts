/**
 * Localization Authority Closure 04 — Improvement Proposals public presentation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyControlledPublicVocabularyToProse,
  composeImprovementProposalHuSystemFields,
  lifecycleStageToken,
  presentImprovementProposalFieldsWithControlledVocabulary,
  resolveControlledLifecycleLabel,
  resolvePublicPresentationField,
  type ControlledVocabularyLabelLookup,
} from "@hu/types";

import {
  findControlledEnglishLifecycleLeaks,
  findHardcodedImprovementProposalSystemLabelLeaks,
} from "../../../../web/src/features/public-initiative-experience/assert-no-controlled-english-lifecycle-leaks.js";
import { loadWebUiControlledLifecycleStageLabel } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";
import { IMPROVEMENT_PROPOSAL_DRAFT_STAGE_TOKENS } from "../../../src/modules/initiative-improvement-proposals-stage/initiative-proposal-draft-builder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../../web");
const repoRoot = path.resolve(here, "../../../../..");

function loadProposalFieldLabels(locale: "en" | "uk" | "ar" | "zh-Hant"): Record<string, string> {
  const messages = JSON.parse(
    readFileSync(path.join(webRoot, "src/features/i18n/messages", `${locale}.json`), "utf8"),
  ) as {
    initiativeExperience: {
      author: { proposal: { fields: Record<string, string> } };
    };
  };
  return messages.initiativeExperience.author.proposal.fields;
}

function webUiLookup(locale: "uk" | "ar" | "zh-Hant"): ControlledVocabularyLabelLookup {
  const stages = [
    "initiative",
    "discussion",
    "analysis",
    "proposal",
  ] as const;
  const lookup: Record<
    string,
    {
      terminologyPreferredTerm?: string | null;
      webUiControlledLabel?: string | null;
      stageId?: string | null;
      registryCanonicalEnglishLabel?: string | null;
    }
  > = {};
  for (const stageId of stages) {
    lookup[stageId] = {
      terminologyPreferredTerm: null,
      webUiControlledLabel: loadWebUiControlledLifecycleStageLabel({
        stageId,
        locale,
      }),
      stageId,
    };
  }
  return lookup as ControlledVocabularyLabelLookup;
}

describe("Localization Authority Closure 04 — Improvement Proposals", () => {
  it("A. PublicResult uses CT PublicTranslatedFields with WEB_UI labels (Part D bag, not Cap02)", () => {
    const src = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      ),
      "utf8",
    );
    assert.match(src, /PublicTranslatedFields/);
    assert.match(src, /sourceKind=["']improvement_proposal["']/);
    assert.match(src, /IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS/);
    assert.match(src, /author\.proposal\.fields/);
    assert.doesNotMatch(src, /CivicPublicTranslatedSection/);
    assert.doesNotMatch(src, /CIVIC_TRANSLATION_FIELD_META/);
    assert.doesNotMatch(src, /proposedChange|currentIssue|rationale/);
  });

  it("B/C/D/E. uk / ar / zh-Hant field labels resolve via the same WEB_UI path", () => {
    const keys = [
      "summary",
      "description",
      "reason",
      "expectedImprovement",
      "supportingSources",
      "relatedDiscussionReferences",
      "originalAuthors",
      "author",
    ] as const;
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const fields = loadProposalFieldLabels(locale);
      const en = loadProposalFieldLabels("en");
      for (const key of keys) {
        assert.ok(fields[key]?.trim(), `${locale}.${key}`);
        assert.notEqual(fields[key], en[key], `${locale}.${key} must differ from English catalog`);
      }
    }
  });

  it("F/G. Improvement Proposals controlled stage: Terminology → WEB_UI → Registry", () => {
    const withTerm = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: "Term Proposals",
      webUiControlledLabel: "UI Proposals",
      stageId: "proposal",
      registryCanonicalEnglishLabel: "Improvement Proposals",
    });
    assert.equal(withTerm.source, "terminology_preferred_term");
    assert.equal(withTerm.label, "Term Proposals");

    const webUiOnly = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: "Пропозиції покращення",
        registryCanonicalEnglishLabel: "Improvement Proposals",
        stageId: "proposal",
      },
    });
    assert.equal(webUiOnly?.value, "Пропозиції покращення");
    assert.equal(webUiOnly?.controlledLifecycleSource, "web_ui_controlled_label");
  });

  it("H. Part D public authority is PERSISTED_LOCALIZED_CONTENT via CT (Part D bag)", () => {
    const src = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      ),
      "utf8",
    );
    assert.match(src, /data-hu-presentation-authority=["']persisted_localized_content["']/);
    assert.match(src, /PublicTranslatedFields/);
    assert.match(src, /buildImprovementProposalCtFields/);
    assert.doesNotMatch(src, /mixed_manual_author_and_web_ui/);
    assert.doesNotMatch(src, /proposedChange|currentIssue|rationale/);
  });

  it("I. Participant-authored Part D values remain MANUAL_AUTHOR (no Cap02 CT owner)", () => {
    const contentFields = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsContentFields.tsx",
      ),
      "utf8",
    );
    assert.match(contentFields, /MANUAL_AUTHOR|manual_author|no Cap02/i);
    assert.doesNotMatch(contentFields, /sourceKind/);
    assert.doesNotMatch(contentFields, /PublicTranslatedFields/);
  });

  it("J. System/template expectedImprovement is WEB_UI placeholder, not embedded English prose", () => {
    const builder = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/initiative-improvement-proposals-stage/initiative-proposal-draft-builder.ts",
      ),
      "utf8",
    );
    assert.match(builder, /expectedImprovement:\s*""/);
    assert.doesNotMatch(
      builder,
      /Describe the concrete improvement this change is expected to deliver for the Initiative/,
    );
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const fields = loadProposalFieldLabels(locale);
      assert.ok(fields.expectedImprovementPlaceholder?.trim(), locale);
    }
  });

  it("K. Controlled lifecycle terms in proposal presentation are corrected by CV safety", () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const lookup = webUiLookup(locale);
      const presented = presentImprovementProposalFieldsWithControlledVocabulary({
        fields: {
          title: `${lifecycleStageToken("proposal")}: Garden`,
          reason: `Raised in ${lifecycleStageToken("discussion")}.`,
          description: "Improvement Proposals were discussed in Discussion.",
        },
        labelLookup: lookup,
      });
      const proposalLabel = loadWebUiControlledLifecycleStageLabel({
        stageId: "proposal",
        locale,
      });
      const discussionLabel = loadWebUiControlledLifecycleStageLabel({
        stageId: "discussion",
        locale,
      });
      assert.ok(proposalLabel);
      assert.ok(discussionLabel);
      assert.match(presented.title, new RegExp(proposalLabel!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(presented.title, /\{lifecycleStage:/);
      assert.doesNotMatch(presented.description, /Improvement Proposals/);
      assert.doesNotMatch(presented.description, /\bDiscussion\b/);
      assert.doesNotMatch(presented.reason, /\{lifecycleStage:/);
    }
  });

  it("L. English locale remains canonical (PublicTranslatedFields + ContentFields skip CV when en)", () => {
    const translated = readFileSync(
      path.join(
        webRoot,
        "src/features/language/components/PublicTranslatedFields.tsx",
      ),
      "utf8",
    );
    const fields = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsContentFields.tsx",
      ),
      "utf8",
    );
    assert.match(translated, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(fields, /DEFAULT_PLATFORM_LANGUAGE/);
  });

  it("M/N. No provider-on-read and no localization writes on Part D public path", () => {
    for (const rel of [
      "apps/web/src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      "apps/web/src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsContentFields.tsx",
      "packages/types/src/domain/present-controlled-improvement-proposals.ts",
    ]) {
      const src = readFileSync(path.join(repoRoot, rel), "utf8");
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /\/translations\/generate/);
      assert.doesNotMatch(src, /\binsertOne\b|\bupdateOne\b|\benqueueContentTranslation/);
    }
  });

  it("O. Author editor still presents English Registry labels and preserves tokens on unchanged save", () => {
    const card = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeStructuredProposalCard.tsx",
      ),
      "utf8",
    );
    const author = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/improvement-proposal-author-presentation.ts",
      ),
      "utf8",
    );
    assert.match(card, /presentImprovementProposalForAuthorEditor/);
    assert.match(card, /buildImprovementProposalAuthorSaveInput/);
    assert.match(author, /presentLifecycleStageTokensAsEnglish/);
    assert.match(author, /preserveLifecycleStageTokensWhenPresentationUnchanged/);
  });

  it("deterministic draft builder embeds lifecycle stage tokens, not raw Discussion English", () => {
    assert.equal(
      IMPROVEMENT_PROPOSAL_DRAFT_STAGE_TOKENS.discussion,
      lifecycleStageToken("discussion"),
    );
    const builder = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/initiative-improvement-proposals-stage/initiative-proposal-draft-builder.ts",
      ),
      "utf8",
    );
    assert.match(builder, /lifecycleStageToken\("discussion"\)/);
    assert.match(builder, /lifecycleStageToken\("proposal"\)/);
    assert.doesNotMatch(builder, /times in Discussion/);
  });

  it("leakage gate: Cap02 English headings + controlled English fail for non-en", () => {
    const lookup = webUiLookup("uk");
    const controlled = findControlledEnglishLifecycleLeaks({
      presentationText: "Improvement Proposals remain English",
      documentLocale: "uk",
      labelLookup: lookup,
    });
    assert.ok(controlled.some((row) => row.conceptId === "proposal"));

    const system = findHardcodedImprovementProposalSystemLabelLeaks({
      presentationText: "Proposed change\nCurrent issue\nRationale",
      documentLocale: "uk",
    });
    assert.ok(system.length >= 3);

    const cleanPresented = presentImprovementProposalFieldsWithControlledVocabulary({
      fields: {
        title: "Improvement Proposals: X",
        reason: "See Discussion.",
      },
      labelLookup: lookup,
    });
    const labels = loadProposalFieldLabels("uk");
    const presentationText = [
      labels.summary,
      labels.description,
      labels.reason,
      cleanPresented.title,
      cleanPresented.reason,
    ].join("\n");
    assert.equal(
      findHardcodedImprovementProposalSystemLabelLeaks({
        presentationText,
        documentLocale: "uk",
      }).length,
      0,
    );
    assert.equal(
      findControlledEnglishLifecycleLeaks({
        presentationText,
        documentLocale: "uk",
        labelLookup: lookup,
      }).length,
      0,
    );
  });

  it("R. participant-authored arbitrary English prose is not globally rewritten", () => {
    const lookup = webUiLookup("uk");
    const applied = applyControlledPublicVocabularyToProse({
      prose: "Add a composting station near the entrance ramp.",
      labelLookup: lookup,
    });
    assert.equal(applied.text, "Add a composting station near the entrance ramp.");
    assert.equal(applied.substitutions.length, 0);
  });

  it("S. untouched HU system frames are not MANUAL_AUTHOR; participant prose remains MANUAL_AUTHOR", () => {
    const builder = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/initiative-improvement-proposals-stage/initiative-proposal-draft-builder.ts",
      ),
      "utf8",
    );
    assert.match(builder, /huSystemGeneration/);
    assert.match(builder, /reason:\s*""/);
    assert.match(builder, /supportingSources:\s*""/);
    assert.doesNotMatch(builder, /reason:\s*`This idea was raised/);
    assert.doesNotMatch(builder, /description:\s*`This idea was raised/);

    const contentFields = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsContentFields.tsx",
      ),
      "utf8",
    );
    assert.match(contentFields, /hu_system_web_ui/);
    assert.match(contentFields, /composeImprovementProposalHuSystemFields/);
    assert.doesNotMatch(contentFields, /PublicTranslatedFields/);
    assert.doesNotMatch(contentFields, /TranslationProvider/);

    const composed = composeImprovementProposalHuSystemFields({
      generation: {
        descriptionKind: "raised_times",
        raisedCount: 2,
        reasonKind: "raised_independently",
        participantCount: 3,
        category: "process",
        discussionStageToken: lifecycleStageToken("discussion"),
        helpfulCount: 4,
        memberCount: 3,
        supportingSourcesKind: "helpful_reactions",
      },
      descriptionExcerpts: "Participant said compost bins.",
      t: (key) => `WEB_UI:${key}`,
      labelLookup: webUiLookup("uk"),
    });
    assert.match(composed.reason, /^WEB_UI:/);
    assert.doesNotMatch(composed.reason, /Raised independently by/);
    assert.match(composed.description, /Participant said compost bins/);
  });

  it("T. Draft Preview and Public share huSystemGeneration presentation authority", () => {
    const preview = readFileSync(
      path.join(
        webRoot,
        "src/features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsDraftPreview.tsx",
      ),
      "utf8",
    );
    assert.match(preview, /huSystemGeneration=\{proposal\.huSystemGeneration/);
  });
});
