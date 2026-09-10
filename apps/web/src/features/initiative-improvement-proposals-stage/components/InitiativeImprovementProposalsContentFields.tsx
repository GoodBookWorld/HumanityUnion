"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  composeImprovementProposalHuSystemFields,
  DEFAULT_PLATFORM_LANGUAGE,
  presentImprovementProposalFieldsWithControlledVocabulary,
  type ImprovementProposalHuSystemGeneration,
} from "@hu/types";

import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { buildInitiativeControlledVocabularyLabelLookup } from "../../public-initiative-experience/build-initiative-controlled-vocabulary-label-lookup";

/**
 * Initiative Lifecycle — Part D, Sections 8/11. The read-only body of one
 * structured proposal.
 *
 * Ownership split (localization repair):
 * - summary / participant excerpts / author-edited free text → MANUAL_AUTHOR
 * - HU deterministic frames (reason / supportingSources / raised-times chrome)
 *   → WEB_UI via `huSystemGeneration` structured facts
 * - lifecycle stage tokens in titles → controlled vocabulary
 */
export function InitiativeImprovementProposalsContentFields({
  summary,
  description,
  reason,
  expectedImprovement,
  supportingSources,
  relatedDiscussionReferences,
  originalAuthorDisplayNames,
  huSystemGeneration = null,
}: {
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
  readonly huSystemGeneration?: ImprovementProposalHuSystemGeneration | null;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const labelLookup = useMemo(
    () =>
      buildInitiativeControlledVocabularyLabelLookup({
        tInitiativeExperience: t,
      }),
    [t],
  );

  const presented = useMemo(() => {
    let descriptionOut = description;
    let reasonOut = reason;
    let supportingOut = supportingSources;

    if (huSystemGeneration) {
      const composed = composeImprovementProposalHuSystemFields({
        generation: huSystemGeneration,
        descriptionExcerpts: description,
        t: (key, values) => t(key, values),
        labelLookup,
      });
      descriptionOut = composed.description;
      // Author-edited free text wins over system frame.
      reasonOut = reason.trim() ? reason : composed.reason;
      supportingOut = supportingSources.trim()
        ? supportingSources
        : composed.supportingSources;
    }

    const bag = {
      summary,
      description: descriptionOut,
      reason: reasonOut,
      expectedImprovement,
      supportingSources: supportingOut,
      relatedDiscussionReferences,
    };

    // English remains canonical for MANUAL_AUTHOR bags — skip CV rewrite.
    if (displayLanguage === DEFAULT_PLATFORM_LANGUAGE) {
      return bag;
    }

    // CV only for MANUAL_AUTHOR / token-bearing fields — system WEB_UI frames
    // are already locale-correct and must not be English-glued.
    if (huSystemGeneration && !reason.trim() && !supportingSources.trim()) {
      const summaryCv = presentImprovementProposalFieldsWithControlledVocabulary({
        fields: { summary },
        labelLookup,
      });
      const descriptionCv = presentImprovementProposalFieldsWithControlledVocabulary({
        fields: { description: descriptionOut },
        labelLookup,
      });
      const expectedCv = presentImprovementProposalFieldsWithControlledVocabulary({
        fields: { expectedImprovement },
        labelLookup,
      });
      return {
        ...bag,
        summary: summaryCv.summary ?? summary,
        description: descriptionCv.description ?? descriptionOut,
        expectedImprovement: expectedCv.expectedImprovement ?? expectedImprovement,
        relatedDiscussionReferences,
      };
    }

    const localized = presentImprovementProposalFieldsWithControlledVocabulary({
      fields: bag,
      labelLookup,
    });
    return {
      summary: localized.summary ?? bag.summary,
      description: localized.description ?? bag.description,
      reason: localized.reason ?? bag.reason,
      expectedImprovement: localized.expectedImprovement ?? bag.expectedImprovement,
      supportingSources: localized.supportingSources ?? bag.supportingSources,
      relatedDiscussionReferences:
        localized.relatedDiscussionReferences ?? bag.relatedDiscussionReferences,
    };
  }, [
    summary,
    description,
    reason,
    expectedImprovement,
    supportingSources,
    relatedDiscussionReferences,
    huSystemGeneration,
    labelLookup,
    t,
    displayLanguage,
  ]);

  return (
    <div className="iip-content-fields">
      {presented.summary.trim() ? (
        <div className="iip-content-fields__field" data-hu-field-ownership="manual_author">
          <h4>{t("author.proposal.fields.summary")}</h4>
          <p>{presented.summary}</p>
        </div>
      ) : null}
      {presented.description.trim() ? (
        <div
          className="iip-content-fields__field"
          data-hu-field-ownership={
            huSystemGeneration?.descriptionKind === "raised_times"
              ? "hu_system_web_ui"
              : "manual_author"
          }
        >
          <h4>{t("author.proposal.fields.description")}</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{presented.description}</p>
        </div>
      ) : null}
      {presented.reason.trim() ? (
        <div
          className="iip-content-fields__field"
          data-hu-field-ownership={
            huSystemGeneration && !reason.trim() ? "hu_system_web_ui" : "manual_author"
          }
        >
          <h4>{t("author.proposal.fields.reason")}</h4>
          <p>{presented.reason}</p>
        </div>
      ) : null}
      {presented.expectedImprovement.trim() ? (
        <div className="iip-content-fields__field" data-hu-field-ownership="manual_author">
          <h4>{t("author.proposal.fields.expectedImprovement")}</h4>
          <p>{presented.expectedImprovement}</p>
        </div>
      ) : null}
      {presented.supportingSources.trim() ? (
        <div
          className="iip-content-fields__field"
          data-hu-field-ownership={
            huSystemGeneration && !supportingSources.trim()
              ? "hu_system_web_ui"
              : "manual_author"
          }
        >
          <h4>{t("author.proposal.fields.supportingSources")}</h4>
          <p>{presented.supportingSources}</p>
        </div>
      ) : null}
      {relatedDiscussionReferences.trim() ? (
        <div className="iip-content-fields__field" data-hu-field-ownership="manual_author">
          <h4>{t("author.proposal.fields.relatedDiscussionReferences")}</h4>
          <p>{relatedDiscussionReferences}</p>
        </div>
      ) : null}
      {originalAuthorDisplayNames.length > 0 ? (
        <div className="iip-content-fields__field" data-hu-field-ownership="manual_author">
          <h4>{t("author.proposal.fields.originalAuthors")}</h4>
          <p>{originalAuthorDisplayNames.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}
