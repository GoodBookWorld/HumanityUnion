"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { AdminParticipantDirectoryItem } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { listAdminParticipants } from "../../administration/admin-participant-directory-api";
import { useOpenDirectConversation } from "../use-open-direct-conversation";

import "./active-allies-panel.css";
import "./admin-all-participants-panel.css";

const PAGE_SIZE = 25;

function participantPrimaryName(row: AdminParticipantDirectoryItem): string {
  return row.profileDisplayName || row.displayName || row.publicName || row.email;
}

function participantSecondaryName(row: AdminParticipantDirectoryItem): string | null {
  if (row.publicName && row.publicName !== participantPrimaryName(row)) {
    return `@${row.publicName}`;
  }
  return null;
}

export type AdminAllParticipantsPanelState = "loading" | "ready" | "error";

interface AdminAllParticipantsPanelProps {
  /** Current Admin's participantId (memberId) — excluded from the directory. */
  selfParticipantId: string;
  activeParticipantId?: string;
  onPrepareInitiativeGroupChat: () => void;
}

/**
 * Pack 26B — Admin-only Messages sidebar: searchable, paginated Participant
 * directory (reuses Admin Participant directory API). Selection:
 * 1 → Personal Chat; 2+ → Initiative Group Chat preparation.
 */
