"use client";

import { useEffect, useState } from "react";

import { useWorkspaceIntelligence } from "../../workspace-civic-assistant/use-workspace-intelligence";
import { WorkspaceIntelligencePanel } from "../../workspace-civic-assistant/components/WorkspaceIntelligencePanel";
import {
  isAssistantOpenPreference,
  setAssistantOpenPreference,
} from "../workspace-preferences-store";
import type { WorkspaceHomeAssistantContext } from "../workspace-home-api";

import "../../workspace-civic-assistant/components/workspace-civic-assistant.css";
import "./workspace-home-assistant.css";

interface WorkspaceHomeAssistantProps {
  context: WorkspaceHomeAssistantContext | null;
}

export function WorkspaceHomeAssistant({ context }: WorkspaceHomeAssistantProps) {
  const [mobileOpen, setMobileOpen] = useState(isAssistantOpenPreference());

  const { intelligence, loading, error } = useWorkspaceIntelligence({
    section: context?.currentSection ?? "Workspace Home",
  });

  useEffect(() => {
    setAssistantOpenPreference(mobileOpen);
  }, [mobileOpen]);

  const panel = (
    <WorkspaceIntelligencePanel
      sectionLabel={context?.currentSection ?? "Workspace Home"}
      participantName={context?.participantName}
      participationAreaLabel={context?.participationAreaLabel}
      intelligence={intelligence}
      loading={loading}
      error={error}
    />
  );

  return (
    <aside
      className={`workspace-civic-assistant ${mobileOpen ? "workspace-civic-assistant--open" : ""}`}
      aria-label="Civic assistant sidebar"
    >
      <button
        type="button"
        className="workspace-civic-assistant__toggle"
        aria-expanded={mobileOpen}
        aria-controls="workspace-home-assistant-panel"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? "Hide Civic Assistant" : "Open Civic Assistant"}
      </button>
      <div id="workspace-home-assistant-panel" className="workspace-civic-assistant__sticky">
        {panel}
      </div>
    </aside>
  );
}
