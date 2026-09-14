"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
  buildImprovementProposalCtFields,
  type PublicInitiativeImprovementProposalsCollectionProjection,
} from "@hu/types";

import { WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import { PublicTranslatedFields } from "../../language";
import {
  resolveProposalCurationDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { getPublicImprovementProposalsCollection } from "../api";
import { InitiativeProposalReactionWidget } from "./InitiativeProposalReactionWidget";

import "./initiative-improvement-proposals-stage-workspace.css";

interface InitiativeImprovementProposalsPublicResultProps {
  readonly collectionId: string;
  /**
   * True in Public Preview — Section 11: "editing disabled ... result
   * shown exactly as visitors will see it". The body fields render
   * identically either way; only each Reaction widget is replaced with a
   * read-only count display, so previewing can never record a real
   * reaction.
   */
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part D Public Result.
 *
 * Implementation 01 — browser-visible proposal prose is PERSISTED_LOCALIZED_CONTENT
 * via Content Translation (sourceKind improvement_proposal, Part D field bag).
 * Complete CT bag or coherent canonical — never field hybrid.
 * Labels/status remain WEB_UI. Identities remain protected.
 */
export function InitiativeImprovementProposalsPublicResult({
  collectionId,
  isPreview = false,
}: InitiativeImprovementProposalsPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<PublicInitiativeImprovementProposalsCollectionProjection | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getPublicImprovementProposalsCollection(collectionId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">{t("author.proposal.public.loadFailed")}</p>;
  }

  if (!projection) {
    return <p className="lsw-result__placeholder">{t("author.proposal.public.loading")}</p>;
  }

  if (projection.proposals.length === 0) {
    return <p className="iip-public-result__empty">{t("author.proposal.public.empty")}</p>;
  }

  return (
    <div
      className="iip-public-result"
      data-hu-localization-domain="initiative"
      data-hu-presentation-authority="persisted_localized_content"
      data-hu-structured-proposal="true"
    >
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.author")}</h4>
        <p>{projection.authorDisplayName}</p>
      </div>

      {projection.proposals.map((proposal) => {
        const fallbackFields = buildImprovementProposalCtFields(proposal);
        return (
          <article
            key={proposal.proposalId}
            className="iip-public-result__proposal"
            data-proposal-id={proposal.proposalId}
            data-hu-content-class="persisted_localized_content"
          >
            <div className="iip-proposal-card__header">
              <WorkspaceStatusBadge
                status={proposal.status}
                label={resolveProposalCurationDisplayLabel(proposal.status, t)}
              />
            </div>

            <PublicTranslatedFields
              sourceKind="improvement_proposal"
              sourceRecordId={proposal.proposalId}
              fieldOrder={[...IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS]}
              fieldLabels={{
                title: t("author.proposal.fields.title"),
                summary: t("author.proposal.fields.summary"),
                description: t("author.proposal.fields.description"),
                reason: t("author.proposal.fields.reason"),
                expectedImprovement: t("author.proposal.fields.expectedImprovement"),
                supportingSources: t("author.proposal.fields.supportingSources"),
                relatedDiscussionReferences: t(
                  "author.proposal.fields.relatedDiscussionReferences",
                ),
              }}
              fallbackFields={fallbackFields}
            />

            {proposal.originalAuthorDisplayNames.length > 0 ? (
              <div className="iip-content-fields__field" data-hu-field-ownership="protected">
                <h4>{t("author.proposal.fields.originalAuthors")}</h4>
                <p>{proposal.originalAuthorDisplayNames.join(", ")}</p>
              </div>
            ) : null}

            {isPreview ? (
              <section
                className="iip-reaction"
                aria-label={t("author.proposal.preview.reactionAria")}
              >
                <p className="iip-reaction__title">
                  {t("author.proposal.preview.reactionTitle")}
                </p>
                <p className="iip-reaction__note">
                  {t("author.proposal.preview.reactionNotePublished", {
                    support: proposal.reactionSummary.support,
                    doNotSupport: proposal.reactionSummary.doNotSupport,
                  })}
                </p>
              </section>
            ) : (
              <InitiativeProposalReactionWidget
                collectionId={collectionId}
                proposalId={proposal.proposalId}
                reactionSummary={proposal.reactionSummary}
                onReactionSummaryChange={(summary) =>
                  setProjection((current) =>
                    current
                      ? {
                          ...current,
                          proposals: current.proposals.map((entry) =>
                            entry.proposalId === proposal.proposalId
                              ? { ...entry, reactionSummary: summary }
                              : entry,
                          ),
                        }
                      : current,
                  )
                }
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
