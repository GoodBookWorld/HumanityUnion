"use client";

import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";
import type { WorkspaceHomeAssistantContext } from "../workspace-home-api";

import "./workspace-home-assistant.css";

interface WorkspaceHomeAssistantProps {
  context: WorkspaceHomeAssistantContext | null;
}

/**
 * Pack 04 — Workspace Home right rail is the canonical Assistant Widget.
 * Legacy Civic Assistant intelligence panel removed from this surface.
 */
export function WorkspaceHomeAssistant({ context }: WorkspaceHomeAssistantProps) {
  const section = context?.currentSection ?? "Workspace Home";
  const description =
    section.toLowerCase().includes("commitment")
      ? "I can help with responsibilities, resources and Implementation Commitments."
      : "I can help you understand your Workspace, priorities, notifications and next civic actions.";

  return (
    <div className="workspace-home-assistant-rail">
      <HumanityUnionAssistantWidget surfaceId="workspace" description={description} />
    </div>
  );
}
