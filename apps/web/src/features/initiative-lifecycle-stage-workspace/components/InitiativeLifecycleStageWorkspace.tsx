"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { InitiativeLifecycleProfile, InitiativeLifecycleStageProjection } from "@hu/types";
import {
  getInitiativeLifecycleProfilePresentation,
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
} from "@hu/types";

import {
  WorkspaceButton,
  WorkspaceStatusBadge,
} from "../../initiative-workspace-ux";
import {
  resolveLifecycleStageDisplayLabel,
  resolvePresentationStatusDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { getInitiativeLifecycleStageProjection } from "../api";
import { InitiativeLifecycleSourceSnapshotPanel } from "./InitiativeLifecycleSourceSnapshotPanel";
import { InitiativeLifecyclePublicResultPanel } from "./InitiativeLifecyclePublicResultPanel";

import "../initiative-lifecycle-stage-workspace.css";

/**
 * Initiative Lifecycle — Part B. `publicResultSlot`/`participationSlot`
 * often need data this shell already fetched for its own header (e.g.
 * `metadata.publishedRecordId`) — a stage-specific pack would otherwise
 * have to re-fetch the same projection itself (Part 13's "no duplicated
 * queries" rule) just to learn which record ID to render. Accepting
 * either a plain `ReactNode` (Part A's original shape, still valid for
 * slots that need no projection data) or a function of the projection
 * keeps both usages working without a breaking change.
 */
export type InitiativeLifecycleStageSlot =
  | ReactNode
  | ((projection: InitiativeLifecycleStageProjection) => ReactNode);

function renderStageSlot(
  slot: InitiativeLifecycleStageSlot | undefined,
  projection: InitiativeLifecycleStageProjection,
): ReactNode {
  return typeof slot === "function" ? slot(projection) : slot;
}

/**
 * Initiative Lifecycle — Part A Completion Part 5: the reusable
 * `InitiativeLifecycleStageWorkspace` shell.
 *
 * Pack 02G 08D.2 — shared chrome via initiativeExperience.author.shared;
 * stage editors remain stage-pack owned.
 */
export interface InitiativeLifecycleStageWorkspaceProps {
  readonly initiativeId: string;
  readonly stageId: string;
  /** Called with (stageId, hash) when Previous/Next/Return navigation is used — mirrors `PublicInitiativeExperiencePage#handleStageSelect`. */
  readonly onNavigateStage: (stageId: string, hash: string) => void;
  /** `/initiatives/{id}` (no hash) — "Return to Initiative" always lands on the Initiative stage. */
  readonly returnToInitiativeHref: string;
  /** Part 6 extension seam — a stage-specific pack's real domain editor. Author Workspace only. Undefined in Part A for every stage. */
  readonly authorEditorSlot?: ReactNode;
  /** Part 8 extension seam — a stage-specific pack's real published-result component. Public Mode only. Undefined in Part A for every stage. */
  readonly publicResultSlot?: InitiativeLifecycleStageSlot;
  /** Part 8 extension seam — a stage-specific public participation action (sign, vote, etc.). Undefined in Part A. */
  readonly participationSlot?: InitiativeLifecycleStageSlot;
  /**
   * Part 9 — controlled Public Preview state, lifted to the parent page so
   * the Author working sidebar's "Public Preview" button (a separate
   * component instance) and this shell's own footer toggle stay in sync
   * instead of drifting into two independent local states.
   */
  readonly isPreviewMode?: boolean;
  readonly onTogglePreview?: () => void;
  /** Public Choice Experience Pack 01 — hide STANDARD ordinals for PUBLIC_CHOICE. */
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

function formatTimestamp(locale: string, value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function StageHeader({
  projection,
  isPreviewMode,
  showStageOrdinal,
}: {
  projection: InitiativeLifecycleStageProjection;
  isPreviewMode: boolean;
  showStageOrdinal: boolean;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const stageLabel = resolveLifecycleStageDisplayLabel(
    projection.stageId,
    t,
    projection.stageLabel,
  );
  const statusLabel = resolvePresentationStatusDisplayLabel(
    projection.metadata.presentationStatus,
    t,
  );
  const publishedAtLabel = formatTimestamp(locale, projection.metadata.publishedAt);
  const draftUpdatedAtLabel = formatTimestamp(locale, projection.metadata.draftUpdatedAt);

  return (
    <header className="lsw-header">
      <div className="lsw-header__top">
        {showStageOrdinal ? (
          <p className="lsw-header__order" aria-hidden="true">
            {t("author.shared.stageOf", {
              current: projection.stageOrder + 1,
              total: INITIATIVE_LIFECYCLE_STAGE_REGISTRY.length,
            })}
          </p>
        ) : null}
        <h2 id={`lsw-stage-title-${projection.stageId}`} className="lsw-header__title">
          {stageLabel}
        </h2>
        <div className="lsw-header__badges">
          <WorkspaceStatusBadge
            status={projection.metadata.presentationStatus}
            label={statusLabel}
          />
          {projection.metadata.version !== null ? (
            <span className="lsw-header__version">
              {t("common.versionN", { version: projection.metadata.version })}
            </span>
          ) : null}
          {isPreviewMode ? (
            <span className="lsw-header__preview-flag">{t("author.shared.publicPreview")}</span>
          ) : null}
        </div>
      </div>
      <p className="lsw-header__mode" aria-live="polite">
        {isPreviewMode
          ? projection.metadata.canViewPublicResult || projection.metadata.hasUnpublishedChanges
            ? t("author.shared.modePreviewing")
            : t("author.shared.modePreviewingNothingPublished")
          : projection.presentationMode === "author_workspace"
            ? t("author.shared.modeAuthorWorkspace")
            : t("author.shared.modePublicView")}
      </p>
      {publishedAtLabel ? (
        <p className="lsw-header__timestamp">
          {t("author.shared.publishedAt", { date: publishedAtLabel })}
        </p>
      ) : draftUpdatedAtLabel ? (
        <p className="lsw-header__timestamp">
          {t("author.shared.lastUpdated", { date: draftUpdatedAtLabel })}
        </p>
      ) : null}
    </header>
  );
}

function AuthorDraftEmptyState({ stageId, fallbackLabel }: { stageId: string; fallbackLabel: string }) {
  const t = useTranslations("initiativeExperience");
  const stageLabel = resolveLifecycleStageDisplayLabel(stageId, t, fallbackLabel);

  return (
    <div className="lsw-empty">
      <h3 className="lsw-empty__title">{t("author.shared.noDraftYet")}</h3>
      <p className="lsw-empty__explanation">
        {t("author.shared.noDraftYetExplanation", { stage: stageLabel })}
      </p>
    </div>
  );
}

function AuthorWorkspaceMainContent({
  projection,
  authorEditorSlot,
  publicResultSlot,
  participationSlot,
  isPreviewMode,
}: {
  projection: InitiativeLifecycleStageProjection;
  authorEditorSlot?: ReactNode;
  publicResultSlot?: InitiativeLifecycleStageSlot;
  participationSlot?: InitiativeLifecycleStageSlot;
  isPreviewMode: boolean;
}) {
  if (isPreviewMode) {
    return (
      <InitiativeLifecyclePublicResultPanel
        projection={projection}
        publicResultSlot={renderStageSlot(publicResultSlot, projection)}
        participationSlot={renderStageSlot(participationSlot, projection)}
        isPreview
      />
    );
  }

  return (
    <div className="lsw-main">
      <InitiativeLifecycleSourceSnapshotPanel snapshot={projection.sourceSnapshot} />
      {authorEditorSlot ?? (
        <AuthorDraftEmptyState stageId={projection.stageId} fallbackLabel={projection.stageLabel} />
      )}
    </div>
  );
}

function StageFooterNav({
  projection,
  onNavigateStage,
  returnToInitiativeHref,
  isAuthorWorkspace,
  isPreviewMode,
  onTogglePreview,
}: {
  projection: InitiativeLifecycleStageProjection;
  onNavigateStage: (stageId: string, hash: string) => void;
  returnToInitiativeHref: string;
  isAuthorWorkspace: boolean;
  isPreviewMode: boolean;
  onTogglePreview: () => void;
}) {
  const t = useTranslations("initiativeExperience");
  const previousLabel = projection.previousStage
    ? resolveLifecycleStageDisplayLabel(
        projection.previousStage.stageId,
        t,
        projection.previousStage.label,
      )
    : null;
  const nextLabel = projection.nextStage
    ? resolveLifecycleStageDisplayLabel(
        projection.nextStage.stageId,
        t,
        projection.nextStage.label,
      )
    : null;

  return (
    <footer className="lsw-footer" aria-label={t("author.shared.stageNavigationAria")}>
      <div className="lsw-footer__nav">
        {projection.previousStage && previousLabel ? (
          <WorkspaceButton
            variant="secondary"
            onClick={() =>
              onNavigateStage(projection.previousStage!.stageId, projection.previousStage!.hash)
            }
          >
            {t("author.shared.previousStage", { stage: previousLabel })}
          </WorkspaceButton>
        ) : null}
        <Link href={returnToInitiativeHref} className="lsw-footer__return">
          {t("author.shared.returnToInitiative")}
        </Link>
        {projection.nextStage && nextLabel ? (
          <WorkspaceButton
            variant="secondary"
            disabled={
              /**
               * Lifecycle UX Completion Pack 02 Part 6 — Next Stage unlocks
               * only after the current stage has a published public result
               * (Initiative record stage is always considered available).
               */
              projection.stageId !== "initiative" &&
              !projection.metadata.canViewPublicResult &&
              projection.metadata.presentationStatus !== "published"
            }
            onClick={() => onNavigateStage(projection.nextStage!.stageId, projection.nextStage!.hash)}
          >
            {t("author.shared.nextStage", { stage: nextLabel })}
          </WorkspaceButton>
        ) : null}
      </div>
      {isAuthorWorkspace ? (
        <WorkspaceButton variant="primary" onClick={onTogglePreview}>
          {isPreviewMode ? t("author.shared.returnToEditing") : t("author.shared.publicPreview")}
        </WorkspaceButton>
      ) : null}
    </footer>
  );
}

export function InitiativeLifecycleStageWorkspace({
  initiativeId,
  stageId,
  onNavigateStage,
  returnToInitiativeHref,
  authorEditorSlot,
  publicResultSlot,
  participationSlot,
  isPreviewMode: controlledIsPreviewMode,
  onTogglePreview,
  lifecycleProfile,
}: InitiativeLifecycleStageWorkspaceProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<InitiativeLifecycleStageProjection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [localIsPreviewMode, setLocalIsPreviewMode] = useState(false);
  const isPreviewMode = controlledIsPreviewMode ?? localIsPreviewMode;
  const showStageOrdinal =
    getInitiativeLifecycleProfilePresentation(lifecycleProfile).showLifecycleStageOrdinal;

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);
    setLocalIsPreviewMode(false);

    getInitiativeLifecycleStageProjection(initiativeId, stageId)
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
  }, [initiativeId, stageId]);

  /**
   * Initiative Lifecycle — Part B. The Author's editor actions
   * (Generate/Save Draft/Publish) mutate the domain record directly
   * through `authorEditorSlot`'s own self-fetch (e.g.
   * `InitiativeCollaborativeAnalysisAuthorWorkspace`), not through this
   * shell — so this shell's own `projection` (in particular
   * `metadata.hasUnpublishedChanges`/`publishedRecordId`, which gate
   * what Preview and the published-result boundary render) would
   * otherwise stay stale from whatever it was at the initial mount
   * fetch. Refetching on every transition into Preview guarantees
   * Preview always reflects the Author's latest saved draft/publish
   * state, without requiring a full page reload.
   */
  useEffect(() => {
    if (!isPreviewMode) {
      return;
    }

    let cancelled = false;

    getInitiativeLifecycleStageProjection(initiativeId, stageId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        // Keep showing the last successfully loaded projection rather than
        // replacing a working Preview with an error on a transient failure.
      });

    return () => {
      cancelled = true;
    };
  }, [isPreviewMode, initiativeId, stageId]);

  const handleTogglePreview = useCallback(() => {
    if (onTogglePreview) {
      onTogglePreview();
      return;
    }

    setLocalIsPreviewMode((current) => !current);
  }, [onTogglePreview]);

  if (loadFailed) {
    return <p className="lsw-error">{t("author.shared.stageLoadFailed")}</p>;
  }

  if (!projection) {
    return <p className="lsw-loading">{t("author.shared.loadingStage")}</p>;
  }

  const isAuthorWorkspace = projection.presentationMode === "author_workspace";

  return (
    <section
      className="lsw"
      aria-labelledby={`lsw-stage-title-${projection.stageId}`}
      data-presentation-mode={isPreviewMode ? "public_preview" : projection.presentationMode}
    >
      <StageHeader
        projection={projection}
        isPreviewMode={isPreviewMode}
        showStageOrdinal={showStageOrdinal}
      />

      {isAuthorWorkspace ? (
        <AuthorWorkspaceMainContent
          projection={projection}
          authorEditorSlot={authorEditorSlot}
          publicResultSlot={publicResultSlot}
          participationSlot={participationSlot}
          isPreviewMode={isPreviewMode}
        />
      ) : (
        <InitiativeLifecyclePublicResultPanel
          projection={projection}
          publicResultSlot={renderStageSlot(publicResultSlot, projection)}
          participationSlot={renderStageSlot(participationSlot, projection)}
        />
      )}

      <StageFooterNav
        projection={projection}
        onNavigateStage={onNavigateStage}
        returnToInitiativeHref={returnToInitiativeHref}
        isAuthorWorkspace={isAuthorWorkspace}
        isPreviewMode={isPreviewMode}
        onTogglePreview={handleTogglePreview}
      />
    </section>
  );
}
