import type { ReactNode } from "react";

import type { InitiativeLifecycleStageProjection } from "@hu/types";

/**
 * Initiative Lifecycle — Part A Completion Part 8: the public-result and
 * Upcoming boundary/slot.
 *
 * No published result and no draft to preview: renders "Not Started" with
 * concise stage-specific copy — never an empty editor,
 * Save/Generate/Preview/Publish action, or internal draft/AI status
 * (those are Author-only concepts and must never leak to a Public Mode
 * viewer, even implicitly).
 *
 * Published result: renders the stage title, publication date, version,
 * and whatever `publicResultSlot`/`participationSlot` a stage-specific
 * pack supplies. Part A supplies neither for any stage — this is the
 * reusable boundary only, per Part 8's explicit scope limit ("do not
 * implement the Collaborative Analysis public result yet").
 *
 * Draft preview (Section 7): when the Author is Previewing and has an
 * unpublished draft (`hasUnpublishedChanges`) but nothing has actually
 * been published yet, the "Not Started" boundary would defeat the entire
 * point of a pre-publish Preview action — so this still renders
 * `publicResultSlot` (a stage-specific pack's slot is expected to
 * render the current draft itself in that case; see
 * `InitiativeCollaborativeAnalysisDraftPreview`), just without a
 * publication date/version line since nothing is published yet.
 */
export function InitiativeLifecyclePublicResultPanel({
  projection,
  publicResultSlot,
  participationSlot,
  isPreview = false,
}: {
  projection: InitiativeLifecycleStageProjection;
  publicResultSlot?: ReactNode;
  participationSlot?: ReactNode;
  isPreview?: boolean;
}) {
  const hasPublicResult = projection.metadata.canViewPublicResult;
  const hasDraftToPreview = isPreview && !hasPublicResult && projection.metadata.hasUnpublishedChanges;

  if (!hasPublicResult && !hasDraftToPreview) {
    return (
      <div className="lsw-upcoming" role="status">
        <p className="lsw-upcoming__label">Not Started</p>
        <p className="lsw-upcoming__copy">
          {isPreview
            ? `Nothing has been published or drafted for ${projection.stageLabel} yet, so there is nothing to preview.`
            : `${projection.stageLabel} has not been published for this Initiative yet.`}
        </p>
      </div>
    );
  }

  if (hasDraftToPreview) {
    return (
      <div className="lsw-result" translate="yes">
        <h3 className="lsw-result__title">{projection.stageLabel}</h3>
        <p className="lsw-result__meta">Draft preview — not yet published</p>
        {publicResultSlot ?? (
          <p className="lsw-result__placeholder">
            This stage&apos;s draft-preview view is not yet implemented; a future implementation pack will
            render its content here.
          </p>
        )}
      </div>
    );
  }

  const publishedAtLabel = (() => {
    if (!projection.metadata.publishedAt) {
      return null;
    }

    try {
      return new Date(projection.metadata.publishedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return null;
    }
  })();

  return (
    <div className="lsw-result" translate="yes">
      <h3 className="lsw-result__title">{projection.stageLabel}</h3>
      <p className="lsw-result__meta">
        {[
          publishedAtLabel ? `Published ${publishedAtLabel}` : null,
          projection.metadata.version !== null ? `Version ${projection.metadata.version}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {publicResultSlot ?? (
        <p className="lsw-result__placeholder">
          This stage&apos;s published-result view is not yet implemented; a future implementation pack will
          render its content here.
        </p>
      )}
      {participationSlot ?? null}
    </div>
  );
}
