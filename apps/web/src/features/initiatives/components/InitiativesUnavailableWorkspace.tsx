"use client";

import type { ReactNode } from "react";

import { WorkspaceCivicAssistant } from "../../workspace-civic-assistant/components/WorkspaceCivicAssistant";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { useWorkspaceSectionTracker } from "../../workspace-civic-assistant/use-workspace-section-tracker";

import "./initiative-workspace-layout.css";

interface InitiativesUnavailableWorkspaceProps {
  children: ReactNode;
}

export function InitiativesUnavailableWorkspace({
  children,
}: InitiativesUnavailableWorkspaceProps) {
  const currentSection = useWorkspaceSectionTracker(INITIATIVE_WORKSPACE_SECTIONS);

  return (
    <div className="initiative-workspace-layout">
      <div className="initiative-workspace-layout__content initiative-workspace-layout__content--unavailable">
        <div className="workspace-unavailable-center">{children}</div>
      </div>
      <WorkspaceCivicAssistant initiative={null} currentSection={currentSection} />
    </div>
  );
}
