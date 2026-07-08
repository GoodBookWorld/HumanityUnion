"use client";

import { ApiUnavailableState } from "../../../design-system";
import { WorkspaceCivicAssistant } from "../../workspace-civic-assistant/components/WorkspaceCivicAssistant";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { useWorkspaceSectionTracker } from "../../workspace-civic-assistant/use-workspace-section-tracker";

import "./initiative-workspace-layout.css";

export function InitiativesUnavailableWorkspace() {
  const currentSection = useWorkspaceSectionTracker(INITIATIVE_WORKSPACE_SECTIONS);

  return (
    <div className="initiative-workspace-layout">
      <div className="initiative-workspace-layout__content initiative-workspace-layout__content--unavailable">
        <div className="workspace-unavailable-center">
          <ApiUnavailableState
            title="Workspace temporarily unavailable"
            explanation="We couldn't connect to the Initiative service. Please try again shortly."
            retryHref="/initiatives"
            retryLabel="Retry"
            homeLabel="Return Home"
          />
        </div>
      </div>
      <WorkspaceCivicAssistant initiative={null} currentSection={currentSection} />
    </div>
  );
}
