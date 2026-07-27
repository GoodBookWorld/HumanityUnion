"use client";

import type { Initiative } from "@hu/types";

import { InitiativeOwnerManagePanel } from "./InitiativeOwnerManagePanel";

import "../initiative-owner-studio.css";

interface InitiativeOwnerDraftShellProps {
  initiative: Initiative;
  onInitiativeUpdated: (initiative: Initiative) => void;
}

export function InitiativeOwnerDraftShell({
  initiative,
  onInitiativeUpdated,
}: InitiativeOwnerDraftShellProps) {
  return (
    <main className="pie-page initiative-owner-studio">
      <header className="initiative-owner-studio__draft-hero">
        <p className="initiative-owner-studio__draft-label">Draft initiative — owner access only</p>
        <h1>{initiative.title}</h1>
        <p>{initiative.description}</p>
      </header>
      <InitiativeOwnerManagePanel
        initiative={initiative}
        onInitiativeUpdated={onInitiativeUpdated}
      />
    </main>
  );
}
