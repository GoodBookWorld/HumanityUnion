"use client";

import { useEffect, useState } from "react";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { getCollectiveDecisionByInitiativeId } from "../api";

interface ViewCollectiveDecisionLinkProps {
  initiativeId: string | null;
}

export function ViewCollectiveDecisionLink({ initiativeId }: ViewCollectiveDecisionLinkProps) {
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initiativeId) {
      setDecisionId(null);
      return;
    }

    let cancelled = false;

    async function loadDecisionLink() {
      setLoading(true);
      const currentInitiativeId = initiativeId;

      if (!currentInitiativeId) {
        setLoading(false);
        return;
      }

      try {
        const decision = await getCollectiveDecisionByInitiativeId(currentInitiativeId);
        if (!cancelled) {
          setDecisionId(decision.decisionId);
        }
      } catch {
        if (!cancelled) {
          setDecisionId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDecisionLink();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (!initiativeId) {
    return (
      <WorkspaceEmptyState
        title="No initiative selected"
        explanation="Select an initiative to open its collective decision workspace."
        nextStep="Choose an initiative from My Initiatives."
      />
    );
  }

  if (loading) {
    return <WorkspaceLoadingState message="Loading collective decision..." />;
  }

  if (!decisionId) {
    return (
      <WorkspaceEmptyState
        title="No collective decision is linked yet"
        explanation="This initiative does not have an opened collective decision record."
        nextStep="Publish a decision session, then open collective decision voting."
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/collective-decisions/${encodeURIComponent(decisionId)}`}
      label="View Collective Decision"
    />
  );
}
