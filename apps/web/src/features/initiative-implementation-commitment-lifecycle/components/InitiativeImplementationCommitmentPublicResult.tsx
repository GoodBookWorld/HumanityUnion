"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicInitiativeImplementationCommitmentListItem } from "@hu/types";

import { ConfirmDialog } from "../../../design-system";
import { fetchAuthSession } from "../../auth/auth-api";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { listPublicInitiativeImplementationCommitments } from "../../initiative-implementation-commitment/api";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import { CivicPublicTranslatedSection } from "../../language";
import { resolveCommitmentViewStateDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import {
  initiateImplementationCommitmentTransfer,
  reproposeInitiativeImplementationCommitment,
  takeInitiativeImplementationCommitment,
} from "../api";

import "./initiative-implementation-commitment-stage-workspace.css";

type CommitmentViewState =
  | "available"
  | "awaiting_you"
  | "awaiting_response"
  | "accepted"
  | "transfer_pending"
  | "completed"
  | "withdrawn"
  | "declined"
  | "legacy";

function resolveCommitmentViewState(
  commitment: PublicInitiativeImplementationCommitmentListItem,
  viewerParticipantId: string | null,
): CommitmentViewState {
  if (commitment.status === "completed") {
    return "completed";
  }

  if (commitment.status === "withdrawn") {
    return "withdrawn";
  }

  switch (commitment.proposalStatus) {
    case "unassigned":
      return "available";
    case "proposed":
      return viewerParticipantId &&
        commitment.responsibleParticipantId === viewerParticipantId
        ? "awaiting_you"
        : "awaiting_response";
    case "accepted":
      return commitment.pendingProposedParticipantId ? "transfer_pending" : "accepted";
    case "declined":
      return "declined";
    default:
      return "legacy";
  }
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

type AuthorActionMode = "repropose" | "transfer" | null;

interface InitiativeImplementationCommitmentPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
  /** Pack 19A.5 — Author may re-propose / transfer when steward. */
  readonly viewerIsSteward?: boolean;
}

/**
 * Initiative Lifecycle — Part I / Pack 19A.3–19A.5.
 * State-driven compact Responsibility UX — not a permanent button row.
 */
export function InitiativeImplementationCommitmentPublicResult({
  initiativeId,
  isPreview = false,
  viewerIsSteward = false,
}: InitiativeImplementationCommitmentPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const authStatus = useClientAuthStatus();
  const [viewerParticipantId, setViewerParticipantId] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<
    readonly PublicInitiativeImplementationCommitmentListItem[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCommitmentId, setPendingCommitmentId] = useState<string | null>(null);
  const [confirmCommitmentId, setConfirmCommitmentId] = useState<string | null>(null);
  const [isTaking, setIsTaking] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authorActionMode, setAuthorActionMode] = useState<AuthorActionMode>(null);
  const [authorActionCommitmentId, setAuthorActionCommitmentId] = useState<string | null>(null);
  const [nextParticipantId, setNextParticipantId] = useState("");
  const [isAuthorSubmitting, setIsAuthorSubmitting] = useState(false);
  const [authorError, setAuthorError] = useState<string | null>(null);

  const loadCommitments = useCallback(async () => {
    const result = await listPublicInitiativeImplementationCommitments(initiativeId);
    setCommitments(result.commitments);
  }, [initiativeId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await loadCommitments();
        if (!cancelled) {
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.commitment.public.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCommitments, t]);

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== "authenticated") {
      setViewerParticipantId(null);
      return;
    }

    void (async () => {
      try {
        const session = await fetchAuthSession();
        if (!cancelled) {
          setViewerParticipantId(session.user?.memberId ?? null);
        }
      } catch {
        if (!cancelled) {
          setViewerParticipantId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  function closeAuthorAction() {
    if (isAuthorSubmitting) {
      return;
    }

    setAuthorActionMode(null);
    setAuthorActionCommitmentId(null);
    setNextParticipantId("");
    setAuthorError(null);
  }

  async function handleConfirmTake() {
    if (!confirmCommitmentId) {
      return;
    }

    setIsTaking(true);
    setTakeError(null);
    setPendingCommitmentId(confirmCommitmentId);

    try {
      await takeInitiativeImplementationCommitment(confirmCommitmentId);
      await loadCommitments();
      setSuccessMessage(t("author.commitment.messages.acceptedSuccess"));
      setConfirmCommitmentId(null);
    } catch (err) {
      setTakeError(
        t("author.commitment.messages.takeFailed", {
          detail: detailFromError(err, t("author.commitment.messages.unknownError")),
        }),
      );
    } finally {
      setIsTaking(false);
      setPendingCommitmentId(null);
    }
  }

  async function handleConfirmAuthorAction() {
    if (!authorActionMode || !authorActionCommitmentId) {
      return;
    }

    const trimmed = nextParticipantId.trim();

    if (!trimmed) {
      setAuthorError(t("author.commitment.messages.enterParticipantId"));
      return;
    }

    setIsAuthorSubmitting(true);
    setAuthorError(null);

    try {
      if (authorActionMode === "repropose") {
        await reproposeInitiativeImplementationCommitment(authorActionCommitmentId, trimmed);
        setSuccessMessage(t("author.commitment.messages.reproposeSuccess"));
      } else {
        await initiateImplementationCommitmentTransfer(authorActionCommitmentId, trimmed);
        setSuccessMessage(t("author.commitment.messages.transferSuccess"));
      }

      await loadCommitments();
      setAuthorActionMode(null);
      setAuthorActionCommitmentId(null);
      setNextParticipantId("");
    } catch (err) {
      setAuthorError(
        t("author.commitment.messages.requestFailed", {
          detail: detailFromError(err, t("author.commitment.messages.unknownError")),
        }),
      );
    } finally {
      setIsAuthorSubmitting(false);
    }
  }

  if (error) {
    return <p className="iic-source-panel__empty">{error}</p>;
  }

  if (!commitments) {
    return <p className="iic-source-panel__empty">{t("author.commitment.public.loading")}</p>;
  }

  if (commitments.length === 0) {
    return <p className="iic-source-panel__empty">{t("author.commitment.public.empty")}</p>;
  }

  const confirmCommitment = commitments.find(
    (commitment) => commitment.commitmentId === confirmCommitmentId,
  );
  const authorActionCommitment = commitments.find(
    (commitment) => commitment.commitmentId === authorActionCommitmentId,
  );
  const showAuthorControls = !isPreview && viewerIsSteward && authStatus === "authenticated";

  return (
    <article className="iic-public" aria-label={t("author.commitment.public.aria")}>
      {isPreview ? (
        <p className="iic-public__meta">{t("author.commitment.public.previewMeta")}</p>
      ) : null}
      <section className="iic-public__section">
        <h3>{t("author.commitment.public.heading")}</h3>
        <p className="iic-public__meta">
          {t("author.commitment.public.publishedCount", { count: commitments.length })}
        </p>
      </section>

      {successMessage ? (
        <p className="iic-public__success" role="status">
          {successMessage}
        </p>
      ) : null}
      {takeError ? <p className="iic-public__error">{takeError}</p> : null}

      {commitments.map((commitment) => {
        const viewState = resolveCommitmentViewState(commitment, viewerParticipantId);
        const statusLabel = resolveCommitmentViewStateDisplayLabel(viewState, t);
        const commitmentTitle = commitment.approvedAction ?? commitment.title;
        const showTake =
          !isPreview &&
          authStatus === "authenticated" &&
          viewState === "available" &&
          commitment.status === "published";
        const showResponsible =
          viewState === "accepted" ||
          viewState === "transfer_pending" ||
          viewState === "completed" ||
          viewState === "withdrawn" ||
          (viewState === "legacy" && Boolean(commitment.authorDisplayName));
        const showRepropose = showAuthorControls && viewState === "declined";
        const showTransfer = showAuthorControls && viewState === "accepted";

        return (
          <div className="iic-public__commitment" key={commitment.commitmentId}>
            <CivicPublicTranslatedSection
              sourceKind="implementation_commitment"
              sourceRecordId={commitment.commitmentId}
              fallbackFields={{
                title: commitment.title,
                summary: commitment.summary ?? "",
                approvedAction: commitment.approvedAction ?? "",
                priority: commitment.priority ?? "",
                organization: "",
                commitmentScope: "",
                suggestedResponsibleRole: "",
                requiredResources: "",
                relatedRisks: "",
                references: "",
              }}
              fieldOrder={["title", "summary", "approvedAction", "priority"]}
            />
            {showResponsible && commitment.authorDisplayName !== "Unassigned" ? (
              <p className="iic-public__meta">
                {commitment.priority
                  ? t("author.commitment.public.responsibleWithPriority", {
                      name: commitment.authorDisplayName,
                      priority: commitment.priority,
                    })
                  : t("author.commitment.public.responsible", {
                      name: commitment.authorDisplayName,
                    })}
              </p>
            ) : commitment.priority ? (
              <p className="iic-public__meta">
                {t("author.commitment.public.priority", { priority: commitment.priority })}
              </p>
            ) : null}
            {statusLabel ? (
              <span className="iic-public__commitment-status">{statusLabel}</span>
            ) : null}
            {showTake ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="primary"
                  aria-label={t("author.commitment.public.takeAria", { title: commitmentTitle })}
                  disabled={pendingCommitmentId === commitment.commitmentId}
                  onClick={() => {
                    setTakeError(null);
                    setConfirmCommitmentId(commitment.commitmentId);
                  }}
                >
                  {t("author.commitment.public.takeCommitment")}
                </WorkspaceButton>
              </div>
            ) : null}
            {showRepropose ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="secondary"
                  aria-label={t("author.commitment.public.proposeAnotherAria", { title: commitmentTitle })}
                  onClick={() => {
                    setAuthorError(null);
                    setNextParticipantId("");
                    setAuthorActionMode("repropose");
                    setAuthorActionCommitmentId(commitment.commitmentId);
                  }}
                >
                  {t("author.commitment.public.proposeAnother")}
                </WorkspaceButton>
              </div>
            ) : null}
            {showTransfer ? (
              <div className="iic-public__take-action">
                <WorkspaceButton
                  variant="secondary"
                  aria-label={t("author.commitment.public.transferAria", { title: commitmentTitle })}
                  onClick={() => {
                    setAuthorError(null);
                    setNextParticipantId("");
                    setAuthorActionMode("transfer");
                    setAuthorActionCommitmentId(commitment.commitmentId);
                  }}
                >
                  {t("author.commitment.public.transfer")}
                </WorkspaceButton>
              </div>
            ) : null}
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={confirmCommitmentId !== null}
        title={t("author.commitment.public.takeConfirmTitle")}
        description={
          confirmCommitment ? (
            <>
              <p>{t("author.commitment.public.takeConfirmDescription")}</p>
              <p>
                <strong>{confirmCommitment.approvedAction ?? confirmCommitment.title}</strong>
              </p>
            </>
          ) : (
            t("author.commitment.public.takeConfirmDescription")
          )
        }
        confirmLabel={t("author.commitment.public.takeCommitment")}
        cancelLabel={t("author.commitment.public.cancel")}
        destructive={false}
        isConfirming={isTaking}
        onCancel={() => {
          if (!isTaking) {
            setConfirmCommitmentId(null);
          }
        }}
        onConfirm={() => void handleConfirmTake()}
      />

      <ConfirmDialog
        isOpen={authorActionMode !== null}
        title={
          authorActionMode === "transfer"
            ? t("author.commitment.public.transferConfirmTitle")
            : t("author.commitment.public.reproposeConfirmTitle")
        }
        description={
          <>
            {authorActionCommitment ? (
              <p>
                <strong>
                  {authorActionCommitment.approvedAction ?? authorActionCommitment.title}
                </strong>
              </p>
            ) : null}
            <p>
              {authorActionMode === "transfer"
                ? t("author.commitment.public.transferConfirmBody")
                : t("author.commitment.public.reproposeConfirmBody")}
            </p>
            <label className="iic-public__participant-field">
              {t("author.commitment.public.participantId")}
              <input
                type="text"
                value={nextParticipantId}
                onChange={(event) => setNextParticipantId(event.target.value)}
                autoComplete="off"
                disabled={isAuthorSubmitting}
              />
            </label>
            {authorError ? <p className="iic-public__error">{authorError}</p> : null}
          </>
        }
        confirmLabel={
          authorActionMode === "transfer"
            ? t("author.commitment.public.proposeTransfer")
            : t("author.commitment.public.propose")
        }
        cancelLabel={t("author.commitment.public.cancel")}
        destructive={false}
        isConfirming={isAuthorSubmitting}
        onCancel={closeAuthorAction}
        onConfirm={() => void handleConfirmAuthorAction()}
      />
    </article>
  );
}