export function AdminAllParticipantsPanel({
  selfParticipantId,
  activeParticipantId,
  onPrepareInitiativeGroupChat,
}: AdminAllParticipantsPanelProps) {
  const t = useTranslations("workspace.messagesPage.admin");
  const tMessaging = useTranslations("participantPublic.messaging");
  const searchInputId = useId();
  const selectAllId = useId();
  const selectedCountId = useId();

  const [state, setState] = useState<AdminAllParticipantsPanelState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<readonly AdminParticipantDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  const { isOpening, errorMessage: openError, openConversation } = useOpenDirectConversation();

  const loadPage = useCallback(async (nextOffset: number, search: string) => {
    setState("loading");
    setErrorMessage(null);

    try {
      const response = await listAdminParticipants({
        status: "active",
        search: search || undefined,
        sort: "createdAt",
        order: "desc",
        limit: PAGE_SIZE,
        offset: nextOffset,
      });

      const filtered = response.participants.filter(
        (row) => row.memberId !== selfParticipantId && row.status === "active",
      );

      setRows(filtered);
      setTotal(response.total);
      setOffset(nextOffset);
      setState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("loadError"));
      setRows([]);
      setTotal(0);
      setState("error");
    }
  }, [selfParticipantId, t]);

  useEffect(() => {
    void loadPage(0, appliedSearch);
  }, [appliedSearch, loadPage]);

  const pageIds = useMemo(() => rows.map((row) => row.memberId), [rows]);
  const selectedOnPageCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const somePageSelected = selectedOnPageCount > 0 && !allPageSelected;
  const selectedCount = selectedIds.size;

  function applySearch() {
    setAppliedSearch(searchInput.trim());
    setOffset(0);
  }

  function toggleSelectAllCurrentPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleRow(participantId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }

  function openPersonalChat() {
    if (selectedCount !== 1) {
      return;
    }
    const [participantId] = selectedIds;
    if (!participantId) {
      return;
    }
    openConversation({ participantId });
  }

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <aside className="active-allies-panel admin-all-participants-panel" aria-label={t("title")}>
      <div className="active-allies-panel__sticky">
        <div className="active-allies-panel__panel admin-all-participants-panel__panel">
          <header className="active-allies-panel__header">
            <h2 className="active-allies-panel__title">{t("title")}</h2>
            {state === "ready" && total > 0 ? (
              <span className="active-allies-panel__count">{t("listed", { count: total })}</span>
            ) : null}
          </header>

          <div className="active-allies-panel__search">
            <label htmlFor={searchInputId} className="active-allies-panel__visually-hidden">
              {t("searchLabel")}
            </label>
            <input
              id={searchInputId}
              type="search"
              className="active-allies-panel__search-input"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
            <button
              type="button"
              className="hu-button hu-button--secondary admin-all-participants-panel__search-button"
              onClick={applySearch}
            >
              {t("search")}
            </button>
          </div>

          <p id={selectedCountId} className="admin-all-participants-panel__selected" role="status">
            {selectedCount === 0
              ? t("empty")
              : selectedCount === 1
                ? t("selectedOne")
                : t("selectedMany", { count: selectedCount })}
          </p>

          <div className="admin-all-participants-panel__toolbar">
            <label className="admin-all-participants-panel__select-all" htmlFor={selectAllId}>
              <input
                id={selectAllId}
                type="checkbox"
                checked={allPageSelected}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = somePageSelected;
                  }
                }}
                onChange={toggleSelectAllCurrentPage}
                disabled={pageIds.length === 0}
              />
              <span>{t("selectAllPage")}</span>
            </label>
          </div>

          <div className="admin-all-participants-panel__actions">
            <button
              type="button"
              className="hu-button hu-button--primary"
              disabled={selectedCount !== 1 || isOpening}
              onClick={openPersonalChat}
            >
              {isOpening ? tMessaging("opening") : t("openChat")}
            </button>
            <button
              type="button"
              className="hu-button hu-button--secondary"
              disabled={selectedCount < 2}
              onClick={onPrepareInitiativeGroupChat}
            >
              {t("prepareGroupChat")}
            </button>
          </div>

          {openError ? (
            <p className="active-allies-panel__status active-allies-panel__status--error" role="alert">
              {openError}
            </p>
          ) : null}

          {state === "loading" ? (
            <p className="active-allies-panel__status" role="status">
              {t("loading")}
            </p>
          ) : null}

          {state === "error" ? (
            <p className="active-allies-panel__status active-allies-panel__status--error">{errorMessage}</p>
          ) : null}

          {state === "ready" && rows.length === 0 ? (
            <p className="active-allies-panel__status">{t("noMatch")}</p>
          ) : null}

          {state === "ready" && rows.length > 0 ? (
            <ul
              className="active-allies-panel__list admin-all-participants-panel__list"
              aria-label={t("title")}
              aria-describedby={selectedCountId}
            >
              {rows.map((row) => {
                const checkboxId = `admin-dm-participant-${row.memberId}`;
                const name = participantPrimaryName(row);
                const secondary = participantSecondaryName(row);
                const isActive = row.memberId === activeParticipantId;
                const checked = selectedIds.has(row.memberId);

                return (
                  <li
                    key={row.memberId}
                    className={`active-allies-panel__card${isActive ? " active-allies-panel__card--active" : ""}`}
                  >
                    <label className="admin-all-participants-panel__row" htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(row.memberId)}
                        aria-label={t("selectAria", { name })}
                      />
                      <HumanityAvatar
                        className="active-allies-panel__avatar"
                        avatarUrl={row.avatarUrl}
                        size={36}
                        alt=""
                      />
                      <span className="admin-all-participants-panel__identity-text">
                        <span className="active-allies-panel__name">{name}</span>
                        {secondary ? (
                          <span className="admin-all-participants-panel__public-name">{secondary}</span>
                        ) : null}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="active-allies-panel__message-button"
                      disabled={isOpening}
                      aria-label={tMessaging("messageAria", { name })}
                      onClick={() => openConversation({ participantId: row.memberId })}
                    >
                      <span className="active-allies-panel__message-label">
                        {isOpening ? tMessaging("opening") : tMessaging("message")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {state === "ready" && total > PAGE_SIZE ? (
            <div className="admin-all-participants-panel__pagination">
              <button
                type="button"
                className="hu-button hu-button--secondary"
                disabled={!canPrev || state !== "ready"}
                onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE), appliedSearch)}
              >
                {t("previous")}
              </button>
              <button
                type="button"
                className="hu-button hu-button--secondary"
                disabled={!canNext || state !== "ready"}
                onClick={() => void loadPage(offset + PAGE_SIZE, appliedSearch)}
              >
                {t("next")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
