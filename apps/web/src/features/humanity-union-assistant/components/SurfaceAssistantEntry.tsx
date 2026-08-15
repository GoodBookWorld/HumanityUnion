"use client";

import type { HumanityUnionAssistantSurfaceId } from "@hu/types";

import { HumanityUnionAssistantOpenButton } from "./HumanityUnionAssistantOpenButton";

/**
 * Compact entry point for non-Lifecycle surfaces that share the one Assistant.
 */
export function SurfaceAssistantEntry({
  surfaceId,
  label = "Open Humanity Union Assistant",
}: {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly label?: string;
}) {
  return (
    <div className="hu-assistant-surface-entry">
      <HumanityUnionAssistantOpenButton surfaceId={surfaceId} label={label} />
    </div>
  );
}
