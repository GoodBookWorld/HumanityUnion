"use client";

import { useId } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import { buildPetitionEditingHref } from "../petition-editing-workspace";
import { petitionDocumentStatusKey } from "../petition-public-document";
import {
  resolveStewardPetitionStageView,
  shouldScrollToPetitionDocument,
  type InitiativePetitionListState,
  type PetitionViewerSelection,
} from "../petition-viewer-selection";
import { PetitionReadingTitle } from "../../petition/components/PetitionReadingTitle";
import { InitiativePetitionAuthorWorkspace } from "./InitiativePetitionAuthorWorkspace";
import {
  InitiativePetitionPublicResult,
  type PetitionDocumentScrollOutcome,
} from "./InitiativePetitionPublicResult";

import "./initiative-petition-stage-workspace.css";

export interface InitiativePetitionStewardStageViewProps {
  readonly initiativeId: string;
  /** This Initiative's active Petitions (already scoped to `initiativeId`). */
  readonly list: InitiativePetitionListState;
  /** The page's validated `?petition=` selection. */
  readonly selection: PetitionViewerSelection;
  readonly onOpenPetition: (petitionId: string) => void;
  readonly onReturnToEditing: () => void;
  /** Present only when the viewer may open Manage Initiative. */
  readonly onManageInitiative?: () => void;
  readonly onTogglePreview: () => void;
  readonly onRetryList?: () => void;
  readonly onSignatureChange?: (petitionId: string, viewerHasSigned: boolean) => void;
  /** HU-LC-05C.4C.7C.3A — the Petition just chosen from a list, to scroll to once rendered. */
  readonly scrollRequestPetitionId?: string | null;
  readonly onScrollRequestHandled?: (outcome: PetitionDocumentScrollOutcome) => void;
}

/**
 * HU-LC-05C.4C.7B — the steward's Petition stage (Author Workspace only;
 * Public Preview never mounts it). Each published Petition opens in the
 * same public result, with the same Signature widget, that every other
 * Participant sees; signing rules stay with the API.
 */
export function InitiativePetitionStewardStageView({
  initiativeId,
  list,
  selection,
  onOpenPetition,
  onReturnToEditing,
  onManageInitiative,
  onTogglePreview,
  onRetryList,
  onSignatureChange,
  scrollRequestPetitionId = null,
  onScrollRequestHandled,
}: InitiativePetitionStewardStageViewProps) {
  const t = useTranslations("initiativeExperience");
  const headingId = useId();
  const view = resolveStewardPetitionStageView(selection);
  const openedPetitionId = view.kind === "petition" ? view.petitionId : null;
  const petitions = list.status === "ready" ? list.petitions : [];
  const editingPetitionId = openedPetitionId ?? petitions[0]?.petitionId ?? null;

  return (
    <div className="ipl-steward-stage">
      <nav className="ipl-steward-nav" aria-labelledby={headingId}>
        <div className="ipl-steward-nav__header">
          <h3 id={headingId} className="ipl-steward-nav__title">
            {t("petitionsWidget.title")}
          </h3>
          <div className="ipl-steward-nav__actions">
            {view.kind !== "editor" ? (
              <WorkspaceButton variant="secondary" onClick={onReturnToEditing}>
                {t("author.shared.backToAuthorWorkspace")}
              </WorkspaceButton>
            ) : null}
            {editingPetitionId ? (
              <Link
                className="workspace-button workspace-button--secondary"
                href={buildPetitionEditingHref(editingPetitionId)}
              >
                {t("petitionEditing.tabs.editing")}
              </Link>
            ) : null}
            {onManageInitiative ? (
              <WorkspaceButton variant="secondary" onClick={onManageInitiative}>
                {t("manage.title")}
              </WorkspaceButton>
            ) : null}
          </div>
        </div>
        {list.status === "loading" ? (
          <p className="ipl-steward-nav__note" role="status">
            {t("petitionsWidget.loading")}
          </p>
        ) : list.status === "failed" ? (
          <p className="ipl-steward-nav__note" role="status">
            {t("petitionsWidget.loadFailed")}{" "}
            {onRetryList ? (
              <button type="button" className="ipl-steward-nav__retry" onClick={onRetryList}>
                {t("author.actions.retry")}
              </button>
            ) : null}
          </p>
        ) : petitions.length === 0 ? (
          <p className="ipl-steward-nav__note">{t("petitionsWidget.empty")}</p>
        ) : (
          <ul className="ipl-steward-nav__list" aria-label={t("petitionsWidget.listAria")}>
            {petitions.map((petition) => {
              const statusKey = petitionDocumentStatusKey(petition.lifecycleStatus);
              return (
                <li key={petition.petitionId} className="ipl-steward-nav__item">
                  <button
                    type="button"
                    className="ipl-steward-nav__petition"
                    aria-current={petition.petitionId === openedPetitionId ? "true" : undefined}
                    onClick={() => onOpenPetition(petition.petitionId)}
                  >
                    <PetitionReadingTitle
                      className="ipl-steward-nav__petition-title"
                      petitionId={petition.petitionId}
                      title={petition.title}
                    />
                    <span className="ipl-steward-nav__petition-meta">
                      {statusKey ? `${t(`author.petition.public.document.${statusKey}`)} · ` : null}
                      {t("petitionsWidget.signatures", { count: petition.signatureCount })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {view.kind === "petition" ? (
        <InitiativePetitionPublicResult
          key={view.petitionId}
          petitionId={view.petitionId}
          onSignatureChange={onSignatureChange}
          scrollIntoViewOnLoad={shouldScrollToPetitionDocument({
            scrollRequestPetitionId,
            petitionId: view.petitionId,
            isPreview: false,
          })}
          onScrollRequestHandled={onScrollRequestHandled}
        />
      ) : view.kind === "pending" ? (
        <p className="lsw-result__placeholder">{t("author.petition.public.loading")}</p>
      ) : (
        <InitiativePetitionAuthorWorkspace
          initiativeId={initiativeId}
          onTogglePreview={onTogglePreview}
        />
      )}
    </div>
  );
}
