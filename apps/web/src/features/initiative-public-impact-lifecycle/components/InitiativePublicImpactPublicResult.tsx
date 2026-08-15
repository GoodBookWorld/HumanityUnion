"use client";

import { useEffect, useState } from "react";

import type { InitiativePublicImpactReport } from "@hu/types";

import { getPublishedInitiativePublicImpactReport } from "../api";
import { InitiativePublicImpactReportRenderer } from "./InitiativePublicImpactReportRenderer";

import "./initiative-public-impact-stage-workspace.css";

interface InitiativePublicImpactPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part L. Read-only for every viewer, including
 * the Initiative's Author — editing a published Report happens only via
 * a new Publish cycle, never here. Uses the shared Report renderer
 * (Part 12) also used by Draft Preview.
 */
export function InitiativePublicImpactPublicResult({
  initiativeId,
  isPreview = false,
}: InitiativePublicImpactPublicResultProps) {
  const [report, setReport] = useState<InitiativePublicImpactReport | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublishedInitiativePublicImpactReport(initiativeId);
        if (!cancelled) {
          setReport(result);
        }
      } catch {
        if (!cancelled) {
          setError("Published Public Impact Report could not be loaded.");
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

  if (report === undefined) {
    return <p className="ipi-source-panel__empty">Loading published Public Impact Report…</p>;
  }

  if (!report) {
    return <p className="ipi-source-panel__empty">No Public Impact Report published yet.</p>;
  }

  return (
    <InitiativePublicImpactReportRenderer
      title={report.title}
      sections={report.sections}
      participationStatistics={report.participationStatistics}
      metaLabel={isPreview ? "Author Preview of published Public Impact Report" : undefined}
    />
  );
}
