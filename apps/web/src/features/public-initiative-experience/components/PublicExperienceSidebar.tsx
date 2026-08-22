"use client";

import type { ComponentProps, ReactNode } from "react";

import type {
  CollectiveParticipationJourney,
  CommunityInitiativeRelationshipProjection,
  InitiativeLifecycleProfile,
  PublicInitiativeSupportStatistics as PublicInitiativeSupportStatisticsModel,
  PublicInitiativeWithVersionHistory,
  WorldInitiativeCardProjection,
} from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { RelatedInitiativesWidget } from "../../community-intelligence/components/RelatedInitiativesWidget";
import { InitiativeActiveAlliesWidget } from "../../initiative-active-allies/components/InitiativeActiveAlliesWidget";
import {
  publicChoiceSidebarAllows,
  resolvePublicChoiceSidebarAllowlist,
} from "../public-choice-sidebar-allowlist";
import { PublicChoiceElectionSidebarWidget } from "./PublicChoiceElectionSidebarWidget";
import { PublicInitiativeLatestInitiatives } from "./PublicInitiativeLatestInitiatives";
import { PublicInitiativeRevisionHistory } from "./PublicInitiativeRevisionHistory";
import { PublicInitiativeSupportStatistics } from "./PublicInitiativeSupportStatistics";
import { YourParticipationPanel } from "./YourParticipationPanel";

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
  /** Phase 05 — Collective Participation Journey (optional soft field). */
  participationJourney?: CollectiveParticipationJourney | null;
  viewerIsSteward?: boolean;
  /** Pack 02A — gates Election/Candidates widget (PUBLIC_CHOICE only). */
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  /** Pack 04 — reserved; Initiative Support hidden for all PUBLIC_CHOICE. */
  ballotMode?: string | null;
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
  participationJourney = null,
  viewerIsSteward = false,
  lifecycleProfile = null,
  ballotMode: _ballotMode = null,
}: PublicExperienceSidebarProps) {
  const authStatus = useClientAuthStatus();
  const authenticated = authStatus === "authenticated";
  const isPublicChoice =
    resolveInitiativeLifecycleProfile(lifecycleProfile) === "PUBLIC_CHOICE";

  if (isPublicChoice) {
    const allowlist = resolvePublicChoiceSidebarAllowlist({ authenticated });

    return (
      <>
        {publicChoiceSidebarAllows(allowlist, "candidates") ? (
          <PublicChoiceElectionSidebarWidget
            initiativeId={initiativeId}
            lifecycleProfile={lifecycleProfile}
          />
        ) : null}
        {publicChoiceSidebarAllows(allowlist, "your_participation") && participationJourney ? (
          <YourParticipationPanel
            journey={participationJourney}
            isAuthorPrimary={viewerIsSteward || participationJourney.viewerIsSteward}
          />
        ) : null}
        {publicChoiceSidebarAllows(allowlist, "related_initiatives") ? (
          <RelatedInitiativesWidget items={relatedInitiatives} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <PublicInitiativeSupportStatistics
        statistics={statistics}
        onSignalChange={onSignalChange}
        onBookmarkToggle={onBookmarkToggle}
        busy={supportBusy}
        title={supportLabel}
      />
      <PublicChoiceElectionSidebarWidget
        initiativeId={initiativeId}
        lifecycleProfile={lifecycleProfile}
      />
      {participationJourney ? (
        <YourParticipationPanel
          journey={participationJourney}
          isAuthorPrimary={viewerIsSteward || participationJourney.viewerIsSteward}
        />
      ) : null}
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
