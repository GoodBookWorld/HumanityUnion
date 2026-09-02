"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { getPetitionByCollectiveDecisionId, getPetitionByInitiativeId } from "../api";

interface ViewPetitionLinkProps {
  collectiveDecisionId?: string | null;
  initiativeId?: string | null;
  /** Localized link label; defaults to catalog English for callers outside Manage. */
  label?: string;
}

export function ViewPetitionLink({
  collectiveDecisionId = null,
  initiativeId = null,
  label,
}: ViewPetitionLinkProps) {
  const t = useTranslations("initiativeExperience");
  const resolvedLabel = label ?? t("manage.links.viewPetition");
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
        title={t("manage.links.petitionUnavailableTitle")}
        explanation={t("manage.links.petitionUnavailableExplanation")}
        nextStep={t("manage.links.petitionUnavailableNext")}
      />
    );
  }

  if (loading) {
    return <WorkspaceLoadingState message={t("manage.links.petitionLoading")} />;
  }

  if (!petitionId) {
    return (
      <WorkspaceEmptyState
        title={t("manage.links.petitionEmptyTitle")}
        explanation={t("manage.links.petitionEmptyExplanation")}
        nextStep={t("manage.links.petitionEmptyNext")}
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/petitions/${encodeURIComponent(petitionId)}`}
      label={resolvedLabel}
    />
  );
}
