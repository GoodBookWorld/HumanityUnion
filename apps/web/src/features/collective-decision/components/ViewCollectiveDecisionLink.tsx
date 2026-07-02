"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCollectiveDecisionByInitiativeId } from "../api";

import "./view-collective-decision-link.css";

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
    return <p className="view-collective-decision-link__empty">Select an initiative first.</p>;
  }

  if (loading) {
    return <p className="view-collective-decision-link__empty">Loading collective decision...</p>;
  }

  if (!decisionId) {
    return (
      <p className="view-collective-decision-link__empty">
        No collective decision is linked to this initiative.
      </p>
    );
  }

  return (
    <Link
      className="view-collective-decision-link"
      href={`/collective-decisions/${encodeURIComponent(decisionId)}`}
    >
      Open Collective Decision Workspace
    </Link>
  );
}
