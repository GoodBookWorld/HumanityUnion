"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicInitiativeImprovementProposalsCollectionProjection } from "@hu/types";

import { WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import { resolveProposalCurationDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { getPublicImprovementProposalsCollection } from "../api";
import { InitiativeImprovementProposalsContentFields } from "./InitiativeImprovementProposalsContentFields";
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
 * Initiative Lifecycle — Part D, Section 8/9 (Public Result / Community
 * Reactions). Renders inside the shared shell's
 * `InitiativeLifecyclePublicResultPanel` boundary as its
 * `publicResultSlot` — that boundary already renders the stage title,
 * Publication Date, and Version generically; this adds the list of
 * published structured proposals, each with its own body, Author(s), and
 * Support / Do Not Support reaction, all fetched in a single request.
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
    <div className="iip-public-result">
      <div className="iip-public-result__field">
        <h4>{t("author.proposal.fields.author")}</h4>
        <p>{projection.authorDisplayName}</p>
      </div>

      {projection.proposals.map((proposal) => (
        <article key={proposal.proposalId} className="iip-public-result__proposal">
          <div className="iip-proposal-card__header">
            <h3>{proposal.title}</h3>
            <WorkspaceStatusBadge
              status={proposal.status}
              label={resolveProposalCurationDisplayLabel(proposal.status, t)}
            />
          </div>

          <InitiativeImprovementProposalsContentFields
            summary={proposal.summary}
            description={proposal.description}
            reason={proposal.reason}
            expectedImprovement={proposal.expectedImprovement}
            supportingSources={proposal.supportingSources}
            relatedDiscussionReferences={proposal.relatedDiscussionReferences}
            originalAuthorDisplayNames={proposal.originalAuthorDisplayNames}
          />

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
      ))}
    </div>
  );
}
