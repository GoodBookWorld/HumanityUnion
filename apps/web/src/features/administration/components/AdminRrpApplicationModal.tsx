"use client";

/**
 * HU-RRP-03D — Admin RRP application view + review inside Participant directory.
 * Approve uses confirm-appointment (platform designation), never status-only review.
 */

import type { AdminRrpApplicationDetail } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { useCountryDisplayName } from "../../geography-display/GeographyDisplayProvider";
import {
  confirmAdminRrpAppointment,
  getAdminRrpApplication,
  listAdminRrpApplications,
  reviewAdminRrpApplication,
} from "../admin-rrp-application-api";
import {
  isRrpApproveEligibleStatus,
  isRrpMarkUnderReviewEligible,
  isRrpRejectEligible,
  isRrpRequestInformationEligible,
} from "../admin-rrp-directory";

import "../../../design-system/components/confirm-dialog.css";
import "./admin-rrp-application-modal.css";

interface AdminRrpApplicationModalProps {
  isOpen: boolean;
  participantId: string;
  applicationIds: readonly string[];
  onClose: () => void;
  onDirectoryRefresh?: () => void;
}

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatMoneyCad(amount: number | null, locale: string): string {
  if (amount === null || amount === undefined) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} CAD`;
  }
}

export function AdminRrpApplicationModal({
  isOpen,
  participantId,
  applicationIds,
  onClose,
  onDirectoryRefresh,
}: AdminRrpApplicationModalProps) {
  const t = useTranslations("rrpApplication.admin");
  const tStatus = useTranslations("rrpApplication.status");
  const tFunding = useTranslations("rrpApplication.funding");
  const locale = useLocale();
  const resolveCountryName = useCountryDisplayName();

  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const approvingRef = useRef(false);

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectorItems, setSelectorItems] = useState<
    readonly {
      applicationId: string;
      representCountryCode: string;
      status: string;
    }[]
  >([]);
  const [detail, setDetail] = useState<AdminRrpApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [messageWarning, setMessageWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    null | "approve" | "mark_under_review" | "request_information" | "reject"
  >(null);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], textarea, input, select",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (confirmApproveOpen) {
          event.preventDefault();
          setConfirmApproveOpen(false);
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onClose, confirmApproveOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedApplicationId(null);
      setSelectorItems([]);
      setDetail(null);
      setError(null);
      setDenied(false);
      setActionMessage(null);
      setMessageWarning(null);
      setBusy(null);
      setConfirmApproveOpen(false);
      setReviewNote("");
      approvingRef.current = false;
      return;
    }

    const uniqueIds = [...new Set(applicationIds.filter(Boolean))];
    if (uniqueIds.length === 1) {
      setSelectedApplicationId(uniqueIds[0]!);
      setSelectorItems([]);
      return;
    }

    if (uniqueIds.length === 0) {
      setSelectedApplicationId(null);
      setSelectorItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listAdminRrpApplications({
      participantId,
      limit: 50,
      offset: 0,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const allowed = new Set(uniqueIds);
        const items: {
          applicationId: string;
          representCountryCode: string;
          status: string;
        }[] = response.items
          .filter((item) => allowed.has(item.applicationId))
          .map((item) => ({
            applicationId: item.applicationId,
            representCountryCode: item.representCountryCode,
            status: item.status,
          }));
        // Include any id not returned by list (e.g. race) as bare options.
        for (const id of uniqueIds) {
          if (!items.some((item) => item.applicationId === id)) {
            items.push({
              applicationId: id,
              representCountryCode: "—",
              status: "",
            });
          }
        }
        setSelectorItems(items);
        setSelectedApplicationId(items[0]?.applicationId ?? uniqueIds[0] ?? null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setSelectorItems(
          uniqueIds.map((id) => ({
            applicationId: id,
            representCountryCode: "—",
            status: "",
          })),
        );
        setSelectedApplicationId(uniqueIds[0] ?? null);
        if (isForbiddenError(loadError)) {
          setDenied(true);
          setError(t("errors.forbidden"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, applicationIds, participantId, t]);

  const loadDetail = useCallback(
    async (applicationId: string) => {
      setLoading(true);
      setError(null);
      setDenied(false);
      try {
        const next = await getAdminRrpApplication(applicationId);
        setDetail(next);
      } catch (loadError: unknown) {
        setDetail(null);
        if (isForbiddenError(loadError)) {
          setDenied(true);
          setError(t("errors.forbidden"));
        } else {
          setError(formatAuthFormError(loadError));
        }
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!isOpen || !selectedApplicationId) {
      return;
    }
    void loadDetail(selectedApplicationId);
  }, [isOpen, selectedApplicationId, loadDetail]);

  if (!isOpen) {
    return null;
  }

  const countryLabel = (code: string | null | undefined) =>
    code ? resolveCountryName(code, code) : "—";

  async function handleConfirmApprove() {
    if (!detail || approvingRef.current || busy) {
      return;
    }
    if (!isRrpApproveEligibleStatus(detail.status)) {
      return;
    }
    approvingRef.current = true;
    setBusy("approve");
    setActionMessage(null);
    setMessageWarning(null);
    try {
      const result = await confirmAdminRrpAppointment({
        applicationId: detail.applicationId,
        expectedRevision: detail.revision,
      });
      setDetail(result.application);
      setConfirmApproveOpen(false);
      setActionMessage(t("messages.approved"));
      if (result.messageWarning) {
        setMessageWarning(result.messageWarning);
      }
      onDirectoryRefresh?.();
    } catch (actionError: unknown) {
      setError(formatAuthFormError(actionError));
      setConfirmApproveOpen(false);
    } finally {
      approvingRef.current = false;
      setBusy(null);
    }
  }

  async function handleReview(
    decision: "mark_under_review" | "request_information" | "reject",
  ) {
    if (!detail || busy) {
      return;
    }
    const needsNote = decision === "request_information" || decision === "reject";
    if (needsNote && !reviewNote.trim()) {
      setError(t("errors.noteRequired"));
      return;
    }
    setBusy(decision);
    setActionMessage(null);
    setMessageWarning(null);
    setError(null);
    try {
      const updated = await reviewAdminRrpApplication({
        applicationId: detail.applicationId,
        decision,
        expectedRevision: detail.revision,
        ...(needsNote ? { note: reviewNote.trim() } : {}),
      });
      setDetail(updated);
      setReviewNote("");
      setActionMessage(
        decision === "mark_under_review"
          ? t("messages.markedUnderReview")
          : decision === "request_information"
            ? t("messages.informationRequested")
            : t("messages.rejected"),
      );
      onDirectoryRefresh?.();
    } catch (actionError: unknown) {
      setError(formatAuthFormError(actionError));
    } finally {
      setBusy(null);
    }
  }

  const canApprove = detail ? isRrpApproveEligibleStatus(detail.status) : false;
  const canMarkUnderReview = detail ? isRrpMarkUnderReviewEligible(detail.status) : false;
  const canRequestInfo = detail ? isRrpRequestInformationEligible(detail.status) : false;
  const canReject = detail ? isRrpRejectEligible(detail.status) : false;
  const isMutating = busy !== null;

  return (
    <>
      <div className="hu-confirm-dialog__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="hu-confirm-dialog admin-rrp-application-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="admin-rrp-application-modal__header">
          <h2 id={titleId} className="hu-confirm-dialog__title">
            {t("title")}
          </h2>
          <p id={descriptionId} className="hu-caption admin-rrp-application-modal__intro">
            {t("intro")}
          </p>
          <Button type="button" variant="tertiary" onClick={onClose} aria-label={t("closeAria")}>
            {t("close")}
          </Button>
        </div>

        {selectorItems.length > 1 ? (
          <label className="admin-rrp-application-modal__selector">
            {t("selectApplication")}
            <select
              value={selectedApplicationId ?? ""}
              disabled={isMutating || loading}
              onChange={(event) => {
                setActionMessage(null);
                setMessageWarning(null);
                setSelectedApplicationId(event.target.value || null);
              }}
            >
              {selectorItems.map((item) => (
                <option key={item.applicationId} value={item.applicationId}>
                  {`${countryLabel(item.representCountryCode)} — ${
                    item.status ? tStatus(item.status as never) : t("statusUnknown")
                  }`}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? (
          <p className="hu-body" role="status">
            {t("loading")}
          </p>
        ) : null}

        {!loading && error ? (
          <StatusBanner
            title={denied ? t("errors.accessRestricted") : t("errors.unavailable")}
            message={error}
          />
        ) : null}

        {!loading && !error && !detail && !selectedApplicationId ? (
          <p className="hu-body" role="status">
            {t("empty")}
          </p>
        ) : null}

        {actionMessage ? <StatusBanner title={t("messages.updateTitle")} message={actionMessage} /> : null}
        {messageWarning ? (
          <StatusBanner title={t("messages.deliveryWarningTitle")} message={messageWarning} />
        ) : null}

        {!loading && detail ? (
          <div className="admin-rrp-application-modal__body">
            <dl className="admin-rrp-application-modal__grid">
              <div>
                <dt>{t("fields.applicant")}</dt>
                <dd>
                  {[detail.legalFirstName, detail.legalLastName].filter(Boolean).join(" ") || "—"}
                </dd>
              </div>
              <div>
                <dt>{t("fields.profession")}</dt>
                <dd>{detail.profession || "—"}</dd>
              </div>
              <div>
                <dt>{t("fields.residenceCountry")}</dt>
                <dd>{countryLabel(detail.residenceCountryCode)}</dd>
              </div>
              <div>
                <dt>{t("fields.representCountry")}</dt>
                <dd>{countryLabel(detail.representCountryCode)}</dd>
              </div>
              <div>
                <dt>{t("fields.fundingModel")}</dt>
                <dd>
                  {detail.fundingModel ? tFunding(detail.fundingModel) : "—"}
                </dd>
              </div>
              <div>
                <dt>{t("fields.requestedAmount")}</dt>
                <dd>{formatMoneyCad(detail.annualRequestedAmountCad, locale)}</dd>
              </div>
              <div>
                <dt>{t("fields.teamMemberCount")}</dt>
                <dd>
                  {detail.teamMemberCount === null || detail.teamMemberCount === undefined
                    ? "—"
                    : String(detail.teamMemberCount)}
                </dd>
              </div>
              <div>
                <dt>{t("fields.status")}</dt>
                <dd>{tStatus(detail.status)}</dd>
              </div>
              <div>
                <dt>{t("fields.submittedAt")}</dt>
                <dd>{formatDateTime(detail.submittedAt, locale)}</dd>
              </div>
              <div>
                <dt>{t("fields.consent")}</dt>
                <dd>
                  {detail.consentAcceptedAt
                    ? t("fields.consentAccepted", {
                        version: detail.consentVersion ?? "—",
                        at: formatDateTime(detail.consentAcceptedAt, locale),
                      })
                    : "—"}
                </dd>
              </div>
            </dl>

            <section className="admin-rrp-application-modal__block" aria-label={t("fields.experience")}>
              <h3>{t("fields.experience")}</h3>
              <p className="admin-rrp-application-modal__prose">
                {detail.relevantExperience || "—"}
              </p>
            </section>

            <section className="admin-rrp-application-modal__block" aria-label={t("fields.motivation")}>
              <h3>{t("fields.motivation")}</h3>
              <p className="admin-rrp-application-modal__prose">{detail.motivation || "—"}</p>
            </section>

            <section
              className="admin-rrp-application-modal__block"
              aria-label={t("fields.decisionHistory")}
            >
              <h3>{t("fields.decisionHistory")}</h3>
              {detail.decisionHistory.length === 0 ? (
                <p className="hu-caption">{t("fields.noHistory")}</p>
              ) : (
                <ul className="admin-rrp-application-modal__history">
                  {detail.decisionHistory.map((entry, index) => (
                    <li key={`${entry.at}-${entry.toStatus}-${index}`}>
                      <span>
                        {tStatus(entry.fromStatus)} → {tStatus(entry.toStatus)}
                      </span>
                      <span className="hu-caption">
                        {formatDateTime(entry.at, locale)}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="hu-caption admin-rrp-application-modal__disclaimer">
              {t("disclaimer.platformOnly")}
            </p>

            <div className="admin-rrp-application-modal__note">
              <label htmlFor="admin-rrp-review-note">{t("fields.reviewNote")}</label>
              <textarea
                id="admin-rrp-review-note"
                value={reviewNote}
                disabled={isMutating}
                rows={3}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </div>

            <div className="admin-rrp-application-modal__actions" role="group" aria-label={t("actions.group")}>
              <Button
                type="button"
                variant="secondary"
                disabled={!canMarkUnderReview || isMutating}
                onClick={() => void handleReview("mark_under_review")}
              >
                {busy === "mark_under_review" ? t("busy.working") : t("actions.markUnderReview")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canRequestInfo || isMutating}
                onClick={() => void handleReview("request_information")}
              >
                {busy === "request_information" ? t("busy.working") : t("actions.requestInformation")}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!canReject || isMutating}
                onClick={() => void handleReview("reject")}
              >
                {busy === "reject" ? t("busy.working") : t("actions.reject")}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!canApprove || isMutating}
                onClick={() => setConfirmApproveOpen(true)}
              >
                {t("actions.approve")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={confirmApproveOpen}
        title={t("confirmApprove.title")}
        description={
          <div className="admin-rrp-application-modal__confirm-copy">
            <p>{t("confirmApprove.lineApprove")}</p>
            <p>{t("confirmApprove.lineDesignation")}</p>
            <p>{t("confirmApprove.lineNoLegal")}</p>
            <p>{t("confirmApprove.lineNoFunding")}</p>
            <p>{t("confirmApprove.lineNoAdmin")}</p>
          </div>
        }
        confirmLabel={busy === "approve" ? t("busy.approving") : t("confirmApprove.confirm")}
        cancelLabel={t("confirmApprove.cancel")}
        destructive={false}
        isConfirming={busy === "approve"}
        onCancel={() => {
          if (busy === "approve") {
            return;
          }
          setConfirmApproveOpen(false);
        }}
        onConfirm={() => {
          void handleConfirmApprove();
        }}
      />
    </>
  );
}
