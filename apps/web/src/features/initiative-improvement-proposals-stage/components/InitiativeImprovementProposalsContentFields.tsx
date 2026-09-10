"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  DEFAULT_PLATFORM_LANGUAGE,
  presentImprovementProposalFieldsWithControlledVocabulary,
} from "@hu/types";

import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { buildInitiativeControlledVocabularyLabelLookup } from "../../public-initiative-experience/build-initiative-controlled-vocabulary-label-lookup";

/**
 * Initiative Lifecycle — Part D, Sections 8/11. The read-only body of one
 * structured proposal — Summary, Description, Reason, Expected
 * Improvement, Supporting Sources, Related Discussion References,
 * Original Author(s).
 *
 * Shared by `InitiativeImprovementProposalsPublicResult` (genuinely
 * published proposals, Section 8) and
 * `InitiativeImprovementProposalsDraftPreview` (Public Preview of the
 * Author's current unpublished draft, Section 11 — "Preview uses the same
 * renderer as Public ... no duplicate renderer") so both render the
 * identical field layout from a single implementation.
 *
 * Closure 04 — field headings are WEB_UI (`author.proposal.fields.*`).
 * Body values are MANUAL_AUTHOR / HU-owned canonical content (no Cap02 CT).
 * Cache-only controlled vocabulary substitutes known lifecycle terms for
 * non-English locales without provider calls or storage writes.
 */
export function InitiativeImprovementProposalsContentFields({
  summary,
  description,
  reason,
  expectedImprovement,
  supportingSources,
  relatedDiscussionReferences,
  originalAuthorDisplayNames,
}: {
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
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
    const bag = {
      summary,
      description,
      reason,
      expectedImprovement,
      supportingSources,
      relatedDiscussionReferences,
    };
    if (displayLanguage === DEFAULT_PLATFORM_LANGUAGE) {
      return bag;
    }
    return presentImprovementProposalFieldsWithControlledVocabulary({
      fields: bag,
      labelLookup,
    });
  }, [
    summary,
    description,
    reason,
    expectedImprovement,
    supportingSources,
    relatedDiscussionReferences,
    displayLanguage,
    labelLookup,
  ]);

  return (
    <>
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.summary")}</h4>
        <p>{presented.summary}</p>
      </div>
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.description")}</h4>
        <p>{presented.description}</p>
      </div>
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.reason")}</h4>
        <p>{presented.reason}</p>
      </div>
      {presented.expectedImprovement.trim() ? (
        <div className="iip-public-result__field">
          <h4>{t("author.proposal.fields.expectedImprovement")}</h4>
          <p>{presented.expectedImprovement}</p>
        </div>
      ) : null}
      {presented.supportingSources.trim() ? (
        <div className="iip-public-result__field">
          <h4>{t("author.proposal.fields.supportingSources")}</h4>
          <p>{presented.supportingSources}</p>
        </div>
      ) : null}
      {relatedDiscussionReferences.trim() ? (
        <div className="iip-public-result__field">
          <h4>{t("author.proposal.fields.relatedDiscussionReferences")}</h4>
          <p>{relatedDiscussionReferences}</p>
        </div>
      ) : null}
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.originalAuthors")}</h4>
        <p>
          {originalAuthorDisplayNames.length > 0
            ? originalAuthorDisplayNames.join(", ")
            : t("author.proposal.authorOriginatedNoSource")}
        </p>
      </div>
    </>
  );
}
