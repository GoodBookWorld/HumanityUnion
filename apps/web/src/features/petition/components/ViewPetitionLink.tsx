"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPetitionByCollectiveDecisionId, getPetitionByInitiativeId } from "../api";

import "./view-petition-link.css";

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
    return <p className="view-petition-link__empty">No petition reference is available.</p>;
  }

  if (loading) {
    return <p className="view-petition-link__empty">Loading petition...</p>;
  }

  if (!petitionId) {
    return (
      <p className="view-petition-link__empty">
        No petition is linked to this participation stage yet.
      </p>
    );
  }

  return (
    <Link
      className="view-petition-link"
      href={`/petitions/${encodeURIComponent(petitionId)}`}
    >
      Open Petition Workspace
    </Link>
  );
}
