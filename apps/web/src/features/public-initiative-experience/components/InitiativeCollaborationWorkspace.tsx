"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { InitiativeCollaborationChannel } from "../../initiative-collaboration-channel/components/InitiativeCollaborationChannel";
import { InitiativeCollaborationSessionsPanel } from "../../initiative-collaboration-sessions/components/InitiativeCollaborationSessionsPanel";

import "./initiative-collaboration-workspace.css";

export type CollaborationTab = "channel" | "sessions";

interface InitiativeCollaborationWorkspaceProps {
  initiativeId: string;
  /**
   * Communication UX Pack 03.7 Part 10 — a Shared Document notification's
   * `relatedUrl` deep-links to `#collaboration-channel` /
   * `#collaboration-sessions`; this lets `PublicInitiativeExperiencePage`
   * land the viewer directly on the right tab instead of always defaulting
   * to Channel.
   */
  initialTab?: CollaborationTab;
}

/**
 * Communication UX Pack 03.6 Part 1 — an Initiative's collaboration
 * surface has two siblings, Collaboration Channel and Collaboration
 * Sessions (the same Author/Active-Ally-only working area introduced by
 * Communication UX Pack 03.5's `PublicExperienceSidebarOrChannel` sidebar
 * swap). This keeps that one sidebar-slot decision point unchanged and
 * simply gives it a second tab, rather than adding a second swap point or
 * a new page/route.
 */
export function InitiativeCollaborationWorkspace({ initiativeId, initialTab }: InitiativeCollaborationWorkspaceProps) {
  const t = useTranslations("initiativeExperience");
  const [activeTab, setActiveTab] = useState<CollaborationTab>(initialTab ?? "channel");

  // A notification deep link can arrive while this Workspace is already
  // mounted (e.g. the viewer is already on the Sessions tab when a Channel
  // upload notification fires); re-apply the requested tab whenever it
  // changes, not just on first mount.
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="icw-workspace">
      <div className="icw-tabs" role="tablist" aria-label={t("collaboration.workspace.aria")}>
        <button
          type="button"
          role="tab"
          id="icw-tab-channel"
          aria-selected={activeTab === "channel"}
          aria-controls="icw-tabpanel-channel"
          className={`icw-tab${activeTab === "channel" ? " icw-tab--active" : ""}`}
          onClick={() => setActiveTab("channel")}
        >
          {t("collaboration.workspace.channel")}
        </button>
        <button
          type="button"
          role="tab"
          id="icw-tab-sessions"
          aria-selected={activeTab === "sessions"}
          aria-controls="icw-tabpanel-sessions"
          className={`icw-tab${activeTab === "sessions" ? " icw-tab--active" : ""}`}
          onClick={() => setActiveTab("sessions")}
        >
          {t("collaboration.workspace.sessions")}
        </button>
      </div>

      <div
        id="icw-tabpanel-channel"
        role="tabpanel"
        aria-labelledby="icw-tab-channel"
        hidden={activeTab !== "channel"}
      >
        {activeTab === "channel" ? <InitiativeCollaborationChannel initiativeId={initiativeId} /> : null}
      </div>

      <div
        id="icw-tabpanel-sessions"
        role="tabpanel"
        aria-labelledby="icw-tab-sessions"
        hidden={activeTab !== "sessions"}
      >
        {activeTab === "sessions" ? <InitiativeCollaborationSessionsPanel initiativeId={initiativeId} /> : null}
      </div>
    </div>
  );
}
