/**
 * Localization Authority Closure 04 repair — compose HU system proposal
 * frames via WEB_UI. Participant excerpts stay MANUAL_AUTHOR.
 */

import type { ImprovementProposalHuSystemGeneration } from "./initiative-improvement-proposals-stage.js";
import {
  applyControlledPublicVocabularyToProse,
  type ControlledVocabularyLabelLookup,
} from "./controlled-public-vocabulary.js";

type ProposalTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
};

/**
 * Compose reason / supportingSources / description chrome from structured
 * HU generation facts. Never returns English glue templates.
 */
export function composeImprovementProposalHuSystemFields(input: {
  readonly generation: ImprovementProposalHuSystemGeneration;
  readonly descriptionExcerpts: string;
  readonly t: ProposalTranslator;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): {
  readonly description: string;
  readonly reason: string;
  readonly supportingSources: string;
} {
  const stageLabel = applyControlledPublicVocabularyToProse({
    prose: input.generation.discussionStageToken,
    labelLookup: input.labelLookup,
  }).text;

  const description =
    input.generation.descriptionKind === "raised_times"
      ? `${input.t("author.proposal.generated.raisedTimesIntro", {
          count: input.generation.raisedCount,
          stage: stageLabel,
        })}\n${input.descriptionExcerpts}`
      : input.descriptionExcerpts;

  const reason =
    input.generation.reasonKind === "raised_independently"
      ? input.t("author.proposal.generated.reasonRaisedIndependently", {
          count: input.generation.participantCount,
          category: input.generation.category,
          stage: stageLabel,
        })
      : input.t("author.proposal.generated.reasonRaisedBy", {
          count: input.generation.participantCount,
          category: input.generation.category,
          stage: stageLabel,
        });

  const supportingSources =
    input.generation.supportingSourcesKind === "helpful_reactions"
      ? input.t("author.proposal.generated.supportingHelpful", {
          helpful: input.generation.helpfulCount,
          members: input.generation.memberCount,
          stage: stageLabel,
        })
      : input.t("author.proposal.generated.supportingRelated", {
          members: input.generation.memberCount,
          stage: stageLabel,
        });

  return { description, reason, supportingSources };
}

/**
 * Apply Closure 02 controlled vocabulary substitution to MANUAL_AUTHOR /
 * participant field bags (summary, excerpts, author-edited free text).
 */
export function presentImprovementProposalFieldsWithControlledVocabulary(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.fields)) {
    if (typeof value !== "string") {
      continue;
    }
    if (!value.trim()) {
      out[key] = value;
      continue;
    }
    out[key] = applyControlledPublicVocabularyToProse({
      prose: value,
      labelLookup: input.labelLookup,
    }).text;
  }
  return out;
}
