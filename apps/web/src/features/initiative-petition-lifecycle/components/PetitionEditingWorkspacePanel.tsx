"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { presentLifecycleStageTokensAsEnglish, type PublicPetitionRecord } from "@hu/types";

import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import {
  WorkspaceButton,
  WorkspaceStatusBadge,
  type WorkspaceBadgeVariant,
} from "../../initiative-workspace-ux";
import type { PetitionWorkingDraft } from "../api";
import {
  buildPetitionSlotSegments,
  buildPetitionStatusHref,
  shouldShowPetitionStatusInPlace,
  type PetitionDraftErrorKind,
  type PetitionSlotSummary,
} from "../petition-editing-workspace";
import { petitionDocumentStatusKey } from "../petition-public-document";
import { PetitionDraftIcon, PetitionLockIcon } from "./PetitionEditingIcons";

const PUBLISHED_BADGE_VARIANT: Record<string, WorkspaceBadgeVariant> = {
  statusOpen: "published",
  statusClosed: "closed",
  statusArchived: "archived",
};

export type PetitionEditingWorkspaceState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly kind: PetitionDraftErrorKind }
  | {
      readonly status: "ready";
      readonly drafts: readonly PetitionWorkingDraft[];
      readonly published: readonly PublicPetitionRecord[];
    };

export interface PetitionEditingNotice {
  readonly tone: "success" | "error";
  readonly text: string;
  /** A newly published Petition to link to. */
  readonly publishedPetitionId?: string;
}

export interface PetitionEditingWorkspacePanelProps {
  readonly currentPetitionId: string;
  readonly state: PetitionEditingWorkspaceState;
  readonly slots: PetitionSlotSummary | null;
  readonly busy: boolean;
  readonly notice: PetitionEditingNotice | null;
  readonly selectedDraftId: string | null;
  readonly pendingDelete: PetitionWorkingDraft | null;
  /** The editor of the selected draft. */
  readonly editor: ReactNode;
  readonly onCreateEmpty: () => void;
  readonly onCreateFromCurrent: () => void;
  readonly onRefresh: () => void;
  readonly onSelectDraft: (draftId: string) => void;
  readonly onRequestDelete: (draft: PetitionWorkingDraft) => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
  /** HU-LC-05C.4C.7C.3D — show Petition Status for the Petition already open on this page. */
  readonly onShowPetitionStatus?: () => void;
}

