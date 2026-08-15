"use client";

import { useEffect, useState } from "react";

import type { InitiativePublicImpactLifecycleDraft } from "@hu/types";

import { getInitiativePublicImpactWorkspace } from "../api";
import { InitiativePublicImpactReportRenderer } from "./InitiativePublicImpactReportRenderer";

import "./initiative-public-impact-stage-workspace.css";

export function InitiativePublicImpactDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const [draft, setDraft] = useState<InitiativePublicImpactLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativePublicImpactWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError("Draft preview could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (error) {
    return <p className="ipi-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="ipi-source-panel__empty">Loading Public Impact draft preview…</p>;
  }

  return (
    <InitiativePublicImpactReportRenderer
      title={draft.title}
      sections={draft.sections}
      participationStatistics={draft.participationStatistics}
      metaLabel="Preview — unpublished draft (same renderer as Public)"
    />
  );
}
