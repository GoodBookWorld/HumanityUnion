"use client";

/**
 * HU-RRP-02D.1 — Persistent “My Regional Applications” Workspace rail widget.
 * Reuses RrpApplicationModal; does not own a second application form.
 */

import type { RrpApplicationDetail } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import { useCountryDisplayName } from "../../geography-display/GeographyDisplayProvider";
import { listMyRrpApplications } from "../rrp-application-api";
import { isRrpApplicationEntryEnabled } from "../rrp-application-entry";
import {
  isRrpApplicationEditableStatus,
  isRrpRepresentativeMessageVisible,
  partitionRrpApplicationsForDisplay,
} from "../rrp-application-form";
import { RrpApplicationModal } from "./RrpApplicationModal";

import "./rrp-application-workspace-widget.css";

type ModalIntent = "hub" | "create" | null;

function formatUpdatedDate(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function RrpApplicationWorkspaceWidget() {
  const t = useTranslations("rrpApplication");
  const locale = useLocale();
  const resolveCountryName = useCountryDisplayName();
  const titleId = useId();
  const historyHeadingId = useId();
  const [applications, setApplications] = useState<RrpApplicationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalApplicationId, setModalApplicationId] = useState<string | null>(null);
  const [modalIntent, setModalIntent] = useState<ModalIntent>(null);

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isRrpApplicationEntryEnabled()) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void listMyRrpApplications()
      .then((listed) => {
        if (cancelled) {
          return;
        }
        setApplications(listed);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(formatAuthFormError(loadError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const openModal = useCallback((options?: {
    applicationId?: string | null;
    intent?: ModalIntent;
  }) => {
    setModalApplicationId(options?.applicationId ?? null);
    setModalIntent(options?.intent ?? null);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setModalApplicationId(null);
    setModalIntent(null);
  }, []);

  if (!isRrpApplicationEntryEnabled()) {
    return null;
  }

  const { active, history } = partitionRrpApplicationsForDisplay(applications);
  const orderedApplications = [...active, ...history];
  const historyScrollable = orderedApplications.length > 2;
  const isEmpty = !loading && !error && applications.length === 0;

  function renderOpenMessagesAction(item: RrpApplicationDetail) {
    if (!isRrpRepresentativeMessageVisible(item)) {
      return null;
    }
    const conversationId = item.adminConversationId?.trim() ?? "";
    return (
      <span data-rrp-open-messages="available">
        <Button
          href={`/workspace/messages/${encodeURIComponent(conversationId)}`}
          variant="secondary"
          className="rrp-application-workspace-widget__message-button"
          aria-label={t("workspaceWidget.message")}
        >
          <img
            src="/icons/workspace/message.svg"
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className="rrp-application-workspace-widget__message-icon"
            decoding="async"
          />
          {t("workspaceWidget.message")}
        </Button>
      </span>
    );
  }

  function renderApplicationRow(item: RrpApplicationDetail) {
    const countryLabel = resolveCountryName(item.representCountryCode, item.representCountryCode);
    const description = item.motivation?.trim() ?? "";
    const editable = isRrpApplicationEditableStatus(item.status);
    const primaryLabel = editable ? t("workspaceWidget.edit") : t("workspaceWidget.view");
    const primaryAria = editable
      ? t("workspaceWidget.editAria", { country: countryLabel })
      : t("workspaceWidget.viewAria", { country: countryLabel });

    return (
      <li key={item.applicationId} className="rrp-application-workspace-widget__item">
        <div className="rrp-application-workspace-widget__meta">
          <p className="rrp-application-workspace-widget__country">{countryLabel}</p>
          <p className="rrp-application-workspace-widget__status">
            {t(`status.${item.status}`)}
          </p>
          {description ? (
            <p className="rrp-application-workspace-widget__description">{description}</p>
          ) : null}
          {item.platformDesignationActive ? (
            <p
              className="rrp-application-workspace-widget__designation"
              data-rrp-platform-designation="active"
            >
              {t("workspaceWidget.representativeDesignation")}
            </p>
          ) : null}
          {item.status === "information_requested" ? (
            <p className="rrp-application-workspace-widget__messages-hint">
              {t("workspaceWidget.messagesHint")}
            </p>
          ) : null}
          <p className="rrp-application-workspace-widget__updated">
            {t("workspaceWidget.updated", {
              date: formatUpdatedDate(item.updatedAt, locale),
            })}
          </p>
        </div>
        <div className="rrp-application-workspace-widget__actions">
          <Button
            type="button"
            variant={editable ? "primary" : "secondary"}
            aria-label={primaryAria}
            onClick={() => openModal({ applicationId: item.applicationId })}
          >
            {primaryLabel}
          </Button>
          {renderOpenMessagesAction(item)}
        </div>
      </li>
    );
  }

  return (
    <>
      <section
        className="rrp-application-workspace-widget"
        aria-labelledby={titleId}
        data-rrp-workspace-widget="true"
      >
        <div className="rrp-application-workspace-widget__header">
          <img
            src="/icons/workspace/regions.svg"
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
            className="rrp-application-workspace-widget__icon"
            decoding="async"
          />
          <h2 id={titleId} className="rrp-application-workspace-widget__title hu-widget-title">
            {t("workspaceWidget.title")}
          </h2>
        </div>

        {loading ? (
          <p className="rrp-application-workspace-widget__copy" role="status">
            {t("workspaceWidget.loading")}
          </p>
        ) : null}

        {!loading && error ? (
          <div className="rrp-application-workspace-widget__footer">
            <p className="rrp-application-workspace-widget__copy" role="alert">
              {error || t("workspaceWidget.error")}
            </p>
            <Button type="button" variant="secondary" onClick={refresh}>
              {t("workspaceWidget.retry")}
            </Button>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="rrp-application-workspace-widget__footer">
            <p className="rrp-application-workspace-widget__copy">
              {t("workspaceWidget.invitation")}
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => openModal({ intent: "create" })}
            >
              {t("workspaceWidget.create")}
            </Button>
          </div>
        ) : null}

        {!loading && !error && orderedApplications.length > 0 ? (
          <div className="rrp-application-workspace-widget__section">
            <h3
              id={historyHeadingId}
              className="rrp-application-workspace-widget__section-title"
            >
              {t("workspaceWidget.historyHeading")}
            </h3>
            <div
              className="rrp-application-workspace-widget__history"
              data-history-scroll={historyScrollable ? "true" : "false"}
              tabIndex={historyScrollable ? 0 : undefined}
              aria-labelledby={historyHeadingId}
            >
              <ul className="rrp-application-workspace-widget__list">
                {orderedApplications.map(renderApplicationRow)}
              </ul>
            </div>
          </div>
        ) : null}

        {!loading && !error && applications.length > 0 ? (
          <div className="rrp-application-workspace-widget__footer">
            <Button
              type="button"
              variant="primary"
              onClick={() => openModal({ intent: "create" })}
            >
              {t("workspaceWidget.newApplication")}
            </Button>
          </div>
        ) : null}
      </section>

      <RrpApplicationModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        initialApplicationId={modalApplicationId}
        initialIntent={modalIntent}
        onApplicationsChanged={refresh}
      />
    </>
  );
}