function formatDateTime(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/**
 * HU-LC-05C.4C.7C.2 — the steward's Editing Petition workspace: published
 * Petitions (read-only), working drafts, the three shared slots and the
 * selected draft's editor.
 */
export function PetitionEditingWorkspacePanel({
  currentPetitionId,
  state,
  slots,
  busy,
  notice,
  selectedDraftId,
  pendingDelete,
  editor,
  onCreateEmpty,
  onCreateFromCurrent,
  onRefresh,
  onSelectDraft,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onShowPetitionStatus,
}: PetitionEditingWorkspacePanelProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  function openPublishedPetition(event: MouseEvent<HTMLAnchorElement>, isCurrent: boolean) {
    if (onShowPetitionStatus && shouldShowPetitionStatusInPlace(event, isCurrent)) {
      event.preventDefault();
      onShowPetitionStatus();
    }
  }
  const slotsFull = slots !== null && slots.available === 0;
  const currentIsPublished =
    state.status === "ready" &&
    state.published.some((petition) => petition.petitionId === currentPetitionId);

  return (
    <section className="ipl-editing" aria-labelledby="ipl-editing-title">
      <div className="ipl-editing__header">
        <h2 id="ipl-editing-title" className="ipl-editing__title">
          {t("petitionEditing.title")}
        </h2>
        <button
          type="button"
          className="ipl-editing__refresh"
          disabled={busy}
          onClick={onRefresh}
        >
          {t("petitionEditing.actions.refresh")}
        </button>
      </div>
      <p className="ipl-editing__intro">{t("petitionEditing.intro")}</p>

      {notice ? (
        <p className="ipl-editor__message" data-tone={notice.tone} role="status">
          {notice.text}{" "}
          {notice.publishedPetitionId ? (
            <Link href={`/petitions/${encodeURIComponent(notice.publishedPetitionId)}`}>
              {t("petitionEditing.messages.openPublished")}
            </Link>
          ) : null}
        </p>
      ) : null}

      {state.status === "loading" ? (
        <p className="ipl-editing__note" role="status">
          {t("petitionEditing.loading")}
        </p>
      ) : state.status === "failed" ? (
        <p className="ipl-editor__message" data-tone="error" role="status">
          {t(`petitionEditing.errors.${state.kind}`)}
        </p>
      ) : (
        <>
          <section
            className="ipl-editing__section ipl-editing__section--slots"
            aria-labelledby="ipl-editing-slots"
          >
            {slots ? (
              <div className="ipl-editing__slot-row">
                <div className="ipl-editing__slot-meter" aria-hidden="true">
                  {buildPetitionSlotSegments({
                    draftCount: state.drafts.length,
                    publishedCount: state.published.length,
                  }).map((segment, index) => (
                    <span
                      key={index}
                      className={`ipl-editing__slot ipl-editing__slot--${segment}`}
                      data-slot={segment}
                    />
                  ))}
                </div>
                <p id="ipl-editing-slots" className="ipl-editing__slots" role="status">
                  {t("petitionEditing.slots.summary", {
                    occupied: slots.occupied,
                    limit: slots.limit,
                    available: slots.available,
                  })}
                  {slotsFull ? ` ${t("petitionEditing.slots.full", { limit: slots.limit })}` : null}
                </p>
                <ul className="ipl-editing__slot-legend" aria-hidden="true">
                  <li className="ipl-editing__slot-legend-item ipl-editing__slot-legend-item--published">
                    {t("petitionEditing.slots.legend.published")}
                  </li>
                  <li className="ipl-editing__slot-legend-item ipl-editing__slot-legend-item--draft">
                    {t("petitionEditing.slots.legend.draft")}
                  </li>
                  <li className="ipl-editing__slot-legend-item ipl-editing__slot-legend-item--available">
                    {t("petitionEditing.slots.legend.available")}
                  </li>
                </ul>
              </div>
            ) : null}

            <div className="ipl-editing__actions">
              <WorkspaceButton
                variant="primary"
                disabled={busy || slotsFull}
                onClick={onCreateEmpty}
              >
                {t("petitionEditing.actions.newEmpty")}
              </WorkspaceButton>
              {currentIsPublished ? (
                <WorkspaceButton
                  variant="secondary"
                  disabled={busy || slotsFull}
                  onClick={onCreateFromCurrent}
                >
                  {t("petitionEditing.actions.newFromCurrent")}
                </WorkspaceButton>
              ) : null}
            </div>
          </section>

          <section className="ipl-editing__section" aria-labelledby="ipl-editing-published">
            <h3 id="ipl-editing-published" className="ipl-editing__group-title">
              {t("petitionEditing.published.title")}
            </h3>
            {state.published.length === 0 ? (
              <p className="ipl-editing__note">{t("petitionEditing.published.empty")}</p>
            ) : (
              <ul className="ipl-editing__list" aria-labelledby="ipl-editing-published">
                {state.published.map((petition) => {
                  const statusKey = petitionDocumentStatusKey(petition.status);
                  const isCurrent = petition.petitionId === currentPetitionId;
                  return (
                    <li
                      key={petition.petitionId}
                      className="ipl-editing__card ipl-editing__card--published"
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span className="ipl-editing__card-icon ipl-editing__card-icon--published">
                        <PetitionLockIcon />
                      </span>
                      <span className="ipl-editing__card-body">
                        <Link
                          className="ipl-editing__item-title ipl-editing__title-link"
                          href={buildPetitionStatusHref(petition.petitionId)}
                          onClick={(event) => openPublishedPetition(event, isCurrent)}
                        >
                          {presentLifecycleStageTokensAsEnglish(petition.subject.title)}
                        </Link>
                        <span className="ipl-editing__item-meta">
                          <WorkspaceStatusBadge
                            status={petition.status}
                            variant={statusKey ? PUBLISHED_BADGE_VARIANT[statusKey] : "published"}
                            label={
                              statusKey
                                ? t(`author.petition.public.document.${statusKey}`)
                                : t("petitionEditing.published.statusPublished")
                            }
                          />
                          <span>{t("petitionEditing.published.readOnly")}</span>
                          {isCurrent ? (
                            <span className="ipl-editing__current">
                              {t("petitionEditing.published.current")}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <Link
                        className="ipl-editing__item-link"
                        href={buildPetitionStatusHref(petition.petitionId)}
                        onClick={(event) => openPublishedPetition(event, isCurrent)}
                      >
                        {t("manage.links.viewPetition")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="ipl-editing__section" aria-labelledby="ipl-editing-drafts">
            <h3 id="ipl-editing-drafts" className="ipl-editing__group-title">
              {t("petitionEditing.drafts.title")}
            </h3>
            {state.drafts.length === 0 ? (
              <div className="ipl-editing__empty">
                <span className="ipl-editing__card-icon ipl-editing__card-icon--draft">
                  <PetitionDraftIcon />
                </span>
                <span className="ipl-editing__card-body">
                  <span className="ipl-editing__item-title">{t("petitionEditing.drafts.empty")}</span>
                  <span className="ipl-editing__item-meta">{t("petitionEditing.drafts.emptyHint")}</span>
                </span>
              </div>
            ) : (
              <ul className="ipl-editing__list" aria-labelledby="ipl-editing-drafts">
                {state.drafts.map((draft) => {
                  const isSelected = draft.draftId === selectedDraftId;
                  const title = presentLifecycleStageTokensAsEnglish(draft.title).trim();
                  return (
                    <li
                      key={draft.draftId}
                      className="ipl-editing__card ipl-editing__card--draft"
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <span className="ipl-editing__card-icon ipl-editing__card-icon--draft">
                        <PetitionDraftIcon />
                      </span>
                      <span className="ipl-editing__card-body">
                        <span className="ipl-editing__item-title">
                          {title || t("petitionEditing.drafts.untitled")}
                        </span>
                        <span className="ipl-editing__item-meta">
                          <WorkspaceStatusBadge
                            status="draft"
                            variant="draft"
                            label={t("petitionEditing.drafts.status")}
                          />
                          <span>
                            {t("petitionEditing.drafts.updated", {
                              date: formatDateTime(draft.updatedAt, locale),
                            })}
                          </span>
                          {draft.derivedFromPetitionId ? (
                            <span>{t("petitionEditing.drafts.derived")}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="ipl-editing__item-actions">
                        <WorkspaceButton
                          variant="secondary"
                          disabled={busy || isSelected}
                          onClick={() => onSelectDraft(draft.draftId)}
                        >
                          {isSelected
                            ? t("petitionEditing.drafts.editing")
                            : t("petitionEditing.drafts.edit")}
                        </WorkspaceButton>
                        <WorkspaceButton
                          variant="danger"
                          disabled={busy}
                          onClick={() => onRequestDelete(draft)}
                        >
                          {t("petitionEditing.drafts.delete")}
                        </WorkspaceButton>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {editor ? <section className="ipl-editing__editor-panel">{editor}</section> : null}
        </>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("petitionEditing.confirm.delete.title")}
        description={t("petitionEditing.confirm.delete.description", {
          title:
            presentLifecycleStageTokensAsEnglish(pendingDelete?.title ?? "").trim() ||
            t("petitionEditing.drafts.untitled"),
        })}
        confirmLabel={t("petitionEditing.confirm.delete.confirm")}
        isConfirming={busy}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
