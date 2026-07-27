"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CivicSearchResult, InitiativeLifecycleSearchGroup } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";
import { entityTypeLabel } from "../api";
import {
  persistInitiativeExpandedStageIds,
  readInitiativeExpandedStageIds,
} from "../initiative-timeline-accordion-state";

import "./initiative-timeline-group.css";

type StageVisualState = "completed" | "active" | "upcoming" | "unavailable";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function resultLinkLabel(entityType: CivicSearchResult["entityType"]): string {
  return entityType === "initiative" ? "View Initiative" : "View Public Page";
}

function stageStateLabel(state: StageVisualState): string {
  switch (state) {
    case "completed":
      return "Completed";
    case "active":
      return "Current stage";
    case "upcoming":
      return "Upcoming";
    default:
      return "Not applicable";
  }
}

function resolveStageStates(
  stages: InitiativeLifecycleSearchGroup["stages"],
): Map<string, StageVisualState> {
  const states = new Map<string, StageVisualState>();
  const populatedIndices = stages
    .map((stage, index) => (stage.records.length > 0 ? index : -1))
    .filter((index) => index >= 0);
  const activeIndex = populatedIndices.length > 0 ? populatedIndices.at(-1)! : 0;

  stages.forEach((stage, index) => {
    if (index < activeIndex) {
      states.set(stage.stageId, stage.records.length > 0 ? "completed" : "unavailable");
      return;
    }

    if (index === activeIndex) {
      states.set(stage.stageId, stage.records.length > 0 ? "active" : "upcoming");
      return;
    }

    states.set(stage.stageId, stage.records.length > 0 ? "upcoming" : "upcoming");
  });

  return states;
}

function StageRecordPreview({ result, matched }: { result: CivicSearchResult; matched: boolean }) {
  return (
    <article className="initiative-timeline-group__record">
      <h5 className="initiative-timeline-group__record-title">{result.title}</h5>
      {matched ? (
        <p className="initiative-timeline-group__record-match">
          Matched in {entityTypeLabel(result.entityType)}
        </p>
      ) : null}
      <p className="initiative-timeline-group__record-meta">
        {result.status} · Updated {formatDate(result.updatedAt)}
      </p>
      {result.summary ? (
        <p className="initiative-timeline-group__record-summary">{result.summary}</p>
      ) : null}
      <Link className="initiative-timeline-group__record-link" href={result.publicUrl}>
        {resultLinkLabel(result.entityType)} →
      </Link>
    </article>
  );
}

interface InitiativeTimelineGroupProps {
  group: InitiativeLifecycleSearchGroup;
  locationLabel: string;
}

export function InitiativeTimelineGroup({ group, locationLabel }: InitiativeTimelineGroupProps) {
  const stageIds = useMemo(() => group.stages.map((stage) => stage.stageId), [group.stages]);
  const stageStates = useMemo(() => resolveStageStates(group.stages), [group.stages]);
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(() =>
    readInitiativeExpandedStageIds(group.initiativeId, stageIds),
  );

  useEffect(() => {
    setExpandedStageIds(readInitiativeExpandedStageIds(group.initiativeId, stageIds));
  }, [group.initiativeId, stageIds]);

  const initiativeRecord = group.stages
    .flatMap((stage) => stage.records)
    .find((record) => record.entityType === "initiative");

  function toggleStage(stageId: string): void {
    setExpandedStageIds((current) => {
      const next = new Set(current);

      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }

      persistInitiativeExpandedStageIds(group.initiativeId, next, stageIds);
      return next;
    });
  }

  function collapseAllStages(): void {
    const next = new Set<string>();
    setExpandedStageIds(next);
    persistInitiativeExpandedStageIds(group.initiativeId, next, stageIds);
  }

  const showCollapseAll = expandedStageIds.size > 1;

  return (
    <li className="initiative-timeline-group">
      <header className="initiative-timeline-group__header">
        <div className="initiative-timeline-group__header-media">
          <InitiativeImage
            title={group.title}
            imageUrl={group.imageUrl}
            className="initiative-timeline-group__header-image"
          />
        </div>
        <div className="initiative-timeline-group__header-body">
          <h2 className="initiative-timeline-group__title">{group.title}</h2>
          <p className="initiative-timeline-group__summary">{group.summary}</p>
          {group.activityArea ? (
            <p className="initiative-timeline-group__activity-area">{group.activityArea}</p>
          ) : null}
          <p className="initiative-timeline-group__meta">
            {locationLabel} · {group.status} · Updated {formatDate(group.latestActivityAt)}
          </p>
          {initiativeRecord ? (
            <Link
              className="initiative-timeline-group__primary-action"
              href={initiativeRecord.publicUrl}
            >
              View Initiative →
            </Link>
          ) : null}
        </div>
      </header>

      {showCollapseAll ? (
        <div className="initiative-timeline-group__controls">
          <button
            type="button"
            className="initiative-timeline-group__collapse-all"
            onClick={collapseAllStages}
          >
            Collapse all
          </button>
        </div>
      ) : null}

      <div
        className="initiative-timeline-group__timeline"
        role="list"
        aria-label="Initiative lifecycle stages"
      >
        {group.stages.map((stage, index) => {
          const visualState = stageStates.get(stage.stageId) ?? "upcoming";
          const isExpanded = expandedStageIds.has(stage.stageId);
          const recordCount = stage.records.length;
          const stageButtonId = `stage-toggle-${group.initiativeId}-${stage.stageId}`;
          const stagePanelId = `stage-panel-${group.initiativeId}-${stage.stageId}`;

          return (
            <section
              key={stage.stageId}
              className={`initiative-timeline-group__stage initiative-timeline-group__stage--${visualState}${
                stage.matched ? " initiative-timeline-group__stage--matched" : ""
              }`}
              role="listitem"
              aria-labelledby={stageButtonId}
            >
              <div className="initiative-timeline-group__stage-marker" aria-hidden="true">
                <span className="initiative-timeline-group__stage-dot" />
                {index < group.stages.length - 1 ? (
                  <span className="initiative-timeline-group__stage-connector" />
                ) : null}
              </div>

              <div className="initiative-timeline-group__stage-content">
                <button
                  type="button"
                  id={stageButtonId}
                  className={`initiative-timeline-group__stage-toggle${
                    isExpanded ? " initiative-timeline-group__stage-toggle--expanded" : ""
                  }`}
                  aria-expanded={recordCount > 0 ? isExpanded : false}
                  aria-controls={recordCount > 0 ? stagePanelId : undefined}
                  disabled={recordCount === 0}
                  onClick={() => toggleStage(stage.stageId)}
                >
                  <span className="initiative-timeline-group__stage-label">{stage.label}</span>
                  {recordCount > 1 ? (
                    <span className="initiative-timeline-group__stage-count">({recordCount})</span>
                  ) : null}
                  <span className="initiative-timeline-group__stage-state">
                    {stageStateLabel(visualState)}
                  </span>
                  {stage.matched ? (
                    <span className="initiative-timeline-group__stage-match-label">
                      Match found in {stage.label}
                    </span>
                  ) : null}
                </button>

                {recordCount > 0 && isExpanded ? (
                  <div
                    id={stagePanelId}
                    className="initiative-timeline-group__stage-records"
                    role="region"
                    aria-labelledby={stageButtonId}
                  >
                    {stage.records.map((result) => (
                      <StageRecordPreview
                        key={`${result.entityType}-${result.entityId}`}
                        result={result}
                        matched={result.matchedFields.length > 0}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </li>
  );
}
