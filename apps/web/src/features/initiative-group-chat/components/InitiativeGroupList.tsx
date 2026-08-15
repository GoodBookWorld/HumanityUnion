"use client";

import { useMemo, useState } from "react";

import type { MyInitiativeGroupSummary } from "@hu/types";

import { INITIATIVE_LIFECYCLE_PHASE_LABELS } from "../../initiatives/initiative-lifecycle-labels";
import { filterInitiativeGroupsByTitle } from "../initiative-group-chat-format";

const ROLE_LABELS: Record<MyInitiativeGroupSummary["role"], string> = {
  author: "Author",
  active_ally: "Active Ally",
};

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
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => filterInitiativeGroupsByTitle(groups, query), [groups, query]);

  return (
    <div className="igc-group-list">
      <label htmlFor="igc-group-search" className="igc-group-list__search-label">
        Search your Initiatives
      </label>
      <input
        id="igc-group-search"
        type="search"
        className="hu-form-control igc-group-list__search-input"
        placeholder="Search by title…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {groups.length === 0 ? (
        <p className="igc-group-list__empty">
          You are not the Author or an active Ally on any Initiative yet.
        </p>
      ) : filteredGroups.length === 0 ? (
        <p className="igc-group-list__empty">No Initiative matches “{query}”.</p>
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
                  <span className="igc-group-list__item-role">{ROLE_LABELS[group.role]}</span>
                  <span className="igc-group-list__item-phase">
                    {INITIATIVE_LIFECYCLE_PHASE_LABELS[group.lifecyclePhase]}
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
