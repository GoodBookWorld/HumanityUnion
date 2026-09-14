"use client";

import type { Initiative } from "@hu/types";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("initiativeExperience");
  return (
    <main className="pie-page initiative-owner-studio">
      <header className="initiative-owner-studio__draft-hero">
        <p className="initiative-owner-studio__draft-label">{t("common.draftOwnerOnly")}</p>
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
