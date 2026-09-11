"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { MyInitiativeGroupSummary } from "@hu/types";

import { resolveLifecyclePhaseDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { filterInitiativeGroupsByTitle } from "../initiative-group-chat-format";

interface InitiativeGroupListProps {
  groups: MyInitiativeGroupSummary[];
  selectedInitiativeId: string | null;
  onSelect: (initiativeId: string) => void;
}

/**
 * Communication UX Pack 03.9 Part 4 — the "My Initiative Groups" search +
 * list. Client-side filtering only (the list is already scoped to the
 * signed-in Participant's own Initiatives by the backend, so there is never
 * a large enough result set to justify a server-side search round trip).
 */
export function InitiativeGroupList({ groups, selectedInitiativeId, onSelect }: InitiativeGroupListProps) {
  const t = useTranslations("workspace.messagesPage.group");
  const tExperience = useTranslations("initiativeExperience");
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => filterInitiativeGroupsByTitle(groups, query), [groups, query]);

  const roleLabel = (role: MyInitiativeGroupSummary["role"]) =>
    role === "author" ? t("author") : t("activeAlly");

  return (
    <div className="igc-group-list">
      <h3 className="igc-group-list__title">{t("myGroups")}</h3>
      <label htmlFor="igc-group-search" className="igc-group-list__search-label">
        {t("searchLabel")}
      </label>
      <input
        id="igc-group-search"
        type="search"
        className="hu-form-control igc-group-list__search-input"
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {groups.length === 0 ? (
        <p className="igc-group-list__empty">{t("emptyNoRole")}</p>
      ) : filteredGroups.length === 0 ? (
        <p className="igc-group-list__empty">{t("noMatch", { query })}</p>
      ) : (
        <ul className="igc-group-list__items">
          {filteredGroups.map((group) => (
            <li key={group.initiativeId}>
              <button
                type="button"
                className={`igc-group-list__item${
                  group.initiativeId === selectedInitiativeId ? " igc-group-list__item--selected" : ""
                }`}
                aria-pressed={group.initiativeId === selectedInitiativeId}
                onClick={() => onSelect(group.initiativeId)}
              >
                <span className="igc-group-list__item-title">{group.title}</span>
                <span className="igc-group-list__item-meta">
                  <span className="igc-group-list__item-role">{roleLabel(group.role)}</span>
                  <span className="igc-group-list__item-phase">
                    {resolveLifecyclePhaseDisplayLabel(group.lifecyclePhase, tExperience)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
