"use client";

import type { ComponentProps, ReactNode } from "react";

import type {
  CommunityInitiativeRelationshipProjection,
  PublicInitiativeSupportStatistics as PublicInitiativeSupportStatisticsModel,
  PublicInitiativeWithVersionHistory,
  WorldInitiativeCardProjection,
} from "@hu/types";

import { RelatedInitiativesWidget } from "../../community-intelligence/components/RelatedInitiativesWidget";
import { InitiativeActiveAlliesWidget } from "../../initiative-active-allies/components/InitiativeActiveAlliesWidget";
import { PublicInitiativeLatestInitiatives } from "./PublicInitiativeLatestInitiatives";
import { PublicInitiativeRevisionHistory } from "./PublicInitiativeRevisionHistory";
import { PublicInitiativeSupportStatistics } from "./PublicInitiativeSupportStatistics";

interface PublicExperienceSidebarProps {
  initiativeId: string;
  supportLabel?: string;
  statistics: PublicInitiativeSupportStatisticsModel;
  revisionHistory: PublicInitiativeWithVersionHistory;
  latestInitiatives: WorldInitiativeCardProjection[];
  relatedInitiatives?: readonly CommunityInitiativeRelationshipProjection[];
  onSignalChange: ComponentProps<typeof PublicInitiativeSupportStatistics>["onSignalChange"];
  onBookmarkToggle: () => void;
  onRevisionSelect: (version: number) => void;
  supportBusy?: boolean;
  latestInitiativesSlot?: ReactNode;
}

export function PublicExperienceSidebar({
  initiativeId,
  supportLabel = "Initiative Support",
  statistics,
  revisionHistory,
  latestInitiatives,
  relatedInitiatives = [],
  onSignalChange,
  onBookmarkToggle,
  onRevisionSelect,
  supportBusy = false,
  latestInitiativesSlot,
}: PublicExperienceSidebarProps) {
  return (
    <>
      <PublicInitiativeSupportStatistics
        statistics={statistics}
        onSignalChange={onSignalChange}
        onBookmarkToggle={onBookmarkToggle}
        busy={supportBusy}
        title={supportLabel}
      />
      {/*
       * Communication UX Pack 03.3 Part 6 — placed right after Initiative
       * Support. This is the one sidebar shared by every lifecycle-stage
       * view of the single Initiative page (the base Initiative stage, the
       * Author's Manage/Analysis working tabs, and the Collaborative
       * Analysis public record view), so it is a working team tool that
       * stays visible across the whole lifecycle without any per-stage
       * duplication.
       */}
      <InitiativeActiveAlliesWidget
        initiativeId={initiativeId}
        reviewCollaborationRequestsHref={`/initiatives/public/${encodeURIComponent(initiativeId)}?filter=collaboration#discussion`}
      />
      <PublicInitiativeRevisionHistory
        initiativeId={initiativeId}
        history={revisionHistory}
        onRevisionSelect={onRevisionSelect}
      />
      <RelatedInitiativesWidget items={relatedInitiatives} />
      {latestInitiativesSlot ?? (
        <PublicInitiativeLatestInitiatives initiatives={latestInitiatives} />
      )}
    </>
  );
}
