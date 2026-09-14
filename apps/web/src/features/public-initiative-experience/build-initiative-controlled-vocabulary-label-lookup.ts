/**
 * Localization Authority Closure 03 — build controlled-vocabulary label lookup
 * from Initiative Experience WEB_UI messages (next-intl translator).
 */

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  type ControlledVocabularyLabelLookup,
  type InitiativeLifecycleStageId,
} from "@hu/types";

type StageTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
};

/**
 * Build Closure 02 labelLookup for CA/Initiative controlled concepts from WEB_UI.
 * Terminology preferredTerms are optional overlays when the caller has them.
 */
export function buildInitiativeControlledVocabularyLabelLookup(input: {
  readonly tInitiativeExperience: StageTranslator;
  readonly terminologyPreferredTerms?: Readonly<
    Partial<Record<string, string | null | undefined>>
  >;
}): ControlledVocabularyLabelLookup {
  const lookup: Record<string, {
    terminologyPreferredTerm?: string | null;
    webUiControlledLabel?: string | null;
    stageId?: InitiativeLifecycleStageId | null;
    registryCanonicalEnglishLabel?: string | null;
  }> = {};

  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const terminology =
      input.terminologyPreferredTerms?.[entry.conceptId] ?? null;
    let webUi: string | null = null;
    if (entry.stageId) {
      try {
        const label = input.tInitiativeExperience(`stages.${entry.stageId}`);
        if (
          typeof label === "string" &&
          label.trim() &&
          !label.startsWith("stages.")
        ) {
          webUi = label.trim();
        }
      } catch {
        webUi = null;
      }
    } else if (entry.conceptId === "ready_to_collaborate") {
      try {
        const label = input.tInitiativeExperience(
          "collaboration.discussion.chrome.readyToCollaborate",
        );
        if (
          typeof label === "string" &&
          label.trim() &&
          !label.includes("collaboration.discussion")
        ) {
          webUi = label.trim();
        }
      } catch {
        webUi = null;
      }
    } else if (entry.conceptId === "helpful") {
      try {
        const label = input.tInitiativeExperience(
          "collaboration.discussion.chrome.helpful",
        );
        if (typeof label === "string" && label.trim() && !label.includes("chrome.")) {
          webUi = label.trim();
        }
      } catch {
        webUi = null;
      }
    } else if (entry.conceptId === "not_helpful") {
      try {
        const label = input.tInitiativeExperience(
          "collaboration.discussion.chrome.notHelpful",
        );
        if (typeof label === "string" && label.trim() && !label.includes("chrome.")) {
          webUi = label.trim();
        }
      } catch {
        webUi = null;
      }
    } else if (entry.conceptId === "active_allies") {
      try {
        const label = input.tInitiativeExperience("author.analysis.sourceSnapshot.activeAllies");
        if (typeof label === "string" && label.trim() && !label.includes("sourceSnapshot.")) {
          webUi = label.trim();
        }
      } catch {
        webUi = null;
      }
    }

    lookup[entry.conceptId] = {
      terminologyPreferredTerm: terminology,
      webUiControlledLabel: webUi,
      stageId: entry.stageId ?? null,
      registryCanonicalEnglishLabel: entry.canonicalEnglishForms[0] ?? null,
    };
  }

  return lookup as ControlledVocabularyLabelLookup;
}
