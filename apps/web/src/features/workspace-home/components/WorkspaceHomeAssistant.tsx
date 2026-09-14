"use client";

import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";
import type { WorkspaceHomeAssistantContext } from "../workspace-home-api";

import "./workspace-home-assistant.css";

interface WorkspaceHomeAssistantProps {
  context: WorkspaceHomeAssistantContext | null;
}

/**
 * Pack 04 — Workspace Home right rail is the canonical Assistant Widget.
 * Widget copy comes from WEB_UI (`initiativeExperience.assistant.entry.widgetCopy.*`)
 * via Brand `siteName` — never hardcoded English `description` overrides.
 */
export function WorkspaceHomeAssistant(_props: WorkspaceHomeAssistantProps) {
  return (
    <div className="workspace-home-assistant-rail">
      <HumanityUnionAssistantWidget surfaceId="workspace" />
    </div>
  );
}
