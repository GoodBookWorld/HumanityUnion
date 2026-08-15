"use client";

import type { ReactNode } from "react";

import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";

import "./initiative-workspace-layout.css";

interface InitiativesUnavailableWorkspaceProps {
  children: ReactNode;
}

export function InitiativesUnavailableWorkspace({
  children,
}: InitiativesUnavailableWorkspaceProps) {
  return (
    <div className="initiative-workspace-layout">
      <div className="initiative-workspace-layout__content initiative-workspace-layout__content--unavailable">
        <div className="workspace-unavailable-center">{children}</div>
      </div>
      <HumanityUnionAssistantWidget
        surfaceId="initiatives"
        description="I can help you create, review and advance your Initiatives."
      />
    </div>
  );
}
