"use client";

import { useEffect, useState } from "react";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { getPetitionByCollectiveDecisionId, getPetitionByInitiativeId } from "../api";

interface ViewPetitionLinkProps {
  collectiveDecisionId?: string | null;
  initiativeId?: string | null;
}

export function ViewPetitionLink({
  collectiveDecisionId = null,
  initiativeId = null,
}: ViewPetitionLinkProps) {
  const [petitionId, setPetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collectiveDecisionId && !initiativeId) {
      setPetitionId(null);
      return;
    }

    let cancelled = false;

    async function loadPetitionLink() {
      setLoading(true);

      try {
        const petition = collectiveDecisionId
          ? await getPetitionByCollectiveDecisionId(collectiveDecisionId)
          : initiativeId
            ? await getPetitionByInitiativeId(initiativeId)
            : null;

        if (!cancelled) {
          setPetitionId(petition?.petitionId ?? null);
        }
      } catch {
        if (!cancelled) {
          setPetitionId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPetitionLink();

    return () => {
      cancelled = true;
    };
  }, [collectiveDecisionId, initiativeId]);

  if (!collectiveDecisionId && !initiativeId) {
    return (
      <WorkspaceEmptyState
        title="No petition reference is available"
        explanation="A petition link appears when a collective decision or initiative petition exists."
        nextStep="Continue civic participation stages that create a petition record."
      />
    );
  }

  if (loading) {
    return <WorkspaceLoadingState message="Loading petition..." />;
  }

  if (!petitionId) {
    return (
      <WorkspaceEmptyState
        title="No petition is linked yet"
        explanation="This participation stage does not have a linked petition record."
        nextStep="Open or close a collective decision to create petition participation."
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/petitions/${encodeURIComponent(petitionId)}`}
      label="View Petition"
    />
  );
}
