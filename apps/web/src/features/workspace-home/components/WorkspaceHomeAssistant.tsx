"use client";

import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";
import { RrpApplicationWorkspaceWidget } from "../../regional-program/components/RrpApplicationWorkspaceWidget";
import { isRrpApplicationEntryEnabled } from "../../regional-program/rrp-application-entry";
import type { WorkspaceHomeAssistantContext } from "../workspace-home-api";

import "./workspace-home-assistant.css";

interface WorkspaceHomeAssistantProps {
  context: WorkspaceHomeAssistantContext | null;
}

/**
 * Pack 04 — Workspace Home right rail is the canonical Assistant Widget.
 * Widget copy comes from WEB_UI (`initiativeExperience.assistant.entry.widgetCopy.*`)
 * via Brand `siteName` — never hardcoded English `description` overrides.
 *
 * HU-RRP-02D.1 — when the RRP entry flag is ON, My Regional Applications
 * mounts as the next sibling under the Assistant (same rail, no second sidebar).
 */
export function WorkspaceHomeAssistant(_props: WorkspaceHomeAssistantProps) {
  return (
    <div className="workspace-home-assistant-rail">
      <HumanityUnionAssistantWidget surfaceId="workspace" />
      {isRrpApplicationEntryEnabled() ? <RrpApplicationWorkspaceWidget /> : null}
    </div>
  );
}
