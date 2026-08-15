"use client";

import { useCallback, useEffect, useState } from "react";

import type { MyInitiativeGroupSummary } from "@hu/types";

import { isAuthenticationRequiredError, ApiRequestError } from "../../../lib/api-client";
import type { CollaborationTab } from "../../public-initiative-experience/components/InitiativeCollaborationWorkspace";
import { InitiativeCollaborationWorkspace } from "../../public-initiative-experience/components/InitiativeCollaborationWorkspace";
import { listMyInitiativeGroups } from "../api";
import { canScheduleSessionsForGroup } from "../initiative-group-chat-format";

import { InitiativeGroupList } from "./InitiativeGroupList";
import { InitiativeGroupSessionQuickForm } from "./InitiativeGroupSessionQuickForm";
import { InitiativeGroupTeamPanel } from "./InitiativeGroupTeamPanel";
import "./initiative-group-chat.css";

interface InitiativeGroupChatWorkspaceProps {
  initiativeId: string | null;
  section: CollaborationTab;
  onSelectInitiative: (initiativeId: string) => void;
  onSectionChange: (section: CollaborationTab) => void;
}

type LoadState = "loading" | "ready" | "unauthenticated" | "error";

/**
 * Communication UX Pack 03.9 — Initiative Group Chat mode for Workspace
 * Messages. Builds its own two-column layout (central Collaboration
 * surface + sidebar) so it can be mounted as `MemberWorkspace`'s full-width
 * `children` in Group mode, leaving Personal Chat's `assistant` (Active
 * Allies) slot untouched and independent (Part 1: "two clear modes").
 *
 * Everything here is reused, never reinvented: the central area is the
 * exact same `InitiativeCollaborationWorkspace` (Channel/Sessions tabs)
 * the public Initiative page already uses, and the Team roster reuses the
 * same Active Allies projection the Channel's own participants list reads.
 */
export function InitiativeGroupChatWorkspace({
  initiativeId,
  section,
  onSelectInitiative,
  onSectionChange,
}: InitiativeGroupChatWorkspaceProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [groups, setGroups] = useState<MyInitiativeGroupSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoadState("loading");

    try {
      const loaded = await listMyInitiativeGroups();
      setGroups(loaded);
      setLoadState("ready");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setLoadState("unauthenticated");
        return;
      }

      setErrorMessage(
        error instanceof ApiRequestError
          ? error.message
          : "Unable to load your Initiative Groups. Please try again.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  // Part 4 — land on the first eligible Initiative when none is selected
  // yet (e.g. a first visit to Group mode with no deep-link initiativeId).
  useEffect(() => {
    if (loadState !== "ready" || initiativeId) {
      return;
    }

    const first = groups[0];

    if (first) {
      onSelectInitiative(first.initiativeId);
    }
  }, [loadState, groups, initiativeId, onSelectInitiative]);

  const selectedGroup = groups.find((group) => group.initiativeId === initiativeId) ?? null;
  const canScheduleSessions = canScheduleSessionsForGroup(selectedGroup);

  if (loadState === "unauthenticated") {
    return (
      <div className="igc-workspace igc-workspace--empty">
        <p className="igc-workspace__empty-title">Sign in to view your Initiative Groups.</p>
      </div>
    );
  }

  return (
    <div className="igc-workspace">
      <div className="igc-workspace__main">
        {loadState === "loading" ? (
          <p className="igc-workspace__status" role="status">
            Loading your Initiative Groups…
          </p>
        ) : loadState === "error" ? (
          <p className="igc-workspace__status igc-workspace__status--error" role="alert">
            {errorMessage}
          </p>
        ) : groups.length === 0 ? (
          <div className="igc-workspace__empty-state">
            <p className="igc-workspace__empty-title">No Initiative Groups yet.</p>
            <p className="igc-workspace__empty-text">
              You will see an Initiative Group Chat here once you author an Initiative or become an active
              Ally on one.
            </p>
          </div>
        ) : selectedGroup ? (
          <InitiativeCollaborationWorkspace
            key={selectedGroup.initiativeId}
            initiativeId={selectedGroup.initiativeId}
            initialTab={section}
          />
        ) : (
          <div className="igc-workspace__empty-state">
            <p className="igc-workspace__empty-title">Select an Initiative Group</p>
            <p className="igc-workspace__empty-text">
              Choose an Initiative from the list to open its Collaboration Channel.
            </p>
          </div>
        )}
      </div>

      <aside className="igc-workspace__sidebar" aria-label="Initiative Group Chat sidebar">
        <InitiativeGroupList
          groups={groups}
          selectedInitiativeId={initiativeId}
          onSelect={onSelectInitiative}
        />
        {selectedGroup ? <InitiativeGroupTeamPanel initiativeId={selectedGroup.initiativeId} /> : null}
        {selectedGroup && canScheduleSessions ? (
          <InitiativeGroupSessionQuickForm
            initiativeId={selectedGroup.initiativeId}
            onScheduled={() => onSectionChange("sessions")}
          />
        ) : null}
      </aside>
    </div>
  );
}
