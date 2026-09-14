"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  WorkspaceEmptyState,
  WorkspaceLoadingState,
  WorkspacePublicLink,
} from "../../initiative-workspace-ux";
import { getCollectiveDecisionByInitiativeId } from "../api";

interface ViewCollectiveDecisionLinkProps {
  initiativeId: string | null;
  /** Localized link label; defaults to catalog English for callers outside Manage. */
  label?: string;
}

export function ViewCollectiveDecisionLink({
  initiativeId,
  label,
}: ViewCollectiveDecisionLinkProps) {
  const t = useTranslations("initiativeExperience");
  const resolvedLabel = label ?? t("manage.links.viewCollectiveDecision");
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
          setDecisionId(decision?.decisionId ?? null);
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
        title={t("manage.links.collectiveDecisionNoInitiativeTitle")}
        explanation={t("manage.links.collectiveDecisionNoInitiativeExplanation")}
        nextStep={t("manage.links.collectiveDecisionNoInitiativeNext")}
      />
    );
  }

  if (loading) {
    return <WorkspaceLoadingState message={t("manage.links.collectiveDecisionLoading")} />;
  }

  if (!decisionId) {
    return (
      <WorkspaceEmptyState
        title={t("manage.links.collectiveDecisionEmptyTitle")}
        explanation={t("manage.links.collectiveDecisionEmptyExplanation")}
        nextStep={t("manage.links.collectiveDecisionEmptyNext")}
      />
    );
  }

  return (
    <WorkspacePublicLink
      href={`/collective-decisions/${encodeURIComponent(decisionId)}`}
      label={resolvedLabel}
    />
  );
}
