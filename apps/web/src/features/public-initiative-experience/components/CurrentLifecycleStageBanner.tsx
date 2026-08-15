"use client";

import { useEffect, useState } from "react";

import type { InitiativeLifecycleStageMetadata } from "@hu/types";

import { getInitiativeLifecycleStageProjection } from "../../initiative-lifecycle-stage-workspace";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";

import "./current-lifecycle-stage-banner.css";

const STATUS_LABELS: Record<InitiativeLifecycleStageMetadata["presentationStatus"], string> = {
  not_started: "Not Started",
  draft: "Draft Saved",
  ready_for_review: "Preview",
  published: "Published",
  superseded: "Completed",
};

/**
 * Lifecycle UX Correction Pack 01 Part 2 — a dedicated "Current Lifecycle
 * Stage" UI element, deliberately separate from `Initiative.status` (see
 * `OverviewMetadataItem label="Status"` in the same Overview tab):
 * `Initiative.status` and the Lifecycle are independent concepts and
 * neither one replaces the other.
 *
 * Self-fetches the one selected stage's own projection — the exact same
 * generic per-stage endpoint `InitiativeLifecycleStageWorkspace` already
 * uses — purely for its `metadata` (presentation status / version /
 * publication date). Never blocks or replaces the rest of the Overview
 * tab: on any fetch failure this silently falls back to the plain stage
 * label with no publication metadata.
 */
export function CurrentLifecycleStageBanner({
  initiativeId,
  stageId,
  stageLabel,
}: {
  initiativeId: string;
  stageId: string;
  stageLabel: string;
}) {
  const [metadata, setMetadata] = useState<InitiativeLifecycleStageMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMetadata(null);

    getInitiativeLifecycleStageProjection(initiativeId, stageId)
      .then((projection) => {
        if (!cancelled) {
          setMetadata(projection.metadata);
        }
      })
      .catch(() => {
        // Presentation-only convenience — never surfaces an error state.
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, stageId]);

  const publicationLine =
    metadata?.publishedAt
      ? `Published${metadata.version !== null ? ` · Version ${metadata.version}` : ""} · ${formatInitiativeDate(metadata.publishedAt)}`
      : metadata
        ? STATUS_LABELS[metadata.presentationStatus]
        : null;

  return (
    <section className="pie-current-stage" aria-label="Current Lifecycle Stage">
      <h3 className="pie-current-stage__label">Current Lifecycle Stage</h3>
      <p className="pie-current-stage__value">{stageLabel}</p>
      {publicationLine ? <p className="pie-current-stage__meta">{publicationLine}</p> : null}
    </section>
  );
}
